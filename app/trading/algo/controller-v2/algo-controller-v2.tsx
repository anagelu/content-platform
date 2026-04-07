"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { getAlpacaAlgoSnapshot, runAlpacaTradeController } from "../actions";
import type { AlpacaTradeController } from "@/lib/alpaca-trade-controller";
import type { AlpacaBarTimeframe, AlpacaPosition } from "@/lib/alpaca";

type Snapshot = Awaited<ReturnType<typeof getAlpacaAlgoSnapshot>>;
type ControllerResult = Awaited<ReturnType<typeof runAlpacaTradeController>>;
type ControllerMode = "standard" | "turbo";
type Bias = "bearish" | "neutral" | "bullish";
type GaugeKey = "trend" | "momentum" | "execution";
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
const ANALYSIS_TIMEFRAMES: Array<{ value: AlpacaBarTimeframe; label: string }> = [
  { value: "1Min", label: "1 Min" },
  { value: "5Min", label: "5 Min" },
  { value: "15Min", label: "15 Min" },
  { value: "1Hour", label: "1 Hour" },
  { value: "1Day", label: "1 Day" },
];
const GAUGE_WEIGHTS: Record<GaugeKey, Record<string, number>> = {
  trend: {
    "EMA alignment": 0.25,
    "VWAP alignment": 0.25,
    slope: 0.25,
    structure: 0.25,
  },
  momentum: {
    RSI: 0.25,
    MACD: 0.25,
    ROC: 0.25,
    "candle expansion": 0.25,
  },
  execution: {
    "spread quality": 0.25,
    "relative volume": 0.25,
    "quote stability": 0.25,
    "slippage risk": 0.25,
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

function canonicalizeMarketSymbol(symbol: string) {
  const normalized = normalizeMarketInput(symbol);

  if (!normalized) {
    return "";
  }

  if (normalized.includes("/")) {
    return normalized;
  }

  if (normalized.endsWith("USD") && normalized.length > 3) {
    return `${normalized.slice(0, -3)}/USD`;
  }

  if (normalized.endsWith("USDT") && normalized.length > 4) {
    return `${normalized.slice(0, -4)}/USDT`;
  }

  if (normalized.endsWith("USDC") && normalized.length > 4) {
    return `${normalized.slice(0, -4)}/USDC`;
  }

  if (COMMON_CRYPTO_BASE_SYMBOLS.has(normalized)) {
    return `${normalized}/USD`;
  }

  return normalized;
}

function isCryptoLikeSymbol(symbol: string) {
  const normalized = canonicalizeMarketSymbol(symbol);
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
  if (score >= 81) {
    return "is-strong";
  }

  if (score >= 61) {
    return "is-positive";
  }

  if (score >= 46) {
    return "is-neutral";
  }

  return "is-negative";
}

function getScoreBand(score: number) {
  if (score >= 81) {
    return "Strong";
  }

  if (score >= 61) {
    return "Favorable";
  }

  if (score >= 46) {
    return "Mixed";
  }

  if (score >= 26) {
    return "Weak";
  }

  return "Unfavorable";
}

function getGaugeReason(label: string, score: number) {
  if (label === "Trend") {
    if (score >= 81) return "Trend structure is strongly supportive.";
    if (score >= 61) return "Trend structure is supportive.";
    if (score >= 46) return "Trend conditions are mixed.";
    if (score >= 26) return "Trend support is weak.";
    return "Trend structure is unfavorable.";
  }

  if (label === "Momentum") {
    if (score >= 81) return "Momentum is strong and expanding.";
    if (score >= 61) return "Momentum is improving.";
    if (score >= 46) return "Momentum is mixed.";
    if (score >= 26) return "Momentum is weak.";
    return "Momentum is unfavorable.";
  }

  if (score >= 81) return "Execution conditions are strong.";
  if (score >= 61) return "Execution conditions are acceptable.";
  if (score >= 46) return "Execution conditions are mixed.";
  if (score >= 26) return "Execution conditions are weak.";
  return "Execution conditions are unfavorable.";
}

function getConfluenceReason(favorableCount: number, strongCount: number, total: number) {
  if (strongCount === total) {
    return "All gauges are strong and broadly favorable.";
  }

  if (favorableCount === total) {
    return "All gauges are favorable.";
  }

  if (favorableCount >= 2) {
    return "Market conditions are leaning favorable, but not all gauges agree.";
  }

  if (favorableCount === 1) {
    return "Only one gauge is favorable right now.";
  }

  return "Current market conditions are not yet favorable.";
}

function getOverallWeights(): Record<GaugeKey, number> {
  return {
    trend: 1 / 3,
    momentum: 1 / 3,
    execution: 1 / 3,
  };
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

function getTimeframeProfile(timeframe: AlpacaBarTimeframe) {
  switch (timeframe) {
    case "1Day":
      return {
        trendMultiplier: 1.3,
        momentumMultiplier: 1.1,
        freshnessPenaltyDivisor: 7200,
        executionFreshnessDivisor: 1800,
      };
    case "1Hour":
      return {
        trendMultiplier: 1.15,
        momentumMultiplier: 1.05,
        freshnessPenaltyDivisor: 2400,
        executionFreshnessDivisor: 900,
      };
    case "15Min":
      return {
        trendMultiplier: 1,
        momentumMultiplier: 1,
        freshnessPenaltyDivisor: 900,
        executionFreshnessDivisor: 420,
      };
    case "5Min":
      return {
        trendMultiplier: 0.95,
        momentumMultiplier: 1.05,
        freshnessPenaltyDivisor: 420,
        executionFreshnessDivisor: 180,
      };
    case "1Min":
    default:
      return {
        trendMultiplier: 0.9,
        momentumMultiplier: 1.1,
        freshnessPenaltyDivisor: 180,
        executionFreshnessDivisor: 90,
      };
  }
}

function scoreFromSignedPercent(value: number | null, scale = 10, base = 50) {
  if (value === null || !Number.isFinite(value)) {
    return 50;
  }

  return clamp(base + value * scale, 0, 100);
}

function scoreFromCenteredValue(value: number | null, center: number, scale = 1) {
  if (value === null || !Number.isFinite(value)) {
    return 50;
  }

  return clamp(50 + (value - center) * scale, 0, 100);
}

function scoreFromInversePercent(value: number | null, strongThreshold: number, weakThreshold: number) {
  if (value === null || !Number.isFinite(value)) {
    return 50;
  }

  if (value <= strongThreshold) {
    return 90;
  }

  if (value >= weakThreshold) {
    return 20;
  }

  const progress = (value - strongThreshold) / (weakThreshold - strongThreshold);
  return clamp(90 - progress * 70, 20, 90);
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
  const reason = getGaugeReason(label, score);

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
  isCrypto,
}: {
  snapshot: Snapshot | null;
  isCrypto: boolean;
}): ConfluenceModel {
  if (!snapshot) {
    return {
      gauges: [],
      overallScore: null,
      overallBand: "Unavailable",
      overallTone: "is-neutral",
      alignmentCount: 0,
      alignmentLabel: "0 of 3 favorable",
      reason: "A live market snapshot is required before confluence can be scored.",
      isReady: false,
    };
  }

  const timeframeProfile = getTimeframeProfile(snapshot.timeframe);
  const vwapAlignmentPercent =
    snapshot.vwap && snapshot.vwap > 0
      ? ((snapshot.latestPrice - snapshot.vwap) / snapshot.vwap) * 100
      : null;

  const trendSubscores: GaugeSubscore[] = [
    {
      label: "EMA alignment",
      score:
        snapshot.emaShort !== null && snapshot.emaLong !== null
          ? clamp(
              (snapshot.latestPrice > snapshot.emaShort ? 32 : 12) +
                (snapshot.emaShort > snapshot.emaLong ? 36 : 14) +
                (snapshot.latestPrice > snapshot.emaLong ? 22 : 8),
              0,
              100,
            )
          : 50,
    },
    {
      label: "VWAP alignment",
      score: scoreFromSignedPercent(vwapAlignmentPercent, 10 * timeframeProfile.trendMultiplier),
    },
    {
      label: "Slope",
      score: scoreFromSignedPercent(
        snapshot.emaShortSlopePercent,
        18 * timeframeProfile.trendMultiplier,
      ),
    },
    {
      label: "Structure",
      score: scoreFromCenteredValue(snapshot.structurePercent, 50, 1.1),
    },
  ];
  const momentumSubscores: GaugeSubscore[] = [
    {
      label: "RSI",
      score:
        snapshot.rsi14 === null
          ? 50
          : snapshot.rsi14 >= 55 && snapshot.rsi14 <= 72
            ? clamp(68 + (snapshot.rsi14 - 55) * 1.2, 0, 100)
            : snapshot.rsi14 > 72
              ? clamp(88 - (snapshot.rsi14 - 72) * 1.8, 0, 100)
              : clamp(50 + (snapshot.rsi14 - 50) * 1.4, 0, 100),
    },
    {
      label: "MACD",
      score: scoreFromSignedPercent(
        snapshot.macdHistogramPercent,
        160 * timeframeProfile.momentumMultiplier,
      ),
    },
    {
      label: "ROC",
      score: scoreFromSignedPercent(snapshot.roc12, 5 * timeframeProfile.momentumMultiplier),
    },
    {
      label: "candle expansion",
      score:
        snapshot.candleExpansionRatio === null
          ? 50
          : clamp(
              40 +
                snapshot.candleExpansionRatio * 18 +
                Math.max(snapshot.priceChangePercent, 0) * 2.5 * timeframeProfile.momentumMultiplier,
              0,
              100,
            ),
    },
  ];
  const executionSubscores: GaugeSubscore[] = [
    {
      label: "spread quality",
      score: scoreFromInversePercent(
        snapshot.spreadPercent,
        isCrypto ? 0.04 : 0.01,
        isCrypto ? 0.35 : 0.12,
      ),
    },
    {
      label: "relative volume",
      score: clamp(snapshot.relativeVolume === null ? 50 : 34 + snapshot.relativeVolume * 24, 0, 100),
    },
    {
      label: "quote stability",
      score: clamp(
        snapshot.quoteAgeSeconds === null
          ? 58
          : 92 - snapshot.quoteAgeSeconds / timeframeProfile.executionFreshnessDivisor,
        0,
        100,
      ),
    },
    {
      label: "slippage risk",
      score: clamp(
        78 -
          (snapshot.spreadPercent ?? (isCrypto ? 0.25 : 0.08)) * 120 +
          ((snapshot.relativeVolume ?? 1) - 1) * 16 -
          Math.abs(snapshot.priceChangePercent) * 2.5,
        0,
        100,
      ),
    },
  ];
  const gauges: GaugeResult[] = [
    createGauge("trend", "Trend", trendSubscores, GAUGE_WEIGHTS.trend),
    createGauge("momentum", "Momentum", momentumSubscores, GAUGE_WEIGHTS.momentum),
    createGauge("execution", "Execution", executionSubscores, GAUGE_WEIGHTS.execution),
  ];
  const overallWeights = getOverallWeights();
  const overallWeightTotal = gauges.reduce((sum, gauge) => sum + overallWeights[gauge.key], 0);
  const overallScore = Math.round(
    gauges.reduce((sum, gauge) => sum + gauge.score * overallWeights[gauge.key], 0) /
      overallWeightTotal,
  );
  const alignmentCount = gauges.filter((gauge) => gauge.score >= 65).length;
  const strongCount = gauges.filter((gauge) => gauge.score >= 80).length;

  return {
    gauges,
    overallScore,
    overallBand: getScoreBand(overallScore),
    overallTone: getScoreTone(overallScore),
    alignmentCount,
    alignmentLabel: `${alignmentCount} of ${gauges.length} favorable`,
    reason: getConfluenceReason(alignmentCount, strongCount, gauges.length),
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
  const controllerSymbols = initialControllers.map((controller) => controller.symbol);
  const positionSymbols = initialPositions.map((position) => position.symbol);
  const suggestedSymbols = Array.from(
    new Set([initialSymbol, ...controllerSymbols, ...positionSymbols]),
  ).filter(Boolean);

  const [mode, setMode] = useState<ControllerMode>("standard");
  const [symbol, setSymbol] = useState(normalizeMarketInput(initialSymbol));
  const [analysisTimeframe, setAnalysisTimeframe] = useState<AlpacaBarTimeframe>(
    initialControllers.find((controller) => controller.symbol === initialSymbol)?.strategyTimeframe ?? "1Day",
  );
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
  const normalizedSymbol = canonicalizeMarketSymbol(symbol);

  const activeController = useMemo(
    () =>
      controllers.find(
        (controller) => canonicalizeMarketSymbol(controller.symbol) === normalizedSymbol,
      ) ?? null,
    [controllers, normalizedSymbol],
  );
  const activePosition = useMemo(
    () =>
      positions.find(
        (position) => canonicalizeMarketSymbol(position.symbol) === normalizedSymbol,
      ) ?? null,
    [positions, normalizedSymbol],
  );
  const isCrypto = isCryptoLikeSymbol(normalizedSymbol);
  const orderQtyValue = Math.max(Number(targetSize) || 0, 0);
  const minimumTargetQty = isCrypto ? 0.01 : 1;
  const targetSliderMax = Math.max(
    isCrypto ? 5 : 100,
    orderQtyValue > 0 ? orderQtyValue * 2 : isCrypto ? 5 : 100,
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
    if (activeController?.strategyTimeframe) {
      setAnalysisTimeframe(activeController.strategyTimeframe);
    }
  }, [activeController?.strategyTimeframe, normalizedSymbol]);

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
          strategyTimeframe: analysisTimeframe,
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
  }, [activeController, analysisTimeframe, normalizedSymbol]);

  const currentQty = snapshot?.position?.qty ?? activePosition?.qty ?? 0;
  const pendingChange = orderQtyValue;
  const positionPnl = snapshot?.position?.unrealizedPl ?? activePosition?.unrealizedPl ?? initialPnl;
  const confluence = buildConfluenceModel({
    snapshot,
    isCrypto,
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
  const resultingTargetQty = Math.max(
    (primaryCommand.command === "PLAY" ? Math.abs(currentQty) + orderQtyValue : orderQtyValue) ||
      minimumTargetQty,
    minimumTargetQty,
  );

  async function handleControllerCommand(command: "PLAY" | "PAUSE" | "RESUME" | "EJECT") {
    setError("");
    setActionNotice("");
    setIsBusy(true);

    startTransition(async () => {
      try {
        const targetQtyForCommand =
          command === "PLAY"
            ? Math.max(Math.abs(currentQty) + orderQtyValue, minimumTargetQty)
            : Math.max(orderQtyValue, minimumTargetQty);

        const result: ControllerResult = await runAlpacaTradeController({
          symbol: normalizedSymbol,
          command,
          targetQty: targetQtyForCommand,
          strategyType: activeController?.strategyType ?? "NONE",
          strategyTimeframe: analysisTimeframe,
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
          const next = current.filter(
            (controller) =>
              canonicalizeMarketSymbol(controller.symbol) !== normalizedSymbol,
          );

          if (result.controller) {
            return [result.controller, ...next];
          }

          if (activeController) {
            return [
              {
                ...activeController,
                symbol: normalizedSymbol,
                status:
                  command === "PLAY" || command === "RESUME"
                    ? "ACTIVE"
                    : command === "PAUSE"
                      ? "PAUSED"
                      : "EJECTED",
                targetQty: targetQtyForCommand,
                strategyTimeframe: analysisTimeframe,
                lastCommand: command,
              },
              ...next,
            ];
          }

          return next;
        });
        setPositions((current) => {
          const next = current.filter(
            (position) => canonicalizeMarketSymbol(position.symbol) !== normalizedSymbol,
          );
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
              Order Size {isCrypto ? "(units)" : "(shares)"}
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
            <span className="algo-v2-field-label">Analysis Timeframe</span>
            <select
              className="form-input"
              value={analysisTimeframe}
              onChange={(event) => setAnalysisTimeframe(event.target.value as AlpacaBarTimeframe)}
            >
              {ANALYSIS_TIMEFRAMES.map((timeframe) => (
                <option key={timeframe.value} value={timeframe.value}>
                  {timeframe.label}
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
                    <span>Market conditions</span>
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
                  <strong>Order Size Lever</strong>
                  <strong>
                    {orderQtyValue > 0 ? formatNumber(orderQtyValue, isCrypto ? 2 : 0) : "--"}{" "}
                    {isCrypto ? "units" : "shares"}
                  </strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max={targetSliderMax}
                  step={targetSliderStep}
                  value={orderQtyValue}
                  onChange={(event) => setTargetSize(event.target.value)}
                  className="algo-v2-range"
                />
                <div className="algo-v2-slider-scale">
                  <span>Smaller</span>
                  <span>
                    Resulting position: {formatNumber(resultingTargetQty, isCrypto ? 2 : 0)}{" "}
                    {isCrypto ? "units" : "shares"}
                  </span>
                  <span>Larger</span>
                </div>
              </div>

              <div className="algo-v2-stat-row">
                <div>
                  <span className="algo-v2-stat-label">Order Amount</span>
                  <strong className="is-positive">
                    +{formatNumber(pendingChange, isCrypto ? 2 : 0)} {isCrypto ? "units" : "shares"}
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
                    {orderQtyValue > 0 ? formatNumber(orderQtyValue, isCrypto ? 2 : 0) : "--"}{" "}
                    {isCrypto ? "units" : "shares"}
                  </strong>
                </div>
                <div>
                  <span>Resulting target</span>
                  <strong>
                    {formatNumber(resultingTargetQty, isCrypto ? 2 : 0)} {isCrypto ? "units" : "shares"}
                  </strong>
                </div>
                <div>
                  <span>Analysis timeframe</span>
                  <strong>{analysisTimeframe}</strong>
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
                    <span>Market conditions</span>
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
