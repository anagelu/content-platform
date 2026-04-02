import { auth } from "@/auth";
import Link from "next/link";
import {
  getAlpacaControllerHistory,
  getAlpacaExecutionState,
  getAlpacaOrderHistory,
} from "./actions";
import { AlpacaBotPanel } from "./alpaca-bot-panel";
import { HeldAssetActions } from "./held-asset-actions";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedMoney(value: number) {
  const amount = formatMoney(Math.abs(value));
  return value >= 0 ? `+${amount}` : `-${amount}`;
}

function formatNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function TradingAlgoPage({
  searchParams,
}: {
  searchParams?: Promise<{
    symbol?: string;
  }>;
}) {
  const session = await auth();
  const orderHistory = session?.user?.id ? await getAlpacaOrderHistory() : [];
  const controllers = session?.user?.id ? await getAlpacaControllerHistory() : [];
  const executionState = session?.user?.id
    ? await getAlpacaExecutionState()
    : { positions: [], openOrders: [], recentOrders: [] };
  const totalMarketValue = executionState.positions.reduce(
    (sum, position) => sum + position.marketValue,
    0,
  );
  const totalUnrealizedPl = executionState.positions.reduce(
    (sum, position) => sum + position.unrealizedPl,
    0,
  );
  const profitablePositions = executionState.positions.filter(
    (position) => position.unrealizedPl > 0,
  ).length;
  const losingPositions = executionState.positions.filter(
    (position) => position.unrealizedPl < 0,
  ).length;
  const holdings = executionState.positions.map((position) => {
    const absoluteQty = Math.abs(position.qty);
    const currentPrice =
      absoluteQty > 0 ? Math.abs(position.marketValue) / absoluteQty : null;
    const costBasis =
      absoluteQty > 0 ? absoluteQty * position.avgEntryPrice : null;
    const unrealizedPlPercent =
      costBasis && costBasis > 0 ? position.unrealizedPl / costBasis : null;
    const portfolioWeight =
      totalMarketValue > 0 ? Math.abs(position.marketValue) / totalMarketValue : null;

    return {
      ...position,
      absoluteQty,
      absoluteAvailableQty: Math.abs(position.availableQty),
      absoluteHeldForOrdersQty: Math.abs(position.heldForOrdersQty),
      currentPrice,
      costBasis,
      unrealizedPlPercent,
      portfolioWeight,
    };
  });
  const params = searchParams ? await searchParams : undefined;
  const initialSymbol =
    params?.symbol && params.symbol.trim() ? params.symbol.trim().toUpperCase() : undefined;

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Alpaca Algo Workspace</h1>
        <p className="page-subtitle">
          Inspect the paper-trading bot from inside the app, validate the live
          signal inputs, and keep the first version safely analysis-only while
          we shape the workflow.
        </p>

        <div className="toolbar">
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
          <Link href="/trading/algo/controller-v2" className="button-link">
            Open Controller V2
          </Link>
          <Link href="/trading/tools" className="button-link secondary">
            Open Tools
          </Link>
        </div>

        <section className="trading-hero-card" style={{ marginBottom: "1.5rem" }}>
          <h2 className="trading-section-title">What this page does</h2>
          <p>
            This first pass reads your Alpaca paper account, price feed, and
            controller strategy state. You can keep it fully manual with no
            strategy, or optionally layer in SMA or Bollinger logic. Manual
            paper orders from the site are now logged here so the workflow
            stays inspectable after refresh.
          </p>
          <p className="meta" style={{ marginBottom: 0 }}>
            Automated entries and exits for active strategy controllers run
            through the local runner or automation endpoint, not from the page
            alone. `Pause` and `Eject` still stop the controller immediately.
          </p>
          <p className="meta" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            If a button seems out of date, make sure you are using the latest
            local dev server tab. This workspace has recently been running on
            port 3001 instead of 3000.
          </p>
        </section>

        <AlpacaBotPanel
          initialSymbol={initialSymbol}
          initialControllers={controllers}
        />

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Live Alpaca Dashboard</h2>

          <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Open positions</span>
              <strong>{executionState.positions.length}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Total exposure</span>
              <strong>{formatMoney(totalMarketValue)}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Unrealized P/L</span>
              <strong style={{ color: totalUnrealizedPl >= 0 ? "#166534" : "#b91c1c" }}>
                {formatSignedMoney(totalUnrealizedPl)}
              </strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Open orders</span>
              <strong>{executionState.openOrders.length}</strong>
            </div>
          </div>

          <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Winning positions</span>
              <strong style={{ color: "#166534" }}>{profitablePositions}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Losing positions</span>
              <strong style={{ color: "#b91c1c" }}>{losingPositions}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Recent Alpaca orders</span>
              <strong>{executionState.recentOrders.length}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Website order logs</span>
              <strong>{orderHistory.length}</strong>
            </div>
          </div>

          <div className="trading-detail-grid">
            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Held Assets</h3>
              <p className="meta" style={{ marginTop: "-0.25rem" }}>
                Open holdings from either manual buys or active strategy-driven entries.
              </p>
              {holdings.length === 0 ? (
                <p className="meta">No open Alpaca positions right now.</p>
              ) : (
                holdings.map((position) => (
                  <div
                    key={position.symbol}
                    style={{
                      padding: "0.9rem 0",
                      borderTop: "1px solid #ede7dc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        alignItems: "baseline",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>{position.symbol}</strong>
                      <strong
                        style={{
                          color: position.unrealizedPl >= 0 ? "#166534" : "#b91c1c",
                        }}
                      >
                        {formatSignedMoney(position.unrealizedPl)}
                      </strong>
                    </div>
                    <p className="meta" style={{ marginTop: "0.35rem" }}>
                      Qty {formatNumber(position.absoluteQty, 6)} · Available{" "}
                      {formatNumber(position.absoluteAvailableQty, 6)} · Side {position.side} · Avg
                      entry {formatMoney(position.avgEntryPrice)}
                    </p>
                    <p className="meta">
                      Current est. {formatMoney(position.currentPrice)} · Market value{" "}
                      {formatMoney(position.marketValue)}
                    </p>
                    <p className="meta">
                      Cost basis {formatMoney(position.costBasis)} · P/L{" "}
                      {formatPercent(position.unrealizedPlPercent)}
                    </p>
                    <p className="meta">
                      Portfolio weight {formatPercent(position.portfolioWeight)}
                    </p>

                    <HeldAssetActions
                      symbol={position.symbol}
                      side={position.side}
                      availableQty={position.absoluteAvailableQty}
                      heldForOrdersQty={position.absoluteHeldForOrdersQty}
                    />
                  </div>
                ))
              )}
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Open Orders</h3>
              {executionState.openOrders.length === 0 ? (
                <p className="meta">No open Alpaca orders right now.</p>
              ) : (
                executionState.openOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      padding: "0.9rem 0",
                      borderTop: "1px solid #ede7dc",
                    }}
                  >
                    <p className="meta" style={{ marginTop: 0 }}>
                      <strong>{order.side.toUpperCase()} {order.symbol}</strong> · status {order.status}
                    </p>
                    <p className="meta">
                      Qty {order.qty ?? "--"} · Filled {order.filledQty ?? "--"} · Type {order.type}
                    </p>
                    <p className="meta">
                      Submitted {order.submittedAt ? formatTimestamp(order.submittedAt) : "--"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Recent Alpaca Orders</h2>
          {executionState.recentOrders.length === 0 ? (
            <div className="card">
              <p className="meta">No recent Alpaca orders returned.</p>
            </div>
          ) : (
            <ul className="card-list">
              {executionState.recentOrders.slice(0, 20).map((order) => (
                <li key={order.id} className="card">
                  <h3 className="card-title">
                    {order.side.toUpperCase()} {order.symbol}
                  </h3>
                  <p className="meta">
                    {order.type} · {order.timeInForce} · status {order.status}
                  </p>
                  <p className="meta">
                    Qty {order.qty ?? "--"} · Filled {order.filledQty ?? "--"} · Avg{" "}
                    {formatMoney(order.filledAvgPrice)}
                  </p>
                  <p className="meta">
                    Submitted {order.submittedAt ? formatTimestamp(order.submittedAt) : "--"}
                    {order.filledAt ? ` · Filled ${formatTimestamp(order.filledAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Website Order History</h2>
          {orderHistory.length === 0 ? (
            <div className="card">
              <p className="meta">
                No website-submitted Alpaca paper orders have been logged yet.
              </p>
            </div>
          ) : (
            <ul className="card-list">
              {orderHistory.map((entry) => (
                <li key={entry.id} className="card">
                  <h3 className="card-title">
                    {entry.side.toUpperCase()} {entry.symbol}
                  </h3>
                  <p className="meta">
                    {entry.environment} · {entry.orderType} · status {entry.status}
                  </p>
                  <p className="meta">
                    Qty {entry.qty ?? "--"} · Filled {entry.filledQty ?? "--"} · Avg{" "}
                    {formatMoney(entry.filledAvgPrice)}
                  </p>
                  <p className="meta">
                    Client ID {entry.clientOrderId}
                  </p>
                  <p className="meta">
                    Logged {formatTimestamp(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
