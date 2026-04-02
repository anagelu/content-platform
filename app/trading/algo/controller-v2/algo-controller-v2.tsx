"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAlpacaAlgoSnapshot, runAlpacaTradeController } from "../actions";
import type { AlpacaTradeController } from "@/lib/alpaca-trade-controller";
import type { AlpacaPosition } from "@/lib/alpaca";

type Snapshot = Awaited<ReturnType<typeof getAlpacaAlgoSnapshot>>;
type ControllerResult = Awaited<ReturnType<typeof runAlpacaTradeController>>;
type ControllerMode = "standard" | "turbo";
type Bias = "bearish" | "neutral" | "bullish";
const COMMON_CRYPTO_BASE_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "XRP",
  "SOL",
  "DOGE",
  "ADA",
  "AVAX",
  "LINK",
  "UNI",
  "LTC",
  "BCH",
  "MATIC",
  "AAVE",
  "SHIB",
]);

function formatMoney(value: number) {
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

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDteLabel(days: number) {
  return `${days} DTE`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeMarketInput(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isCryptoLikeSymbol(symbol: string) {
  const normalized = normalizeMarketInput(symbol);
  return normalized.includes("/") || COMMON_CRYPTO_BASE_SYMBOLS.has(normalized);
}

function getDefaultBiasFromSignal(signalAction: Snapshot["signal"]["action"]): Bias {
  if (signalAction === "buy") {
    return "bullish";
  }

  if (signalAction === "sell") {
    return "bearish";
  }

  return "neutral";
}

function getHealthScore(snapshot: Snapshot | null, positionPnl: number) {
  if (!snapshot) {
    return 52;
  }

  const trendComponent = 20 + snapshot.trendStrength * 20;
  const changeComponent = clamp(snapshot.priceChangePercent * 3, -10, 10);
  const volumeComponent =
    snapshot.relativeVolume === null
      ? 12
      : clamp((snapshot.relativeVolume - 1) * 18 + 12, 0, 24);
  const timeComponent =
    snapshot.signalAgeSeconds === null
      ? 8
      : clamp(15 - snapshot.signalAgeSeconds / 120, 0, 15);
  const signalComponent =
    snapshot.signal.action === "buy" ? 16 : snapshot.signal.action === "sell" ? -10 : 6;
  const pnlComponent = positionPnl > 0 ? 7 : positionPnl < 0 ? -8 : 0;

  let score =
    trendComponent +
    changeComponent +
    volumeComponent +
    timeComponent +
    signalComponent +
    pnlComponent;

  if (snapshot.dailyPnL <= -Math.abs(snapshot.maxDailyLoss)) {
    score -= 20;
  }

  return clamp(score, 5, 95);
}

function getHealthLabel(score: number) {
  if (score >= 68) {
    return "Favorable";
  }

  if (score >= 42) {
    return "Neutral";
  }

  return "Weak";
}

function getHealthTone(score: number) {
  if (score >= 68) {
    return "is-positive";
  }

  if (score >= 42) {
    return "is-neutral";
  }

  return "is-negative";
}

function getPrimaryCommand(
  controller: AlpacaTradeController | null,
): {
  command: "PLAY" | "PAUSE" | "RESUME";
  label: string;
  helper: string;
  tone: string;
} {
  if (!controller || controller.status === "EJECTED") {
    return {
      command: "PLAY",
      label: "Play Position",
      helper: "Arm the controller and enter using the size you selected above.",
      tone: "algo-v2-action-button is-positive",
    };
  }

  if (controller.status === "ACTIVE") {
    return {
      command: "PAUSE",
      label: "Pause Risk",
      helper: "Temporarily stand down the controller and flatten the active exposure.",
      tone: "algo-v2-action-button is-primary",
    };
  }

  return {
    command: "RESUME",
    label: "Resume Position",
    helper: "Re-arm the controller and let it return to the active plan.",
    tone: "algo-v2-action-button is-positive",
  };
}

function getBiasButtonClass(currentBias: Bias, value: Bias) {
  return currentBias === value
    ? `algo-v2-bias-button is-active is-${value}`
    : "algo-v2-bias-button";
}

function formatPercent(value: number | null, maximumFractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(maximumFractionDigits)}%`;
}

function formatRelativeVolume(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(2)}x`;
}

function formatSignalAge(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Unavailable";
  }

  if (value < 60) {
    return `${value}s ago`;
  }

  if (value < 3600) {
    return `${Math.round(value / 60)}m ago`;
  }

  return `${Math.round(value / 3600)}h ago`;
}

function buildTurboContracts({
  symbol,
  latestPrice,
  bias,
  targetDelta,
  dte,
}: {
  symbol: string;
  latestPrice: number;
  bias: Bias;
  targetDelta: number;
  dte: number;
}) {
  const roundedPrice = Math.round(latestPrice);
  const direction = bias === "bearish" ? "P" : "C";
  const sign = bias === "bearish" ? -1 : 1;
  const strikeOffsets = [0, 1, 2];
  const contractDate = new Date();
  contractDate.setDate(contractDate.getDate() + dte);
  const expiry = contractDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return strikeOffsets.map((offset) => {
    const strike = roundedPrice + sign * Math.round((targetDelta * 20 + offset * 2) * (bias === "bearish" ? -1 : 1));
    const delta = Number((targetDelta + offset * 0.04).toFixed(2));
    const mark = Number((latestPrice * (0.0045 + offset * 0.0012)).toFixed(2));

    return {
      id: `${symbol}-${expiry}-${strike}${direction}`,
      label: `${symbol} ${expiry} ${strike}${direction}`,
      delta: bias === "bearish" ? -delta : delta,
      mark,
      spread: offset === 0 ? "tight" : offset === 1 ? "workable" : "wider",
    };
  });
}

export function AlgoControllerV2({
  initialSymbol,
  initialControllers,
  initialPositions,
  initialPnl,
  initialError,
}: {
  initialSymbol: string;
  initialControllers: AlpacaTradeController[];
  initialPositions: AlpacaPosition[];
  initialPnl: number;
  initialError: string;
}) {
  const router = useRouter();
  const controllerSymbols = initialControllers.map((controller) => controller.symbol);
  const positionSymbols = initialPositions.map((position) => position.symbol);
  const suggestedSymbols = Array.from(
    new Set([initialSymbol, ...controllerSymbols, ...positionSymbols]),
  ).filter(Boolean);

  const [mode, setMode] = useState<ControllerMode>("standard");
  const [symbol, setSymbol] = useState(normalizeMarketInput(initialSymbol));
  const [targetSize, setTargetSize] = useState(
    String(initialControllers.find((controller) => controller.symbol === initialSymbol)?.targetQty ?? 10),
  );
  const [deltaTarget, setDeltaTarget] = useState(0.4);
  const [daysToExpiry, setDaysToExpiry] = useState(30);
  const [bias, setBias] = useState<Bias>("bullish");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [controllers, setControllers] = useState(initialControllers);
  const [positions, setPositions] = useState(initialPositions);
  const [error, setError] = useState(initialError);
  const [actionNotice, setActionNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const normalizedSymbol = normalizeMarketInput(symbol);

  const activeController = useMemo(
    () => controllers.find((controller) => controller.symbol === normalizedSymbol) ?? null,
    [controllers, normalizedSymbol],
  );
  const activePosition = useMemo(
    () => positions.find((position) => position.symbol === normalizedSymbol) ?? null,
    [positions, normalizedSymbol],
  );
  const isCrypto = isCryptoLikeSymbol(normalizedSymbol);
  const targetQtyValue = Math.max(Number(targetSize) || 0, 0);
  const minimumTargetQty = isCrypto ? 0.01 : 1;
  const targetSliderMax = Math.max(
    isCrypto ? 5 : 100,
    targetQtyValue > 0 ? targetQtyValue * 2 : isCrypto ? 5 : 100,
  );
  const targetSliderStep = isCrypto ? 0.01 : 1;

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }

    const suggestedTarget =
      activeController?.targetQty ?? Math.abs(activePosition?.qty ?? 0) ?? minimumTargetQty;

    if (Number.isFinite(suggestedTarget) && suggestedTarget > 0) {
      setTargetSize(String(suggestedTarget));
    }
  }, [activeController?.targetQty, activePosition?.qty, minimumTargetQty, normalizedSymbol]);

  useEffect(() => {
    let cancelled = false;

    setError("");

    if (!normalizedSymbol) {
      setSnapshot(null);
      return;
    }

    startTransition(async () => {
      try {
        const result = await getAlpacaAlgoSnapshot({
          symbol: normalizedSymbol,
          strategyType: activeController?.strategyType ?? "NONE",
          strategyTimeframe: activeController?.strategyTimeframe ?? "1Min",
          fastPeriod: activeController?.fastPeriod ?? 5,
          slowPeriod: activeController?.slowPeriod ?? 20,
          bollingerLength: activeController?.bollingerLength ?? 20,
          bollingerStdDev: activeController?.bollingerStdDev ?? 2,
          maxNotional: activeController?.maxNotional ?? 100,
          maxDailyLoss: activeController?.maxDailyLoss ?? 25,
        });

        if (cancelled) {
          return;
        }

        setSnapshot(result);
        setBias(getDefaultBiasFromSignal(result.signal.action));
      } catch (snapshotError) {
        if (cancelled) {
          return;
        }

        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : "Unable to load the algo snapshot right now.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeController, normalizedSymbol]);

  const currentQty = snapshot?.position?.qty ?? activePosition?.qty ?? 0;
  const pendingChange = targetQtyValue - Math.abs(currentQty);
  const positionPnl = snapshot?.position?.unrealizedPl ?? activePosition?.unrealizedPl ?? initialPnl;
  const healthScore = getHealthScore(snapshot, positionPnl);
  const healthLabel = getHealthLabel(healthScore);
  const primaryCommand = getPrimaryCommand(activeController);
  const turboContracts = buildTurboContracts({
    symbol: normalizedSymbol || "SPY",
    latestPrice: snapshot?.latestPrice ?? activePosition?.avgEntryPrice ?? 500,
    bias,
    targetDelta: deltaTarget,
    dte: daysToExpiry,
  });

  async function handleControllerCommand(command: "PLAY" | "PAUSE" | "RESUME" | "EJECT") {
    setError("");
    setActionNotice("");
    setIsBusy(true);

    startTransition(async () => {
      try {
        const result: ControllerResult = await runAlpacaTradeController({
          symbol: normalizedSymbol,
          command,
          targetQty: Math.max(targetQtyValue, minimumTargetQty),
          strategyType: activeController?.strategyType ?? "NONE",
          strategyTimeframe: activeController?.strategyTimeframe ?? "1Min",
          fastPeriod: activeController?.fastPeriod ?? 5,
          slowPeriod: activeController?.slowPeriod ?? 20,
          bollingerLength: activeController?.bollingerLength ?? 20,
          bollingerStdDev: activeController?.bollingerStdDev ?? 2,
          maxNotional: activeController?.maxNotional ?? 100,
          maxDailyLoss: activeController?.maxDailyLoss ?? 25,
        });

        setSnapshot(result.snapshot);
        setActionNotice(result.actionSummary);
        setControllers((current) => {
          const next = current.filter((controller) => controller.symbol !== result.controller?.symbol);
          return result.controller ? [result.controller, ...next] : next;
        });
        setPositions((current) => {
          const next = current.filter((position) => position.symbol !== normalizedSymbol);
          const snapshotPosition = result.snapshot.position;

          if (!snapshotPosition || snapshotPosition.qty === 0) {
            return next;
          }

          return [
            {
              symbol: normalizedSymbol,
              qty: snapshotPosition.qty,
              availableQty: snapshotPosition.qty,
              heldForOrdersQty: 0,
              marketValue: snapshotPosition.marketValue,
              avgEntryPrice: snapshotPosition.avgEntryPrice,
              side: snapshotPosition.qty >= 0 ? "long" : "short",
              unrealizedPl: snapshotPosition.unrealizedPl,
            },
            ...next,
          ];
        });
        router.refresh();
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "Unable to run the controller command right now.",
        );
      } finally {
        setIsBusy(false);
      }
    });
  }

  return (
    <section className="algo-v2-shell">
      <div className="algo-v2-stage">
        <div className="algo-v2-topbar">
          <div className="algo-v2-topbar-left">
            <div className="algo-v2-symbol-badge">{normalizedSymbol || "--"}</div>
            <div>
              <h2 className="algo-v2-title">{normalizedSymbol || "Market"} Controller</h2>
              <p className="algo-v2-subtitle">
                <span className="algo-v2-dot is-green" /> Market Open
                <span className="algo-v2-dot is-blue" /> Trading
              </p>
            </div>
          </div>
          <div className="algo-v2-topbar-right">
            <span className="algo-v2-pnl-label">P&amp;L</span>
            <strong className={positionPnl >= 0 ? "algo-v2-pnl is-positive" : "algo-v2-pnl is-negative"}>
              {formatSignedMoney(positionPnl)}
            </strong>
          </div>
        </div>

        <div className="algo-v2-controls-row">
          <label className="algo-v2-field">
            <span className="algo-v2-field-label">Market Ticker</span>
            <input
              className="form-input"
              value={symbol}
              list="algo-v2-market-suggestions"
              placeholder="SPY or BTC/USD"
              onChange={(event) => setSymbol(normalizeMarketInput(event.target.value))}
            />
            <datalist id="algo-v2-market-suggestions">
              {suggestedSymbols.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>

          <label className="algo-v2-field">
            <span className="algo-v2-field-label">
              Target Position Size {isCrypto ? "(units)" : "(shares)"}
            </span>
            <input
              className="form-input"
              inputMode={isCrypto ? "decimal" : "numeric"}
              value={targetSize}
              onChange={(event) => setTargetSize(event.target.value)}
              placeholder={isCrypto ? "0.50" : "10"}
            />
          </label>

          <div className="algo-v2-mode-toggle" role="tablist" aria-label="Controller mode">
            <button
              type="button"
              className={mode === "standard" ? "algo-v2-mode-button is-active is-standard" : "algo-v2-mode-button"}
              onClick={() => setMode("standard")}
            >
              Standard
            </button>
            <button
              type="button"
              className={mode === "turbo" ? "algo-v2-mode-button is-active is-turbo" : "algo-v2-mode-button"}
              onClick={() => setMode("turbo")}
            >
              Turbo
              <span className="algo-v2-mode-tag">Advanced</span>
            </button>
          </div>
        </div>

        {mode === "standard" ? (
          <div className="algo-v2-panel-grid">
            <section className="algo-v2-main-card">
              <div className="algo-v2-panel-heading">
                <div className="algo-v2-panel-icon is-standard">S</div>
                <div>
                  <h3 className="algo-v2-panel-title">Standard Mode</h3>
                  <p className="algo-v2-panel-copy">
                    Simple, fast position control for stocks and ETFs.
                  </p>
                </div>
              </div>

              <div className="algo-v2-gauge-shell">
                <div className="algo-v2-gauge-arc" />
                <div
                  className="algo-v2-gauge-needle"
                  style={{ transform: `translateX(-50%) rotate(${healthScore * 1.8 - 90}deg)` }}
                />
                <div className="algo-v2-gauge-core" />
              </div>

              <div className="algo-v2-health-summary">
                <strong className={`algo-v2-health-value ${getHealthTone(healthScore)}`}>
                  Trade Health: {healthLabel}
                </strong>
                <p>{snapshot?.signal.reason || "Waiting for a fresh reading from the algo snapshot."}</p>
              </div>

              <div className="algo-v2-slider-card">
                <div className="algo-v2-slider-header">
                  <strong>Sizing Lever</strong>
                  <strong>
                    {targetQtyValue > 0 ? formatNumber(targetQtyValue, isCrypto ? 2 : 0) : "--"}{" "}
                    {isCrypto ? "units" : "shares"}
                  </strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max={targetSliderMax}
                  step={targetSliderStep}
                  value={targetQtyValue}
                  onChange={(event) => setTargetSize(event.target.value)}
                  className="algo-v2-range"
                />
                <div className="algo-v2-slider-scale">
                  <span>Smaller</span>
                  <span>
                    Current: {formatNumber(Math.abs(currentQty), isCrypto ? 2 : 0)}{" "}
                    {isCrypto ? "units" : "shares"}
                  </span>
                  <span>Larger</span>
                </div>
              </div>

              <div className="algo-v2-stat-row">
                <div>
                  <span className="algo-v2-stat-label">Pending Change</span>
                  <strong className={pendingChange >= 0 ? "is-positive" : "is-negative"}>
                    {pendingChange >= 0 ? "+" : ""}
                    {formatNumber(pendingChange, isCrypto ? 2 : 0)} {isCrypto ? "units" : "shares"}
                  </strong>
                </div>
                <div>
                  <span className="algo-v2-stat-label">Current Position</span>
                  <strong>
                    {formatNumber(currentQty, isCrypto ? 4 : 0)} {isCrypto ? "units" : "shares"}
                  </strong>
                </div>
                <div>
                  <span className="algo-v2-stat-label">Signal Freshness</span>
                  <strong>{formatSignalAge(snapshot?.signalAgeSeconds ?? null)}</strong>
                </div>
              </div>
            </section>

            <aside className="algo-v2-side-card">
              <h3 className="algo-v2-mini-title">Trade Setup</h3>
              <div className="algo-v2-mini-list">
                <div>
                  <span>Selected market</span>
                  <strong>{normalizedSymbol || "--"}</strong>
                </div>
                <div>
                  <span>Selected size</span>
                  <strong>
                    {targetQtyValue > 0 ? formatNumber(targetQtyValue, isCrypto ? 2 : 0) : "--"}{" "}
                    {isCrypto ? "units" : "shares"}
                  </strong>
                </div>
                <div>
                  <span>Latest price</span>
                  <strong>{snapshot ? formatMoney(snapshot.latestPrice) : "--"}</strong>
                </div>
                <div>
                  <span>Price change</span>
                  <strong>{formatPercent(snapshot?.priceChangePercent ?? null)}</strong>
                </div>
                <div>
                  <span>Relative volume</span>
                  <strong>{formatRelativeVolume(snapshot?.relativeVolume ?? null)}</strong>
                </div>
                <div>
                  <span>Controller state</span>
                  <strong>{activeController?.status ?? "UNSET"}</strong>
                </div>
                <div>
                  <span>Daily P&amp;L</span>
                  <strong>{snapshot ? formatSignedMoney(snapshot.dailyPnL) : "--"}</strong>
                </div>
                <div>
                  <span>Signal time</span>
                  <strong>{formatTimestamp(snapshot?.latestTradeTimestamp ?? null)}</strong>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="algo-v2-panel-grid">
            <section className="algo-v2-main-card">
              <div className="algo-v2-panel-heading">
                <div className="algo-v2-panel-icon is-turbo">T</div>
                <div>
                  <h3 className="algo-v2-panel-title">Turbo Mode</h3>
                  <p className="algo-v2-panel-copy">
                    Precision options control using directional bias, target delta, and time horizon.
                  </p>
                </div>
              </div>

              <div className="algo-v2-health-meter-card">
                <p className="algo-v2-meter-label">Underlying Trade Health</p>
                <div className="algo-v2-health-meter">
                  <div className="algo-v2-health-meter-track" />
                  <div
                    className="algo-v2-health-meter-thumb"
                    style={{ left: `${healthScore}%` }}
                  />
                </div>
                <div className="algo-v2-health-meter-scale">
                  <span>Low</span>
                  <span>Trade Health Meter</span>
                  <span>High</span>
                </div>
              </div>

              <div className="algo-v2-health-callout">
                <strong className={getHealthTone(healthScore)}>{healthLabel}</strong>
                <p>{snapshot?.signal.reason || "Market conditions are still being assessed."}</p>
              </div>

              <div className="algo-v2-bias-row">
                <h4 className="algo-v2-mini-title">Directional Bias</h4>
                <div className="algo-v2-bias-buttons">
                  <button
                    type="button"
                    className={getBiasButtonClass(bias, "bearish")}
                    onClick={() => setBias("bearish")}
                  >
                    Bearish
                  </button>
                  <button
                    type="button"
                    className={getBiasButtonClass(bias, "neutral")}
                    onClick={() => setBias("neutral")}
                  >
                    Neutral
                  </button>
                  <button
                    type="button"
                    className={getBiasButtonClass(bias, "bullish")}
                    onClick={() => setBias("bullish")}
                  >
                    Bullish
                  </button>
                </div>
              </div>

              <div className="algo-v2-turbo-grid">
                <div className="algo-v2-slider-card">
                  <div className="algo-v2-slider-header">
                    <strong>Delta Target</strong>
                    <strong>{deltaTarget.toFixed(2)}</strong>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="60"
                    value={Math.round(deltaTarget * 100)}
                    onChange={(event) => setDeltaTarget(Number(event.target.value) / 100)}
                    className="algo-v2-range"
                  />
                  <div className="algo-v2-slider-scale">
                    <span>0.20</span>
                    <span>{Math.round(deltaTarget * 100)} Delta</span>
                    <span>0.60</span>
                  </div>
                </div>

                <div className="algo-v2-slider-card">
                  <div className="algo-v2-slider-header">
                    <strong>Time Horizon</strong>
                    <strong>{formatDteLabel(daysToExpiry)}</strong>
                  </div>
                  <input
                    type="range"
                    min="7"
                    max="60"
                    value={daysToExpiry}
                    onChange={(event) => setDaysToExpiry(Number(event.target.value))}
                    className="algo-v2-range is-purple"
                  />
                  <div className="algo-v2-slider-scale">
                    <span>7</span>
                    <span>Days to expiration</span>
                    <span>60</span>
                  </div>
                </div>
              </div>
            </section>

            <aside className="algo-v2-side-card">
              <h3 className="algo-v2-mini-title">Suggested Contracts</h3>
              <div className="algo-v2-mini-list">
                <div>
                  <span>Price change</span>
                  <strong>{formatPercent(snapshot?.priceChangePercent ?? null)}</strong>
                </div>
                <div>
                  <span>Relative volume</span>
                  <strong>{formatRelativeVolume(snapshot?.relativeVolume ?? null)}</strong>
                </div>
                <div>
                  <span>Signal freshness</span>
                  <strong>{formatSignalAge(snapshot?.signalAgeSeconds ?? null)}</strong>
                </div>
              </div>
              <div className="algo-v2-contract-list">
                {turboContracts.map((contract) => (
                  <article key={contract.id} className="algo-v2-contract-card">
                    <strong>{contract.label}</strong>
                    <span>Delta {contract.delta > 0 ? "+" : ""}{contract.delta.toFixed(2)}</span>
                    <span>Mark {formatMoney(contract.mark)}</span>
                    <span>Spread {contract.spread}</span>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        )}

        <div className="algo-v2-actions">
          <button
            type="button"
            className={primaryCommand.tone}
            onClick={() => handleControllerCommand(primaryCommand.command)}
            disabled={isBusy}
          >
            <span className="algo-v2-action-label">{primaryCommand.label}</span>
            <span className="algo-v2-action-copy">{primaryCommand.helper}</span>
          </button>
          <button
            type="button"
            className="algo-v2-action-button is-danger"
            onClick={() => handleControllerCommand("EJECT")}
            disabled={isBusy}
          >
            <span className="algo-v2-action-label">Eject</span>
            <span className="algo-v2-action-copy">Exit and flatten the current controller cycle.</span>
          </button>
        </div>

        {actionNotice ? <p className="form-help">{actionNotice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}
