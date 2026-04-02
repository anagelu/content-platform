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
type GaugeKey = "trend" | "momentum" | "execution" | "contractFitness";
type StrategyProfileKey = "trend-follow" | "breakout" | "mean-reversion";
type GaugeSubscore = { label: string; score: number };
type GaugeResult = {
  key: GaugeKey;
  label: string;
  score: number;
  band: string;
  tone: string;
  reason: string;
  subscores: GaugeSubscore[];
};
type ConfluenceModel = {
  gauges: GaugeResult[];
  overallScore: number | null;
  overallBand: string;
  overallTone: string;
  alignmentCount: number;
  alignmentLabel: string;
  reason: string;
  isReady: boolean;
};
type StrategyProfile = {
  label: string;
  description: string;
  overallWeights: Record<GaugeKey, number>;
  gaugeWeights: Record<GaugeKey, Record<string, number>>;
};
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
const STRATEGY_PROFILES: Record<StrategyProfileKey, StrategyProfile> = {
  "trend-follow": {
    label: "Trend-Follow",
    description: "Leans on persistent direction with clean participation and safer execution.",
    overallWeights: {
      trend: 0.34,
      momentum: 0.24,
      execution: 0.26,
      contractFitness: 0.16,
    },
    gaugeWeights: {
      trend: {
        emaAlignment: 0.34,
        vwap: 0.2,
        slope: 0.26,
        structure: 0.2,
      },
      momentum: {
        rsi: 0.18,
        macd: 0.34,
        roc: 0.22,
        candleExpansion: 0.26,
      },
      execution: {
        spreadQuality: 0.22,
        relativeVolume: 0.32,
        quoteStability: 0.22,
        slippageRisk: 0.24,
      },
      contractFitness: {
        delta: 0.2,
        gamma: 0.12,
        theta: 0.12,
        vega: 0.1,
        expirationFit: 0.22,
        openInterestSpread: 0.24,
      },
    },
  },
  breakout: {
    label: "Breakout",
    description: "Rewards expanding momentum, participation, and decisive execution conditions.",
    overallWeights: {
      trend: 0.26,
      momentum: 0.34,
      execution: 0.24,
      contractFitness: 0.16,
    },
    gaugeWeights: {
      trend: {
        emaAlignment: 0.24,
        vwap: 0.18,
        slope: 0.24,
        structure: 0.34,
      },
      momentum: {
        rsi: 0.16,
        macd: 0.26,
        roc: 0.24,
        candleExpansion: 0.34,
      },
      execution: {
        spreadQuality: 0.2,
        relativeVolume: 0.36,
        quoteStability: 0.16,
        slippageRisk: 0.28,
      },
      contractFitness: {
        delta: 0.24,
        gamma: 0.16,
        theta: 0.1,
        vega: 0.1,
        expirationFit: 0.18,
        openInterestSpread: 0.22,
      },
    },
  },
  "mean-reversion": {
    label: "Mean Reversion",
    description: "Favors stretched conditions reverting with controlled entries and tighter timing.",
    overallWeights: {
      trend: 0.22,
      momentum: 0.26,
      execution: 0.32,
      contractFitness: 0.2,
    },
    gaugeWeights: {
      trend: {
        emaAlignment: 0.18,
        vwap: 0.32,
        slope: 0.16,
        structure: 0.34,
      },
      momentum: {
        rsi: 0.34,
        macd: 0.18,
        roc: 0.26,
        candleExpansion: 0.22,
      },
      execution: {
        spreadQuality: 0.24,
        relativeVolume: 0.24,
        quoteStability: 0.28,
        slippageRisk: 0.24,
      },
      contractFitness: {
        delta: 0.16,
        gamma: 0.18,
        theta: 0.16,
        vega: 0.12,
        expirationFit: 0.22,
        openInterestSpread: 0.16,
      },
    },
  },
};

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

function getScoreTone(score: number) {
  if (score >= 80) {
    return "is-strong";
  }

  if (score >= 60) {
    return "is-positive";
  }

  if (score >= 40) {
    return "is-neutral";
  }

  return "is-negative";
}

function getScoreBand(score: number) {
  if (score >= 80) {
    return "Strong";
  }

  if (score >= 60) {
    return "Favorable";
  }

  if (score >= 40) {
    return "Mixed";
  }

  return "Weak";
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

function weightedScore(subscores: GaugeSubscore[], weights: Record<string, number>) {
  let totalWeight = 0;
  let total = 0;

  for (const subscore of subscores) {
    const weight = weights[subscore.label] ?? 0;
    totalWeight += weight;
    total += subscore.score * weight;
  }

  if (totalWeight <= 0) {
    return 50;
  }

  return total / totalWeight;
}

function createGauge(
  key: GaugeKey,
  label: string,
  subscores: GaugeSubscore[],
  weights: Record<string, number>,
) {
  const score = Math.round(clamp(weightedScore(subscores, weights), 0, 100));
  const band = getScoreBand(score);
  const tone = getScoreTone(score);
  const strongest = [...subscores].sort((left, right) => right.score - left.score)[0];
  const weakest = [...subscores].sort((left, right) => left.score - right.score)[0];
  const reason =
    weakest && weakest.score < 45
      ? `${strongest.label} is supportive, but ${weakest.label} is keeping this setup from full alignment.`
      : `${strongest.label} is carrying the setup and the indicator group is broadly aligned.`;

  return {
    key,
    label,
    score,
    band,
    tone,
    reason,
    subscores,
  } satisfies GaugeResult;
}

function buildConfluenceModel({
  snapshot,
  positionPnl,
  isCrypto,
  targetDelta,
  daysToExpiry,
  mode,
  profile,
}: {
  snapshot: Snapshot | null;
  positionPnl: number;
  isCrypto: boolean;
  targetDelta: number;
  daysToExpiry: number;
  mode: ControllerMode;
  profile: StrategyProfile;
}): ConfluenceModel {
  if (!snapshot) {
    return {
      gauges: [],
      overallScore: null,
      overallBand: "Unavailable",
      overallTone: "is-neutral",
      alignmentCount: 0,
      alignmentLabel: mode === "turbo" ? "0 of 4 aligned" : "0 of 3 aligned",
      reason: "A live market snapshot is required before confluence can be scored.",
      isReady: false,
    };
  }

  const trendSubscores: GaugeSubscore[] = [
    {
      label: "EMA alignment",
      score: clamp(
        52 +
          snapshot.trendStrength * 30 +
          (snapshot.signal.action === "buy" ? 12 : snapshot.signal.action === "sell" ? -10 : 0),
        0,
        100,
      ),
    },
    {
      label: "VWAP",
      score: clamp(50 + snapshot.trendStrength * 24 + snapshot.priceChangePercent * 2.2, 0, 100),
    },
    {
      label: "Slope",
      score: clamp(50 + snapshot.trendStrength * 38, 0, 100),
    },
    {
      label: "Structure",
      score: clamp(48 + snapshot.trendStrength * 24 + (positionPnl > 0 ? 8 : positionPnl < 0 ? -8 : 0), 0, 100),
    },
  ];
  const momentumSubscores: GaugeSubscore[] = [
    {
      label: "RSI",
      score: clamp(50 + snapshot.priceChangePercent * 6, 0, 100),
    },
    {
      label: "MACD",
      score: clamp(
        50 + snapshot.trendStrength * 30 + (snapshot.signal.action === "buy" ? 10 : snapshot.signal.action === "sell" ? -10 : 0),
        0,
        100,
      ),
    },
    {
      label: "ROC",
      score: clamp(50 + snapshot.priceChangePercent * 7, 0, 100),
    },
    {
      label: "Candle expansion",
      score: clamp(
        40 + (snapshot.relativeVolume ?? 1) * 20 + Math.abs(snapshot.priceChangePercent) * 5,
        0,
        100,
      ),
    },
  ];
  const executionSubscores: GaugeSubscore[] = [
    {
      label: "Spread quality",
      score: clamp((isCrypto ? 58 : 76) + ((snapshot.relativeVolume ?? 1) - 1) * 10, 0, 100),
    },
    {
      label: "Relative volume",
      score: clamp(snapshot.relativeVolume === null ? 50 : 34 + snapshot.relativeVolume * 24, 0, 100),
    },
    {
      label: "Quote stability",
      score: clamp(snapshot.signalAgeSeconds === null ? 58 : 92 - snapshot.signalAgeSeconds / 18, 0, 100),
    },
    {
      label: "Slippage risk",
      score: clamp(
        (isCrypto ? 54 : 74) +
          ((snapshot.relativeVolume ?? 1) - 1) * 16 -
          Math.abs(snapshot.priceChangePercent) * 3,
        0,
        100,
      ),
    },
  ];
  const contractFitnessSubscores: GaugeSubscore[] = [
    {
      label: "Delta",
      score: clamp(100 - Math.abs(targetDelta - 0.35) * 220, 0, 100),
    },
    {
      label: "Gamma",
      score: clamp(82 - Math.abs(daysToExpiry - 18) * 1.4 - Math.abs(targetDelta - 0.35) * 55, 0, 100),
    },
    {
      label: "Theta",
      score: clamp(86 - Math.max(14 - daysToExpiry, 0) * 2.4 - Math.max(daysToExpiry - 35, 0) * 1.2, 0, 100),
    },
    {
      label: "Vega",
      score: clamp(80 - Math.abs(daysToExpiry - 28) * 0.9, 0, 100),
    },
    {
      label: "Expiration fit",
      score: clamp(94 - Math.abs(daysToExpiry - 21) * 1.6, 0, 100),
    },
    {
      label: "Open interest / spread width",
      score: clamp((snapshot.relativeVolume === null ? 52 : 42 + snapshot.relativeVolume * 22) - (isCrypto ? 8 : 0), 0, 100),
    },
  ];

  const gauges: GaugeResult[] = [
    createGauge("trend", "Trend", trendSubscores, profile.gaugeWeights.trend),
    createGauge("momentum", "Momentum", momentumSubscores, profile.gaugeWeights.momentum),
    createGauge("execution", "Execution", executionSubscores, profile.gaugeWeights.execution),
  ];

  if (mode === "turbo") {
    gauges.push(
      createGauge(
        "contractFitness",
        "Contract Fitness",
        contractFitnessSubscores,
        profile.gaugeWeights.contractFitness,
      ),
    );
  }

  const visibleGauges = gauges.filter((gauge) => mode === "turbo" || gauge.key !== "contractFitness");
  const overallWeightTotal = visibleGauges.reduce(
    (sum, gauge) => sum + profile.overallWeights[gauge.key],
    0,
  );
  const overallScore = Math.round(
    visibleGauges.reduce(
      (sum, gauge) => sum + gauge.score * profile.overallWeights[gauge.key],
      0,
    ) / overallWeightTotal,
  );
  const alignmentCount = visibleGauges.filter((gauge) => gauge.score >= 60).length;

  return {
    gauges: visibleGauges,
    overallScore,
    overallBand: getScoreBand(overallScore),
    overallTone: getScoreTone(overallScore),
    alignmentCount,
    alignmentLabel: `${alignmentCount} of ${visibleGauges.length} aligned`,
    reason:
      alignmentCount === visibleGauges.length
        ? "All visible gauges are leaning the same way, which is the cleanest setup."
        : alignmentCount >= Math.ceil(visibleGauges.length / 2)
          ? "Most gauges agree, but one area still needs confirmation."
          : "Confluence is thin right now, so the setup is still fragmented.",
    isReady: true,
  };
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
  const [strategyProfile, setStrategyProfile] =
    useState<StrategyProfileKey>("trend-follow");
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
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
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
      setIsSnapshotLoading(false);
      return;
    }

    setIsSnapshotLoading(true);

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
        setIsSnapshotLoading(false);
      } catch (snapshotError) {
        if (cancelled) {
          return;
        }

        setSnapshot(null);
        setIsSnapshotLoading(false);
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
  const confluence = buildConfluenceModel({
    snapshot,
    positionPnl,
    isCrypto,
    targetDelta: deltaTarget,
    daysToExpiry,
    mode,
    profile: STRATEGY_PROFILES[strategyProfile],
  });
  const primaryCommand = getPrimaryCommand(activeController);
  const turboContracts = buildTurboContracts({
    symbol: normalizedSymbol || "SPY",
    latestPrice: snapshot?.latestPrice ?? activePosition?.avgEntryPrice ?? 500,
    bias,
    targetDelta: deltaTarget,
    dte: daysToExpiry,
  });
  const confluenceStatusReason = !normalizedSymbol
    ? "Enter a market to begin scoring confluence."
    : isSnapshotLoading
      ? `Loading ${normalizedSymbol} snapshot...`
      : error
        ? `Confluence unavailable: ${error}`
        : confluence.reason;

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

          <label className="algo-v2-field">
            <span className="algo-v2-field-label">Strategy Profile</span>
            <select
              className="form-input"
              value={strategyProfile}
              onChange={(event) => setStrategyProfile(event.target.value as StrategyProfileKey)}
            >
              {Object.entries(STRATEGY_PROFILES).map(([key, profile]) => (
                <option key={key} value={key}>
                  {profile.label}
                </option>
              ))}
            </select>
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
                    Simple, fast position control for stocks and ETFs with compact confluence checks.
                  </p>
                </div>
              </div>

              <div className="algo-v2-confluence-card">
                <div className="algo-v2-confluence-header">
                  <div>
                    <p className="algo-v2-meter-label">Overall Confluence</p>
                    {confluence.isReady ? (
                      <strong className={`algo-v2-confluence-score ${confluence.overallTone}`}>
                        {confluence.overallScore} · {confluence.overallBand}
                      </strong>
                    ) : (
                      <strong className="algo-v2-confluence-score is-neutral">
                        {isSnapshotLoading ? "Loading" : "Unavailable"}
                      </strong>
                    )}
                  </div>
                  <div className="algo-v2-confluence-meta">
                    <strong>{confluence.alignmentLabel}</strong>
                    <span>{STRATEGY_PROFILES[strategyProfile].label}</span>
                  </div>
                </div>
                {confluence.isReady ? (
                  <div className="algo-v2-health-meter">
                    <div className="algo-v2-health-meter-track" />
                    <div
                      className="algo-v2-health-meter-thumb"
                      style={{ left: `${confluence.overallScore}%` }}
                    />
                  </div>
                ) : (
                  <div className="algo-v2-confluence-empty">Confluence will appear once a valid snapshot loads.</div>
                )}
                <p className="algo-v2-confluence-copy">{confluenceStatusReason}</p>
              </div>

              {confluence.isReady ? (
                <div className="algo-v2-mini-gauge-grid">
                  {confluence.gauges.map((gauge) => (
                  <article key={gauge.key} className="algo-v2-mini-gauge-card">
                    <div className="algo-v2-mini-gauge-top">
                      <div>
                        <p className="algo-v2-meter-label">{gauge.label}</p>
                        <strong className={`algo-v2-mini-gauge-score ${gauge.tone}`}>
                          {gauge.score}
                        </strong>
                      </div>
                      <span className={`algo-v2-gauge-band ${gauge.tone}`}>{gauge.band}</span>
                    </div>
                    <div className="algo-v2-mini-track">
                      <span style={{ width: `${gauge.score}%` }} />
                    </div>
                    <p className="algo-v2-mini-gauge-copy">{gauge.reason}</p>
                    <details className="algo-v2-gauge-debug">
                      <summary>Debug subscores</summary>
                      <div className="algo-v2-debug-list">
                        {gauge.subscores.map((subscore) => (
                          <div key={subscore.label}>
                            <span>{subscore.label}</span>
                            <strong>{Math.round(subscore.score)}</strong>
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                  ))}
                </div>
              ) : null}

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
                <div className="algo-v2-confluence-header">
                  <div>
                    <p className="algo-v2-meter-label">Overall Confluence</p>
                    {confluence.isReady ? (
                      <strong className={`algo-v2-confluence-score ${confluence.overallTone}`}>
                        {confluence.overallScore} · {confluence.overallBand}
                      </strong>
                    ) : (
                      <strong className="algo-v2-confluence-score is-neutral">
                        {isSnapshotLoading ? "Loading" : "Unavailable"}
                      </strong>
                    )}
                  </div>
                  <div className="algo-v2-confluence-meta">
                    <strong>{confluence.alignmentLabel}</strong>
                    <span>{STRATEGY_PROFILES[strategyProfile].label}</span>
                  </div>
                </div>
                {confluence.isReady ? (
                  <>
                    <div className="algo-v2-health-meter">
                      <div className="algo-v2-health-meter-track" />
                      <div
                        className="algo-v2-health-meter-thumb"
                        style={{ left: `${confluence.overallScore}%` }}
                      />
                    </div>
                    <div className="algo-v2-health-meter-scale">
                      <span>Low</span>
                      <span>Confluence Meter</span>
                      <span>High</span>
                    </div>
                  </>
                ) : (
                  <div className="algo-v2-confluence-empty is-dark">Confluence will appear once a valid snapshot loads.</div>
                )}
                <p className="algo-v2-confluence-copy">{confluenceStatusReason}</p>
              </div>

              {confluence.isReady ? (
                <div className="algo-v2-mini-gauge-grid is-turbo">
                  {confluence.gauges.map((gauge) => (
                  <article key={gauge.key} className="algo-v2-mini-gauge-card">
                    <div className="algo-v2-mini-gauge-top">
                      <div>
                        <p className="algo-v2-meter-label">{gauge.label}</p>
                        <strong className={`algo-v2-mini-gauge-score ${gauge.tone}`}>
                          {gauge.score}
                        </strong>
                      </div>
                      <span className={`algo-v2-gauge-band ${gauge.tone}`}>{gauge.band}</span>
                    </div>
                    <div className="algo-v2-mini-track">
                      <span style={{ width: `${gauge.score}%` }} />
                    </div>
                    <p className="algo-v2-mini-gauge-copy">{gauge.reason}</p>
                    <details className="algo-v2-gauge-debug">
                      <summary>Debug subscores</summary>
                      <div className="algo-v2-debug-list">
                        {gauge.subscores.map((subscore) => (
                          <div key={subscore.label}>
                            <span>{subscore.label}</span>
                            <strong>{Math.round(subscore.score)}</strong>
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                  ))}
                </div>
              ) : null}

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
