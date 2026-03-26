import Link from "next/link";
import { normalizeChartTimeframe } from "@/lib/chart-timeframes";
import { TradingChartView } from "./trading-chart-view";

export default async function TradingChartPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const marketParam = resolvedSearchParams?.market;
  const timeframeParam = resolvedSearchParams?.timeframe;
  const market =
    typeof marketParam === "string" && marketParam.trim()
      ? marketParam.trim().toUpperCase()
      : "";
  const timeframe =
    typeof timeframeParam === "string" ? normalizeChartTimeframe(timeframeParam) : "1d";

  if (!market) {
    return (
      <main>
        <div className="site-shell site-shell-wide">
          <div className="form-card">
            <h1 className="page-title">Chart View</h1>
            <p className="page-subtitle">
              Open this from a trading form after selecting a market.
            </p>
            <Link href="/trading/new" className="button-link secondary">
              New Trading Session
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <TradingChartView market={market} timeframe={timeframe} />
      </div>
    </main>
  );
}
