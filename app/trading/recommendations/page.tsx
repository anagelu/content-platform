import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function TradingRecommendationsPage() {
  const markets = await prisma.tradingSession.groupBy({
    by: ["market"],
    _count: {
      market: true,
    },
    orderBy: {
      _count: {
        market: "desc",
      },
    },
  });

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Market Recommendations</h1>
        <p className="page-subtitle">
          Browse community-derived entry and exit recommendations by market and
          timeframe.
        </p>

        <div className="toolbar">
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
        </div>

        {markets.length === 0 ? (
          <div className="card">
            <p>No market recommendations yet.</p>
          </div>
        ) : (
          <ul className="card-list">
            {markets.map((market) => (
              <li key={market.market} className="card">
                <h2 className="card-title">
                  <Link
                    href={`/trading/recommendations/${encodeURIComponent(
                      market.market,
                    )}`}
                  >
                    {market.market}
                  </Link>
                </h2>
                <p className="meta">{market._count.market} session signals</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
