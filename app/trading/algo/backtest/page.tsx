import { auth } from "@/auth";
import { getUserAlpacaCredentials } from "@/lib/alpaca-oauth";
import { type AlpacaBarTimeframe } from "@/lib/alpaca";
import { runAlgoBacktest } from "@/lib/algo-backtest";
import Link from "next/link";
import { redirect } from "next/navigation";

const TIMEFRAMES: AlpacaBarTimeframe[] = [
  "1Min",
  "5Min",
  "15Min",
  "30Min",
  "1Hour",
  "1Day",
  "1Week",
];

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(2)}%`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function getDefaultEndDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AlgoBacktestPage({
  searchParams,
}: {
  searchParams?: Promise<{
    symbol?: string;
    timeframe?: AlpacaBarTimeframe;
    start?: string;
    end?: string;
    trend?: string;
    timeframeConfluence?: string;
    lookaheadBars?: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const symbol = params?.symbol?.trim().toUpperCase() || "";
  const timeframe = TIMEFRAMES.includes(params?.timeframe as AlpacaBarTimeframe)
    ? (params?.timeframe as AlpacaBarTimeframe)
    : "1Min";
  const startDate = params?.start || getDefaultStartDate();
  const endDate = params?.end || getDefaultEndDate();
  const trendThreshold = Number(params?.trend || "70");
  const timeframeConfluenceThreshold = Number(params?.timeframeConfluence || "60");
  const lookaheadBars = Number(params?.lookaheadBars || "60");

  let report:
    | Awaited<ReturnType<typeof runAlgoBacktest>>
    | null = null;
  let error = "";

  if (symbol) {
    try {
      const credentials = await getUserAlpacaCredentials(Number(session.user.id));
      report = await runAlgoBacktest({
        symbol,
        timeframe,
        startDate,
        endDate,
        trendThreshold,
        timeframeConfluenceThreshold,
        lookaheadBars,
        credentials,
      });
    } catch (backtestError) {
      error =
        backtestError instanceof Error
          ? backtestError.message
          : "Unable to run the backtest right now.";
    }
  }

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Backtest Summary</h1>
        <p className="page-subtitle">
          Replay historical bars through the controller’s confluence logic, flag qualifying setups, and audit how those signals performed over the next fixed window.
        </p>

        <div className="toolbar">
          <Link href="/trading/algo" className="button-link secondary">
            Back to Algo
          </Link>
          <Link href="/trading/algo/controller-v2" className="button-link secondary">
            Controller V2
          </Link>
        </div>

        <section className="card">
          <form method="get" className="ekub-form-stack">
            <div className="ekub-form-grid">
              <label className="ekub-field">
                <span className="site-sidebar-label">Ticker</span>
                <input
                  type="text"
                  name="symbol"
                  className="form-input"
                  defaultValue={symbol}
                  placeholder="SOL/USD or SPY"
                  required
                />
              </label>
              <label className="ekub-field">
                <span className="site-sidebar-label">Timeframe</span>
                <select name="timeframe" className="form-input" defaultValue={timeframe}>
                  {TIMEFRAMES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ekub-field">
                <span className="site-sidebar-label">Start Date</span>
                <input type="date" name="start" className="form-input" defaultValue={startDate} />
              </label>
              <label className="ekub-field">
                <span className="site-sidebar-label">End Date</span>
                <input type="date" name="end" className="form-input" defaultValue={endDate} />
              </label>
              <label className="ekub-field">
                <span className="site-sidebar-label">Trend Threshold</span>
                <input
                  type="number"
                  name="trend"
                  className="form-input"
                  min="0"
                  max="100"
                  defaultValue={trendThreshold}
                />
              </label>
              <label className="ekub-field">
                <span className="site-sidebar-label">Timeframe Confluence Threshold</span>
                <input
                  type="number"
                  name="timeframeConfluence"
                  className="form-input"
                  min="0"
                  max="100"
                  defaultValue={timeframeConfluenceThreshold}
                />
              </label>
              <label className="ekub-field">
                <span className="site-sidebar-label">Lookahead Bars</span>
                <input
                  type="number"
                  name="lookaheadBars"
                  className="form-input"
                  min="1"
                  max="500"
                  defaultValue={lookaheadBars}
                />
              </label>
            </div>

            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button type="submit" className="submit-button">
                Run Summary Report
              </button>
            </div>
          </form>
        </section>

        {error ? (
          <section className="card">
            <p className="form-error" style={{ marginBottom: 0 }}>{error}</p>
          </section>
        ) : null}

        {report ? (
          <>
            <section className="trading-hero-card" style={{ marginTop: "1.5rem" }}>
              <h2 className="trading-section-title">
                {report.symbol} · {report.timeframe}
              </h2>
              <p className="meta">
                {report.startDate} to {report.endDate} · Trend &gt; {report.thresholds.trend} ·
                Timeframe Confluence &gt; {report.thresholds.timeframeConfluence} · {report.lookaheadBars} bars held
              </p>

              <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Bars analyzed</span>
                  <strong>{report.barCount}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Signals found</span>
                  <strong>{report.tradeCount}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Win rate</span>
                  <strong>{formatPercent(report.winRate)}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Avg return</span>
                  <strong>{formatPercent(report.averageReturnPercent)}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Best</span>
                  <strong>{formatPercent(report.bestReturnPercent)}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Max drawdown</span>
                  <strong>{formatPercent(report.maxDrawdownPercent)}</strong>
                </div>
              </div>
            </section>

            <div className="ekub-dashboard-grid">
              <section className="card">
                <h2 className="trading-section-title">Top Setups</h2>
                {report.topSetups.length === 0 ? (
                  <p className="preview">No qualifying setups found in this range.</p>
                ) : (
                  <div className="ekub-list">
                    {report.topSetups.map((trade) => (
                      <div key={`${trade.timestamp}-best`} className="ekub-list-row">
                        <div>
                          <strong>{formatTimestamp(trade.timestamp)}</strong>
                          <p className="meta">
                            Entry {formatMoney(trade.entryPrice)} · Exit {formatMoney(trade.exitPrice)} · Trend {trade.trendScore} · TF {trade.timeframeConfluenceScore}
                          </p>
                        </div>
                        <strong style={{ color: "#166534" }}>{formatPercent(trade.returnPercent)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <h2 className="trading-section-title">Worst Setups</h2>
                {report.worstSetups.length === 0 ? (
                  <p className="preview">No qualifying setups found in this range.</p>
                ) : (
                  <div className="ekub-list">
                    {report.worstSetups.map((trade) => (
                      <div key={`${trade.timestamp}-worst`} className="ekub-list-row">
                        <div>
                          <strong>{formatTimestamp(trade.timestamp)}</strong>
                          <p className="meta">
                            Entry {formatMoney(trade.entryPrice)} · Exit {formatMoney(trade.exitPrice)} · Max DD {formatPercent(trade.maxDrawdownPercent)}
                          </p>
                        </div>
                        <strong style={{ color: "#b91c1c" }}>{formatPercent(trade.returnPercent)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <section className="card" style={{ marginTop: "1.5rem" }}>
            <p className="preview" style={{ marginBottom: 0 }}>
              Run a symbol through the historical summary engine to see how often the current confluence logic would have fired and how those setups performed over the next fixed window.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
