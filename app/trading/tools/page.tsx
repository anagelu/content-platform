import Link from "next/link";
import { CandlestickSignalReader } from "./candlestick-signal-reader";
import { RiskRewardCalculator } from "./risk-reward-calculator";

export default function TradingToolsPage() {
  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Trading Tools</h1>
        <p className="page-subtitle">
          Start with lightweight utilities that support disciplined execution,
          then grow this area into a more complete trader workspace.
        </p>

        <div className="toolbar">
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
          <Link href="/trading/new" className="button-link">
            New Trading Session
          </Link>
          <Link href="/trading/algo" className="button-link secondary">
            Algo Workspace
          </Link>
          <Link href="/trading/screener" className="button-link secondary">
            Screener
          </Link>
          <Link href="/trading/recommendations" className="button-link secondary">
            Recommendations
          </Link>
        </div>

        <details className="card tool-disclosure" style={{ marginBottom: "1rem" }}>
          <summary className="tool-disclosure-summary">
            <div>
              <h2 className="trading-section-title">Risk / Reward Calculator</h2>
              <p className="page-subtitle tool-disclosure-copy">
                Reveal this only when you want to sanity-check whether a setup
                deserves attention before it becomes a public workflow.
              </p>
            </div>
            <span className="tool-disclosure-hint">Click or hover to open</span>
          </summary>

          <div className="tool-disclosure-content">
            <RiskRewardCalculator />
          </div>
        </details>

        <section className="card">
          <h2 className="trading-section-title">Candlestick Signal Reader</h2>
          <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
            Search for a company or ticker, pull live market candles, and then
            inspect the pattern logic with transparent rules you can still edit
            by hand.
          </p>
          <CandlestickSignalReader />
        </section>
      </div>
    </main>
  );
}
