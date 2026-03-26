import {
  getMarketMovers,
  getMostActiveStocks,
  getStockSnapshots,
} from "@/lib/alpaca";

export type RankedScreenerPick = {
  symbol: string;
  score: number;
  reasons: string[];
  price: number | null;
  change: number | null;
  percentChange: number | null;
  volume: number | null;
  tradeCount: number | null;
  previousClose: number | null;
  intradayVolume: number | null;
  latestTradeTimestamp: string | null;
  tags: string[];
};

function round(value: number) {
  return Number(value.toFixed(2));
}

export async function getRankedScreenerPicks() {
  const [movers, mostActive] = await Promise.all([
    getMarketMovers(10),
    getMostActiveStocks(10),
  ]);

  const moverMap = new Map(
    [...movers.gainers, ...movers.losers].map((item) => [item.symbol, item]),
  );
  const activeMap = new Map(mostActive.stocks.map((item) => [item.symbol, item]));
  const symbols = Array.from(new Set([...moverMap.keys(), ...activeMap.keys()]));
  const snapshots = await getStockSnapshots(symbols);

  const picks: RankedScreenerPick[] = symbols
    .map((symbol) => {
      const mover = moverMap.get(symbol) ?? null;
      const active = activeMap.get(symbol) ?? null;
      const snapshot = snapshots[symbol];
      const price = mover?.price ?? snapshot?.latestTradePrice ?? snapshot?.dailyClose ?? null;
      const percentChange =
        mover?.percentChange ??
        (snapshot?.dailyClose !== null &&
        snapshot?.dailyClose !== undefined &&
        snapshot?.previousClose
          ? ((snapshot.dailyClose - snapshot.previousClose) / snapshot.previousClose) * 100
          : null);
      const change =
        mover?.change ??
        (snapshot?.dailyClose !== null &&
        snapshot?.dailyClose !== undefined &&
        snapshot?.previousClose !== null &&
        snapshot?.previousClose !== undefined
          ? snapshot.dailyClose - snapshot.previousClose
          : null);
      const volume = active?.volume ?? snapshot?.dailyVolume ?? null;
      const tradeCount = active?.tradeCount ?? null;
      const tags: string[] = [];
      const reasons: string[] = [];
      let score = 0;

      if (active) {
        tags.push("Most active");
        score += 30;
        reasons.push(
          `${active.volume.toLocaleString("en-US")} shares traded with ${active.tradeCount.toLocaleString("en-US")} trades.`,
        );
      }

      if (mover) {
        tags.push(mover.change >= 0 ? "Mover up" : "Mover down");
        score += Math.min(Math.abs(mover.percentChange), 40);
        reasons.push(
          `${round(mover.percentChange)}% move on the day (${round(mover.change)} points).`,
        );
      }

      if (snapshot?.minuteVolume && snapshot.minuteVolume > 0) {
        score += 5;
        reasons.push(
          `Latest minute volume came in at ${snapshot.minuteVolume.toLocaleString("en-US")}.`,
        );
      }

      if (price !== null && price >= 5) {
        score += 10;
        reasons.push("Trading above the ultra-low-price zone.");
      } else {
        reasons.push("Sub-$5 name, so execution risk can be higher.");
      }

      if (snapshot?.previousClose && price) {
        const gapPercent = ((price - snapshot.previousClose) / snapshot.previousClose) * 100;
        if (Math.abs(gapPercent) >= 3) {
          score += 10;
          reasons.push(`Holding a ${round(gapPercent)}% gap versus the prior close.`);
        }
      }

      return {
        symbol,
        score: round(score),
        reasons,
        price,
        change: change !== null ? round(change) : null,
        percentChange: percentChange !== null ? round(percentChange) : null,
        volume,
        tradeCount,
        previousClose: snapshot?.previousClose ?? null,
        intradayVolume: snapshot?.minuteVolume ?? null,
        latestTradeTimestamp: snapshot?.latestTradeTimestamp ?? null,
        tags,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    lastUpdated: movers.lastUpdated ?? mostActive.lastUpdated ?? null,
    gainers: movers.gainers,
    losers: movers.losers,
    mostActive: mostActive.stocks,
    picks,
  };
}
