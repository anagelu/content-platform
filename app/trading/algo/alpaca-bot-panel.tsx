"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TradingChartView } from "@/app/trading/chart/trading-chart-view";
import {
  getAlpacaAlgoSnapshot,
  runAlpacaAutomationNow,
  submitAlpacaPaperOrder,
  runAlpacaTradeController,
} from "./actions";
import type { AlpacaTradeController } from "@/lib/alpaca-trade-controller";

type Snapshot = Awaited<ReturnType<typeof getAlpacaAlgoSnapshot>>;
type OrderResult = Awaited<ReturnType<typeof submitAlpacaPaperOrder>>;
type ControllerResult = Awaited<ReturnType<typeof runAlpacaTradeController>>;
type AutomationCycleResult = Awaited<ReturnType<typeof runAlpacaAutomationNow>>;
type SupportedAssetClass = "stocks" | "crypto" | "forex";
type StrategyType = "NONE" | "SMA" | "EMA" | "BOLLINGER";
type StrategyTimeframe = "1Min" | "5Min" | "15Min" | "30Min" | "1Hour" | "1Day" | "1Week";
const CRYPTO_MIN_ORDER_VALUE_USD = 10;
const STRATEGY_TIMEFRAME_OPTIONS: Array<{
  value: StrategyTimeframe;
  label: string;
  chartValue: string;
}> = [
  { value: "1Min", label: "1 Minute", chartValue: "1m" },
  { value: "5Min", label: "5 Minutes", chartValue: "5m" },
  { value: "15Min", label: "15 Minutes", chartValue: "15m" },
  { value: "30Min", label: "30 Minutes", chartValue: "30m" },
  { value: "1Hour", label: "1 Hour", chartValue: "1h" },
  { value: "1Day", label: "1 Day", chartValue: "1d" },
  { value: "1Week", label: "1 Week", chartValue: "1W" },
];

const STRATEGY_DESCRIPTIONS: Record<
  StrategyType,
  {
    title: string;
    description: string;
  }
> = {
  NONE: {
    title: "Manual execution mode",
    description:
      "No strategy means the controller does not wait for an indicator signal. It follows your commands directly, which is useful if you want to manually decide when to enter and exit.",
  },
  SMA: {
    title: "Simple moving average crossover",
    description:
      "SMA compares a faster moving average with a slower one. A bullish setup appears when the shorter average climbs above the longer one, which can suggest momentum is improving.",
  },
  EMA: {
    title: "Exponential moving average alignment",
    description:
      "EMA reacts faster to recent price than SMA. This mode watches for a fast EMA to stay above or below a slower EMA so the controller can follow momentum shifts more quickly.",
  },
  BOLLINGER: {
    title: "Bollinger Bands mean-reversion",
    description:
      "Bollinger Bands wrap around price using volatility. Traders often watch the lower band for potentially oversold conditions and the upper band for stretched conditions that may be due for a pullback.",
  },
};

const commonCryptoBases = new Set([
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

function inferAssetClass(symbol: string): SupportedAssetClass {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.includes("/") || commonCryptoBases.has(normalized)) {
    return "crypto";
  }

  return "stocks";
}

function inferCryptoQuote(symbol: string) {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.endsWith("/USDT")) {
    return "USDT";
  }

  if (normalized.endsWith("/USDC")) {
    return "USDC";
  }

  return "USD";
}

function inferBaseSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.includes("/")) {
    return normalized.split("/")[0] || "";
  }

  if (normalized.endsWith("USDT")) {
    return normalized.slice(0, -4);
  }

  if (normalized.endsWith("USDC")) {
    return normalized.slice(0, -4);
  }

  if (normalized.endsWith("USD") && normalized.length > 3) {
    return normalized.slice(0, -3);
  }

  return normalized;
}

function buildEffectiveSymbol({
  assetClass,
  baseSymbol,
  cryptoQuote,
}: {
  assetClass: SupportedAssetClass;
  baseSymbol: string;
  cryptoQuote: string;
}) {
  const normalizedBase = baseSymbol.trim().toUpperCase();

  if (!normalizedBase) {
    return "";
  }

  if (assetClass === "crypto") {
    return `${normalizedBase}/${cryptoQuote}`;
  }

  return normalizedBase;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
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

  const month = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "America/Los_Angeles",
  });
  const day = date.toLocaleString("en-US", {
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  });

  return `${month} ${day} at ${time}`;
}

function formatOrderStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatStrategyLabel(strategyType: StrategyType | Snapshot["strategyType"]) {
  if (strategyType === "BOLLINGER") {
    return "Bollinger Bands";
  }

  if (strategyType === "EMA") {
    return "EMA";
  }

  if (strategyType === "SMA") {
    return "SMA";
  }

  return "No Strategy";
}

function getStrategyDescription(
  strategyType: StrategyType,
) {
  return STRATEGY_DESCRIPTIONS[strategyType];
}

function formatSize(value: number) {
  if (value >= 1) {
    return value.toFixed(4).replace(/\.?0+$/, "");
  }

  return value.toFixed(6).replace(/\.?0+$/, "");
}

function getSignalTone(action: Snapshot["signal"]["action"]) {
  switch (action) {
    case "buy":
      return {
        label: "Buy bias",
        style: {
          background: "#ecfdf3",
          color: "#166534",
          border: "1px solid #bbf7d0",
        },
      };
    case "sell":
      return {
        label: "Sell bias",
        style: {
          background: "#fef2f2",
          color: "#b91c1c",
          border: "1px solid #fecaca",
        },
      };
    default:
      return {
        label: "Hold bias",
        style: {
          background: "#f8edd7",
          color: "#7c4f18",
          border: "1px solid #ddc8a7",
        },
      };
  }
}

function getControllerCommandTone({
  command,
  controllerStatus,
  lastCommand,
  lastOrderStatus,
}: {
  command: "PLAY" | "PAUSE" | "RESUME" | "EJECT";
  controllerStatus: AlpacaTradeController["status"] | null;
  lastCommand: string | null;
  lastOrderStatus: string | null;
}) {
  const isPending =
    lastOrderStatus !== null &&
    !["filled", "canceled", "expired", "rejected", "done_for_day"].includes(
      lastOrderStatus,
    );

  if (isPending) {
    return "controller-button controller-button-pending";
  }

  if (
    command === "PLAY" &&
    controllerStatus === "ACTIVE" &&
    lastCommand === "PLAY"
  ) {
    return "controller-button controller-button-active";
  }

  if (
    command === "RESUME" &&
    controllerStatus === "ACTIVE" &&
    lastCommand === "RESUME"
  ) {
    return "controller-button controller-button-resumed";
  }

  if (
    command === "PAUSE" &&
    controllerStatus === "PAUSED" &&
    lastCommand === "PAUSE"
  ) {
    return "controller-button controller-button-paused-active";
  }

  if (
    command === "EJECT" &&
    controllerStatus === "EJECTED" &&
    lastCommand === "EJECT"
  ) {
    return "controller-button controller-button-ejected";
  }

  if (command === "EJECT") {
    return "controller-button controller-button-eject";
  }

  return "controller-button";
}

function getControllerCommandBadge({
  command,
  controllerStatus,
  lastCommand,
  lastOrderStatus,
}: {
  command: "PLAY" | "PAUSE" | "RESUME" | "EJECT";
  controllerStatus: AlpacaTradeController["status"] | null;
  lastCommand: string | null;
  lastOrderStatus: string | null;
}) {
  const isPending =
    lastOrderStatus !== null &&
    !["filled", "canceled", "expired", "rejected", "done_for_day"].includes(
      lastOrderStatus,
    );

  if (isPending) {
    return "Pending";
  }

  if (
    command === "PLAY" &&
    controllerStatus === "ACTIVE" &&
    lastCommand === "PLAY"
  ) {
    return "Active";
  }

  if (
    command === "RESUME" &&
    controllerStatus === "ACTIVE" &&
    lastCommand === "RESUME"
  ) {
    return "Resumed";
  }

  if (
    command === "PAUSE" &&
    controllerStatus === "PAUSED" &&
    lastCommand === "PAUSE"
  ) {
    return "Paused";
  }

  if (
    command === "EJECT" &&
    controllerStatus === "EJECTED" &&
    lastCommand === "EJECT"
  ) {
    return "Ejected";
  }

  return null;
}

function formatUnitsLabel(isCrypto: boolean, quantity: string) {
  const normalizedQuantity = quantity.trim() || "--";
  return `${normalizedQuantity} ${isCrypto ? "units" : "shares"}`;
}

function formatFilledExecution(order?: {
  filledQty?: number | null;
  filledAvgPrice?: number | null;
  status: string;
}) {
  if (!order) {
    return null;
  }

  if (order.filledQty && order.filledAvgPrice) {
    return `${order.filledQty} filled at ${formatMoney(order.filledAvgPrice)}`;
  }

  return `latest order status ${formatOrderStatus(order.status)}`;
}

export function AlpacaBotPanel({
  initialSymbol = "SPY",
  initialControllers = [],
}: {
  initialSymbol?: string;
  initialControllers?: AlpacaTradeController[];
}) {
  const router = useRouter();
  const [assetClass, setAssetClass] = useState<SupportedAssetClass>(
    inferAssetClass(initialSymbol),
  );
  const [baseSymbol, setBaseSymbol] = useState(inferBaseSymbol(initialSymbol));
  const [cryptoQuote, setCryptoQuote] = useState(inferCryptoQuote(initialSymbol));
  const [quantity, setQuantity] = useState("1");
  const [strategyType, setStrategyType] = useState<StrategyType>("NONE");
  const [strategyTimeframe, setStrategyTimeframe] =
    useState<StrategyTimeframe>("1Min");
  const [fastPeriod, setFastPeriod] = useState("5");
  const [slowPeriod, setSlowPeriod] = useState("20");
  const [bollingerLength, setBollingerLength] = useState("20");
  const [bollingerStdDev, setBollingerStdDev] = useState("2");
  const [maxNotional, setMaxNotional] = useState("100");
  const [maxDailyLoss, setMaxDailyLoss] = useState("25");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lastOrder, setLastOrder] = useState<OrderResult["order"] | null>(null);
  const [controllers, setControllers] =
    useState<AlpacaTradeController[]>(initialControllers);
  const [lastControllerAction, setLastControllerAction] =
    useState<ControllerResult | null>(null);
  const [lastAutomationCycle, setLastAutomationCycle] =
    useState<AutomationCycleResult | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const symbol = buildEffectiveSymbol({
    assetClass,
    baseSymbol,
    cryptoQuote,
  });
  const isCrypto = assetClass === "crypto";
  const strategyDescription = getStrategyDescription(strategyType);
  const selectedStrategyTimeframe =
    STRATEGY_TIMEFRAME_OPTIONS.find((option) => option.value === strategyTimeframe) ??
    STRATEGY_TIMEFRAME_OPTIONS[0];

  useEffect(() => {
    setSnapshot(null);
    setLastOrder(null);
    setLastControllerAction(null);
    setActionNotice("");
    setError("");
  }, [symbol]);

  const handleCheck = () => {
    if (assetClass === "forex") {
      setError("Forex is not wired into this Alpaca trading workflow yet.");
      return;
    }

    setError("");
    setActionNotice("");
    setIsLoading(true);

    startTransition(async () => {
      try {
        const result = await getAlpacaAlgoSnapshot({
          symbol,
          strategyType,
          strategyTimeframe,
          fastPeriod: Number(fastPeriod),
          slowPeriod: Number(slowPeriod),
          bollingerLength: Number(bollingerLength),
          bollingerStdDev: Number(bollingerStdDev),
          maxNotional: Number(maxNotional),
          maxDailyLoss: Number(maxDailyLoss),
        });

        setSnapshot(result);
      } catch (actionError) {
        setSnapshot(null);
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Unable to load the Alpaca strategy snapshot right now.",
        );
      } finally {
        setIsLoading(false);
      }
    });
  };

  const signalTone = snapshot ? getSignalTone(snapshot.signal.action) : null;
  const activeController =
    controllers.find((controller) => controller.symbol === symbol) ?? null;
  const controllerStatus = activeController?.status ?? null;
  const controllerLastCommand = activeController?.lastCommand ?? null;
  const numericQuantity = Number(quantity);
  const estimatedOrderValue =
    snapshot && snapshot.symbol === symbol && Number.isFinite(numericQuantity)
      ? snapshot.latestPrice * numericQuantity
      : null;
  const cryptoOrderTooSmall =
    isCrypto &&
    estimatedOrderValue !== null &&
    estimatedOrderValue < CRYPTO_MIN_ORDER_VALUE_USD;
  const suggestedCryptoQuantity =
    isCrypto && snapshot && snapshot.symbol === symbol && snapshot.latestPrice > 0
      ? Number((CRYPTO_MIN_ORDER_VALUE_USD / snapshot.latestPrice).toFixed(6))
      : null;
  const latestKnownOrderStatus =
    lastControllerAction?.controller?.symbol === symbol
      ? lastControllerAction.orders.at(-1)?.status ?? null
      : lastOrder?.symbol === symbol
        ? lastOrder.status
        : null;
  const latestControllerOrder =
    lastControllerAction?.controller?.symbol === symbol
      ? lastControllerAction.orders.at(-1) ?? null
      : null;
  const currentPositionQty = snapshot?.position?.qty ?? 0;
  const commandSizeLabel = formatUnitsLabel(isCrypto, quantity);
  const estimatedEntryValueLabel =
    estimatedOrderValue !== null ? formatMoney(estimatedOrderValue) : null;
  const playDescription =
    controllerStatus === "ACTIVE" && controllerLastCommand === "PLAY"
      ? `Active now for ${symbol || "this symbol"}. ${
          latestControllerOrder
            ? `Initial entry ${formatFilledExecution(latestControllerOrder)}.`
            : `Controller is armed for ${commandSizeLabel}.`
        }`
      : strategyType === "NONE"
        ? `Buy ${commandSizeLabel} of ${symbol || "this symbol"} now${
            estimatedEntryValueLabel ? `, about ${estimatedEntryValueLabel} total,` : ""
          } and move the controller into active mode.`
        : `Arm ${symbol || "this symbol"} on ${selectedStrategyTimeframe.label.toLowerCase()} bars for ${commandSizeLabel} and wait for a ${
            formatStrategyLabel(strategyType).toLowerCase()
          } buy signal before entering${
            estimatedEntryValueLabel
              ? `, with an estimated size near ${estimatedEntryValueLabel}`
              : ""
          }.`;
  const pauseDescription =
    controllerStatus === "PAUSED" && controllerLastCommand === "PAUSE"
      ? `Paused now. ${
          latestControllerOrder
            ? `Exit order ${formatFilledExecution(latestControllerOrder)}.`
            : "The controller is on standby with no new entries."
        } Press Resume when you want it to become active again.`
      : currentPositionQty > 0
        ? `Exit the current ${symbol || "position"} holding of ${currentPositionQty} ${
            isCrypto ? "units" : "shares"
          } for now, then keep the controller on standby. If you want back in later, press Resume.`
        : `Put the controller on standby without fully deleting the idea. If a position is open later, Pause will flatten it temporarily and let you Resume afterward.`;
  const resumeDescription =
    controllerStatus === "ACTIVE" && controllerLastCommand === "RESUME"
      ? `Resumed and back in active mode for ${symbol || "this symbol"}. ${
          latestControllerOrder
            ? `Re-entry ${formatFilledExecution(latestControllerOrder)}.`
            : "The controller is waiting for the next valid entry condition."
        }`
      : strategyType === "NONE"
        ? `Turn the controller back on and re-enter ${symbol || "the symbol"} using ${commandSizeLabel} right away${
            estimatedEntryValueLabel ? `, about ${estimatedEntryValueLabel} total` : ""
          }.`
        : `Turn the controller back on and allow it to re-enter ${symbol || "the symbol"} on ${selectedStrategyTimeframe.label.toLowerCase()} bars with ${commandSizeLabel} when the current ${formatStrategyLabel(
            strategyType,
          ).toLowerCase()} signal says buy.`;
  const ejectDescription =
    controllerStatus === "EJECTED" && controllerLastCommand === "EJECT"
      ? `Ejected. ${symbol || "This symbol"} is fully shut down in the controller${
          latestControllerOrder
            ? `, and the closing order was ${formatFilledExecution(latestControllerOrder)}`
            : ""
        }. Press Play to start a brand new cycle later.`
      : currentPositionQty > 0
        ? `Fully close the current ${symbol || "position"} position and end this controller cycle so it will not re-enter automatically. Use Play to start over later.`
        : `Terminate this controller cycle entirely so ${symbol || "this symbol"} stays inactive until you explicitly press Play again.`;
  const playTone = getControllerCommandTone({
    command: "PLAY",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });
  const pauseTone = getControllerCommandTone({
    command: "PAUSE",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });
  const resumeTone = getControllerCommandTone({
    command: "RESUME",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });
  const ejectTone = getControllerCommandTone({
    command: "EJECT",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });
  const playBadge = getControllerCommandBadge({
    command: "PLAY",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });
  const pauseBadge = getControllerCommandBadge({
    command: "PAUSE",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });
  const resumeBadge = getControllerCommandBadge({
    command: "RESUME",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });
  const ejectBadge = getControllerCommandBadge({
    command: "EJECT",
    controllerStatus,
    lastCommand: controllerLastCommand,
    lastOrderStatus: latestKnownOrderStatus,
  });

  const handleManualOrder = (side: "buy" | "sell") => {
    if (assetClass === "forex") {
      setError("Forex is not wired into this Alpaca trading workflow yet.");
      return;
    }

    setError("");
    setActionNotice("");
    setIsSubmittingOrder(true);

    startTransition(async () => {
      try {
        const result = await submitAlpacaPaperOrder({
          symbol,
          qty: Number(quantity),
          side,
          strategyType,
          strategyTimeframe,
          fastPeriod: Number(fastPeriod),
          slowPeriod: Number(slowPeriod),
          bollingerLength: Number(bollingerLength),
          bollingerStdDev: Number(bollingerStdDev),
          maxNotional: Number(maxNotional),
          maxDailyLoss: Number(maxDailyLoss),
        });

        setLastOrder(result.order);
        setSnapshot(result.snapshot);
        setActionNotice(
          `Manual ${side} submitted for ${result.order.symbol}. Current status: ${formatOrderStatus(result.order.status)}.`,
        );
        router.refresh();
        if (!result.reachedFinalState) {
          setError(
            `Order submitted, but fill confirmation is still pending. Current Alpaca status: ${formatOrderStatus(result.order.status)}.`,
          );
        }
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Unable to submit the Alpaca paper order right now.",
        );
      } finally {
        setIsSubmittingOrder(false);
      }
    });
  };

  const handleControllerCommand = (
    command: "PLAY" | "PAUSE" | "RESUME" | "EJECT",
  ) => {
    if (assetClass === "forex") {
      setError("Forex is not wired into this Alpaca trading workflow yet.");
      return;
    }

    setError("");
    setActionNotice("");
    setIsSubmittingOrder(true);

    startTransition(async () => {
      try {
        const result = await runAlpacaTradeController({
          symbol,
          command,
          targetQty: Number(quantity),
          strategyType,
          strategyTimeframe,
          fastPeriod: Number(fastPeriod),
          slowPeriod: Number(slowPeriod),
          bollingerLength: Number(bollingerLength),
          bollingerStdDev: Number(bollingerStdDev),
          maxNotional: Number(maxNotional),
          maxDailyLoss: Number(maxDailyLoss),
        });

        setSnapshot(result.snapshot);
        setLastControllerAction(result);
        setActionNotice(result.actionSummary);
        if (!result.reachedFinalState && result.orders.length > 0) {
          setError(
            `Controller command submitted orders, but final fill confirmation is still pending. Latest status: ${formatOrderStatus(result.orders[result.orders.length - 1].status)}.`,
          );
        }
        setControllers((current) => {
          const next = current.filter(
            (controller) => controller.symbol !== result.controller?.symbol,
          );

          return result.controller ? [result.controller, ...next] : next;
        });
        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Unable to run the trade controller command right now.",
        );
      } finally {
        setIsSubmittingOrder(false);
      }
    });
  };

  const handleAutomationCycle = () => {
    setError("");
    setActionNotice("");
    setIsSubmittingOrder(true);

    startTransition(async () => {
      try {
        const result = await runAlpacaAutomationNow();
        setLastAutomationCycle(result);
        setActionNotice(
          `Automation cycle processed ${result.processedControllers} active controllers and triggered ${result.executedOrders} orders.`,
        );
        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Unable to run the automation cycle right now.",
        );
      } finally {
        setIsSubmittingOrder(false);
      }
    });
  };

  return (
    <section className="card">
      <h2 className="trading-section-title">Trade Controller</h2>
      <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
        Start with just the market and position size. Advanced strategy and
        risk settings are still available, but they stay out of the way unless
        you want to tune them.
      </p>

      <div className="form-card controller-shell">
        <div className="trading-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="alpaca-asset-class">
              Market type
            </label>
            <select
              id="alpaca-asset-class"
              className="form-select"
              value={assetClass}
              onChange={(event) =>
                setAssetClass(event.target.value as SupportedAssetClass)
              }
            >
              <option value="stocks">Stocks</option>
              <option value="crypto">Crypto</option>
              <option value="forex">Forex (Not Yet Wired)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="alpaca-symbol">
              {isCrypto ? "Base symbol" : "Symbol"}
            </label>
            <input
              id="alpaca-symbol"
              className="form-input"
              value={baseSymbol}
              onChange={(event) => setBaseSymbol(event.target.value.toUpperCase())}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="alpaca-max-notional">
              Position size {isCrypto ? "(units)" : "(shares)"}
            </label>
            <input
              id="alpaca-quantity"
              className="form-input"
              inputMode={isCrypto ? "decimal" : "numeric"}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>

          {isCrypto ? (
            <div className="form-group">
              <label className="form-label" htmlFor="alpaca-crypto-quote">
                Quote currency
              </label>
              <select
                id="alpaca-crypto-quote"
                className="form-select"
                value={cryptoQuote}
                onChange={(event) => setCryptoQuote(event.target.value)}
              >
                <option value="USD">USD</option>
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          ) : null}

        </div>

        <div className="controller-status-strip">
          <div className="controller-status-card">
            <span className="trading-metric-label">Active market</span>
            <strong>{symbol || "--"}</strong>
          </div>
          <div className="controller-status-card">
            <span className="trading-metric-label">Controller state</span>
            <strong>{controllerStatus ?? "UNSET"}</strong>
          </div>
          <div className="controller-status-card">
            <span className="trading-metric-label">Latest order state</span>
            <strong>
              {latestKnownOrderStatus
                ? formatOrderStatus(latestKnownOrderStatus)
                : "None"}
            </strong>
          </div>
          <div className="controller-status-card">
            <span className="trading-metric-label">Strategy</span>
            <strong>{formatStrategyLabel(strategyType)}</strong>
          </div>
        </div>

        <div className="controller-command-deck">
          <button
            type="button"
            className={playTone}
            onClick={() => handleControllerCommand("PLAY")}
            disabled={isSubmittingOrder || cryptoOrderTooSmall}
          >
            {playBadge ? (
              <span className="controller-button-badge">{playBadge}</span>
            ) : null}
            <span className="controller-button-label">Play</span>
            <span className="controller-button-copy">{playDescription}</span>
          </button>
          <button
            type="button"
            className={pauseTone}
            onClick={() => handleControllerCommand("PAUSE")}
            disabled={isSubmittingOrder}
          >
            {pauseBadge ? (
              <span className="controller-button-badge">{pauseBadge}</span>
            ) : null}
            <span className="controller-button-label">Pause</span>
            <span className="controller-button-copy">{pauseDescription}</span>
          </button>
          <button
            type="button"
            className={resumeTone}
            onClick={() => handleControllerCommand("RESUME")}
            disabled={isSubmittingOrder || cryptoOrderTooSmall}
          >
            {resumeBadge ? (
              <span className="controller-button-badge">{resumeBadge}</span>
            ) : null}
            <span className="controller-button-label">Resume</span>
            <span className="controller-button-copy">{resumeDescription}</span>
          </button>
          <button
            type="button"
            className={ejectTone}
            onClick={() => handleControllerCommand("EJECT")}
            disabled={isSubmittingOrder}
          >
            {ejectBadge ? (
              <span className="controller-button-badge">{ejectBadge}</span>
            ) : null}
            <span className="controller-button-label">Eject</span>
            <span className="controller-button-copy">{ejectDescription}</span>
          </button>
        </div>

        <details className="card" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <summary className="tool-disclosure-summary">
            <div>
              <h3 className="card-title" style={{ marginBottom: "0.25rem" }}>
                Advanced Settings
              </h3>
              <p className="meta" style={{ margin: 0 }}>
                Optional strategy and risk inputs. The defaults stay active even
                if you never open this.
              </p>
            </div>
            <span className="tool-disclosure-hint">Open</span>
          </summary>

          <div style={{ marginTop: "1rem" }}>
            <div className="trading-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="alpaca-strategy-type">
                  Strategy
                </label>
                <select
                  id="alpaca-strategy-type"
                  className="form-select"
                  value={strategyType}
                  onChange={(event) =>
                    setStrategyType(event.target.value as StrategyType)
                  }
                >
                  <option value="NONE">No Strategy</option>
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                  <option value="BOLLINGER">Bollinger Bands</option>
                </select>
                <p className="form-help">
                  Choose the rule set the controller should use before it takes a
                  trade.
                </p>
                <div className="form-callout" style={{ marginBottom: 0 }}>
                  <h4 className="form-callout-title">{strategyDescription.title}</h4>
                  <p className="form-callout-text">{strategyDescription.description}</p>
                </div>
              </div>

              {strategyType === "NONE" ? null : (
                <div className="form-group">
                  <label className="form-label" htmlFor="alpaca-strategy-timeframe">
                    Strategy timeframe
                  </label>
                  <select
                    id="alpaca-strategy-timeframe"
                    className="form-select"
                    value={strategyTimeframe}
                    onChange={(event) =>
                      setStrategyTimeframe(event.target.value as StrategyTimeframe)
                    }
                  >
                    {STRATEGY_TIMEFRAME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="form-help">
                    This is the bar interval the automated strategy reads before it
                    decides to buy, sell, or hold.
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="alpaca-max-notional">
                  Max notional
                </label>
                <input
                  id="alpaca-max-notional"
                  className="form-input"
                  inputMode="decimal"
                  value={maxNotional}
                  onChange={(event) => setMaxNotional(event.target.value)}
                />
                <p className="form-help">
                  The most dollar exposure this controller is allowed to put into
                  the position. If you set `100`, it should not build a position
                  worth more than about $100.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="alpaca-max-daily-loss">
                  Max daily loss
                </label>
                <input
                  id="alpaca-max-daily-loss"
                  className="form-input"
                  inputMode="decimal"
                  value={maxDailyLoss}
                  onChange={(event) => setMaxDailyLoss(event.target.value)}
                />
                <p className="form-help">
                  Your daily stop limit. Once losses for the day reach this
                  amount, the controller should stop adding new risk so one bad
                  session does not spiral.
                </p>
              </div>

              {strategyType === "NONE" ? null : strategyType === "SMA" || strategyType === "EMA" ? (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="alpaca-fast-period">
                      Fast {strategyType}
                    </label>
                    <input
                      id="alpaca-fast-period"
                      className="form-input"
                      inputMode="numeric"
                      value={fastPeriod}
                      onChange={(event) => setFastPeriod(event.target.value)}
                    />
                    <p className="form-help">
                      The shorter lookback window. Smaller numbers react faster to
                      price but can give more false signals.
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="alpaca-slow-period">
                      Slow {strategyType}
                    </label>
                    <input
                      id="alpaca-slow-period"
                      className="form-input"
                      inputMode="numeric"
                      value={slowPeriod}
                      onChange={(event) => setSlowPeriod(event.target.value)}
                    />
                    <p className="form-help">
                      The slower trend reference. This should usually be larger
                      than the fast {strategyType} so you can compare short-term momentum
                      against the broader move.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="alpaca-bollinger-length">
                      Bollinger length
                    </label>
                    <input
                      id="alpaca-bollinger-length"
                      className="form-input"
                      inputMode="numeric"
                      value={bollingerLength}
                      onChange={(event) => setBollingerLength(event.target.value)}
                    />
                    <p className="form-help">
                      How many candles are used to build the band. A larger number
                      smooths the bands more, while a smaller number makes them
                      react faster.
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="alpaca-bollinger-stddev">
                      Bollinger std dev
                    </label>
                    <input
                      id="alpaca-bollinger-stddev"
                      className="form-input"
                      inputMode="decimal"
                      value={bollingerStdDev}
                      onChange={(event) => setBollingerStdDev(event.target.value)}
                    />
                    <p className="form-help">
                      How wide the bands sit from the average. Higher values make
                      the bands wider and require more extreme price movement
                      before a signal appears.
                    </p>
                  </div>
                </>
              )}
            </div>

            <p className="meta" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              {strategyType === "NONE"
                ? "No strategy mode keeps the controller fully manual. Play and Resume enter immediately, while Pause and Eject flatten or terminate."
                : strategyType === "BOLLINGER"
                ? `Bollinger mode watches ${selectedStrategyTimeframe.label.toLowerCase()} bars for buys near the lower band and exits near the upper band.`
                : strategyType === "EMA"
                ? `EMA mode watches ${selectedStrategyTimeframe.label.toLowerCase()} bars and buys when the fast EMA moves above the slow EMA, then exits when alignment breaks.`
                : `SMA mode watches ${selectedStrategyTimeframe.label.toLowerCase()} bars and buys when the fast average crosses above the slow average, then exits when momentum weakens.`}
            </p>
          </div>
        </details>

        {symbol ? (
          <div className="signal-chart-card" style={{ marginTop: "1rem" }}>
            <div className="signal-chart-header">
              <div>
                <h3 className="card-title" style={{ marginBottom: "0.35rem" }}>
                  Strategy Chart Preview
                </h3>
                <p className="meta" style={{ margin: 0 }}>
                  Live chart view for {symbol} with the selected strategy overlay.
                </p>
              </div>
            </div>

            <TradingChartView
              market={symbol}
              timeframe={selectedStrategyTimeframe.chartValue}
              compact
              indicator={{
                strategyType,
                fastPeriod: Number(fastPeriod),
                slowPeriod: Number(slowPeriod),
                bollingerLength: Number(bollingerLength),
                bollingerStdDev: Number(bollingerStdDev),
              }}
            />
          </div>
        ) : null}

        <div className="toolbar" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <button
            type="button"
            className="button-link"
            onClick={handleCheck}
            disabled={isLoading}
            style={{ border: 0, cursor: isLoading ? "progress" : "pointer" }}
          >
            {isLoading ? "Running check..." : "Run paper check"}
          </button>
          <button
            type="button"
            className="button-link"
            onClick={() => handleManualOrder("buy")}
            disabled={isSubmittingOrder || cryptoOrderTooSmall}
            style={{ border: 0, cursor: isSubmittingOrder ? "progress" : "pointer" }}
          >
            {isSubmittingOrder ? "Submitting..." : "Paper Buy"}
          </button>
          <button
            type="button"
            className="button-link secondary"
            onClick={handleAutomationCycle}
            disabled={isSubmittingOrder}
            style={{ cursor: isSubmittingOrder ? "progress" : "pointer" }}
          >
            {isSubmittingOrder ? "Submitting..." : "Run automation cycle"}
          </button>
          <button
            type="button"
            className="button-link secondary"
            onClick={() => handleManualOrder("sell")}
            disabled={isSubmittingOrder}
            style={{ cursor: isSubmittingOrder ? "progress" : "pointer" }}
          >
            {isSubmittingOrder ? "Submitting..." : "Paper Sell"}
          </button>
        </div>

        <p className="meta" style={{ marginTop: "1rem" }}>
          Trading symbol: <strong>{symbol || "--"}</strong>. Website execution
          is paper-only. The controller uses the configured position size as its
          target trade size for play and resume actions.
        </p>

        {isCrypto ? (
          <p className="meta" style={{ marginTop: "0.5rem" }}>
            Crypto orders use trading pairs like <strong>XRP/USD</strong>. Alpaca
            paper crypto also enforces a minimum order cost, so tiny sizes may
            be rejected until the estimated order value clears that threshold.
          </p>
        ) : null}

        {isCrypto && estimatedOrderValue !== null ? (
          <div
            className="card"
            style={{
              marginTop: "0.75rem",
              marginBottom: 0,
              background: cryptoOrderTooSmall ? "#fef2f2" : "#ecfdf3",
              borderColor: cryptoOrderTooSmall ? "#fecaca" : "#bbf7d0",
            }}
          >
            <p
              className="meta"
              style={{
                marginTop: 0,
                color: cryptoOrderTooSmall ? "#b91c1c" : "#166534",
              }}
            >
              Estimated crypto order value: <strong>{formatMoney(estimatedOrderValue)}</strong>
              {cryptoOrderTooSmall
                ? ` — increase size to at least ${formatMoney(CRYPTO_MIN_ORDER_VALUE_USD)} before Buy, Play, or Resume.`
                : " — order value clears the current minimum check."}
            </p>

            {cryptoOrderTooSmall && suggestedCryptoQuantity ? (
              <div className="toolbar" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                <button
                  type="button"
                  className="button-link secondary"
                  onClick={() => setQuantity(formatSize(suggestedCryptoQuantity))}
                  style={{ cursor: "pointer" }}
                >
                  Use Min Size {formatSize(suggestedCryptoQuantity)}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {assetClass === "forex" ? (
          <p className="meta" style={{ marginTop: "0.5rem", color: "#92400e" }}>
            Forex is not connected in this workflow yet. Stocks and crypto are
            the supported market types today.
          </p>
        ) : null}

        {activeController ? (
          <div className="card" style={{ marginTop: "1rem", marginBottom: 0 }}>
            <h3 className="card-title">Controller state</h3>
            <p className="meta">
              {activeController.symbol} · status {activeController.status}
            </p>
            <p className="meta">
              Target size {activeController.targetQty} · strategy{" "}
              {formatStrategyLabel(activeController.strategyType)}
            </p>
            <p className="meta">Timeframe {activeController.strategyTimeframe}</p>
            {activeController.strategyType === "BOLLINGER" ? (
              <p className="meta">
                Bands {activeController.bollingerLength} / {activeController.bollingerStdDev}
              </p>
            ) : activeController.strategyType === "SMA" ||
              activeController.strategyType === "EMA" ? (
              <p className="meta">
                {activeController.strategyType} {activeController.fastPeriod} / {activeController.slowPeriod}
              </p>
            ) : (
              <p className="meta">
                Manual controller mode with no automated entry signal.
              </p>
            )}
            <p className="meta">
              Last command {activeController.lastCommand ?? "--"} ·{" "}
              {formatTimestamp(activeController.lastCommandAt)}
            </p>
          </div>
        ) : null}

        {error ? (
          <p
            className="meta"
            style={{ marginTop: "1rem", color: "#b91c1c" }}
          >
            {error}
          </p>
        ) : null}

        {actionNotice ? (
          <p className="meta" style={{ marginTop: "1rem", color: "#166534" }}>
            {actionNotice}
          </p>
        ) : null}

        {lastOrder?.symbol === symbol ? (
          <div className="card" style={{ marginTop: "1rem", marginBottom: 0 }}>
            <h3 className="card-title">Last submitted order</h3>
            <p className="meta">
              {lastOrder.side.toUpperCase()} {lastOrder.symbol} x{" "}
              {lastOrder.qty ?? "--"}
            </p>
            <p className="meta">Status {formatOrderStatus(lastOrder.status)}</p>
            <p className="meta">Type {lastOrder.type}</p>
            <p className="meta">Client ID {lastOrder.clientOrderId}</p>
            <p className="meta">
              Filled avg{" "}
              {lastOrder.filledAvgPrice
                ? formatMoney(lastOrder.filledAvgPrice)
                : "Pending"}
            </p>
          </div>
        ) : null}

        {lastControllerAction?.controller?.symbol === symbol ? (
          <div className="card" style={{ marginTop: "1rem", marginBottom: 0 }}>
            <h3 className="card-title">Last controller action</h3>
            <p className="meta">
              Status {lastControllerAction.controller?.status ?? "--"} for{" "}
              {lastControllerAction.controller?.symbol ?? symbol}
            </p>
            <p className="meta">
              Orders triggered {lastControllerAction.orders.length}
            </p>
            <p className="meta">
              Signal before action: {lastControllerAction.preTradeSignal.reason}
            </p>
            {lastControllerAction.orders.map((order) => (
              <p key={order.id} className="meta">
                {order.side.toUpperCase()} {order.symbol} · {formatOrderStatus(order.status)} ·
                filled {order.filledQty ?? "--"} @{" "}
                {order.filledAvgPrice ? formatMoney(order.filledAvgPrice) : "Pending"}
              </p>
            ))}
          </div>
        ) : null}

        {lastAutomationCycle ? (
          <div className="card" style={{ marginTop: "1rem", marginBottom: 0 }}>
            <h3 className="card-title">Last automation cycle</h3>
            <p className="meta">
              Active controllers {lastAutomationCycle.activeControllers} · processed{" "}
              {lastAutomationCycle.processedControllers} · orders{" "}
              {lastAutomationCycle.executedOrders}
            </p>
            {lastAutomationCycle.results.slice(0, 6).map((result) => (
              <p key={`${result.controllerId}-${result.symbol}`} className="meta">
                {result.symbol} · {result.status} · {result.reason}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {snapshot && snapshot.symbol === symbol ? (
        <>
          <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Latest price</span>
              <strong>{formatMoney(snapshot.latestPrice)}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Daily PnL</span>
              <strong>{formatMoney(snapshot.dailyPnL)}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Environment</span>
              <strong>{snapshot.environment}</strong>
            </div>
          </div>

          {snapshot.strategyType === "BOLLINGER" &&
          snapshot.bollingerBasis !== null &&
          snapshot.bollingerLower !== null &&
          snapshot.bollingerUpper !== null ? (
            <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
              <div className="trading-metric-card">
                <span className="trading-metric-label">Band basis</span>
                <strong>{formatMoney(snapshot.bollingerBasis)}</strong>
              </div>
              <div className="trading-metric-card">
                <span className="trading-metric-label">Lower band</span>
                <strong>{formatMoney(snapshot.bollingerLower)}</strong>
              </div>
              <div className="trading-metric-card">
                <span className="trading-metric-label">Upper band</span>
                <strong>{formatMoney(snapshot.bollingerUpper)}</strong>
              </div>
            </div>
          ) : null}

          <div className="card" style={{ marginTop: "1rem", ...signalTone?.style }}>
            <h3 className="card-title" style={{ marginBottom: "0.35rem" }}>
              {signalTone?.label}
            </h3>
            <p className="preview" style={{ marginTop: 0 }}>
              {snapshot.signal.reason}
            </p>
          </div>

          <div className="trading-detail-grid">
            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Guardrails</h3>
              <p className="meta">Max notional {formatMoney(snapshot.maxNotional)}</p>
              <p className="meta">
                Max daily loss {formatMoney(snapshot.maxDailyLoss)}
              </p>
              <p className="meta">
                Strategy {formatStrategyLabel(snapshot.strategyType)}
              </p>
              <p className="meta">Timeframe {snapshot.timeframe}</p>
              {snapshot.strategyType === "BOLLINGER" ? (
                <p className="meta">
                  Bands {snapshot.bollingerLength} / {snapshot.bollingerStdDev}
                </p>
              ) : snapshot.strategyType === "SMA" || snapshot.strategyType === "EMA" ? (
                <p className="meta">
                  {snapshot.strategyType} settings {snapshot.fastPeriod} / {snapshot.slowPeriod}
                </p>
              ) : (
                <p className="meta">
                  Manual controller mode with no automated signal gating.
                </p>
              )}
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Market timestamps</h3>
              <p className="meta">
                Latest trade {formatTimestamp(snapshot.latestTradeTimestamp)}
              </p>
              <p className="meta">
                Latest quote {formatTimestamp(snapshot.quoteTimestamp)}
              </p>
              <p className="meta">
                Latest bar {formatTimestamp(snapshot.lastBarTimestamp)}
              </p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 className="card-title">Open position</h3>
            {snapshot.position ? (
              <>
                <p className="meta">Quantity {snapshot.position.qty}</p>
                <p className="meta">
                  Avg entry {formatMoney(snapshot.position.avgEntryPrice)}
                </p>
                <p className="meta">
                  Market value {formatMoney(snapshot.position.marketValue)}
                </p>
                <p className="meta">
                  Unrealized P/L {formatMoney(snapshot.position.unrealizedPl)}
                </p>
              </>
            ) : (
              <p className="meta">No open paper position for this symbol.</p>
            )}
          </div>

          {controllers.length > 0 ? (
            <div className="card" style={{ marginTop: "1rem", marginBottom: 0 }}>
              <h3 className="card-title">Tracked Controllers</h3>
              {controllers.map((controller) => (
                <p key={`${controller.symbol}-${controller.id}`} className="meta">
                  {controller.symbol} · {controller.status} · target {controller.targetQty} ·
                  last {controller.lastCommand ?? "--"}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
