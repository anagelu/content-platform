"use server";

import {
  getLiveMarketSnapshot,
  type MarketInterval,
  type MarketRange,
} from "@/lib/market-data";

export async function getCandlestickReaderSnapshot(input: {
  query: string;
  interval: MarketInterval;
  range: MarketRange;
}) {
  const query = input.query.trim();

  if (!query) {
    throw new Error("Add a company name or ticker first.");
  }

  const snapshot = await getLiveMarketSnapshot(query, input.interval, input.range);

  if (!snapshot) {
    throw new Error(
      "No live market data was available for that company or ticker right now.",
    );
  }

  if (snapshot.candles.length < 3) {
    throw new Error(
      "That view did not return enough candles yet. Try a longer range or a tighter timeframe.",
    );
  }

  return snapshot;
}
