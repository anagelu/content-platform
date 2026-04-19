"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  getAlpacaAlgoSnapshot,
  getTurboOptionCandidates,
  runTurboOptionControllerCommand,
  runAlpacaTradeController,
  submitTurboOptionPaperTrade,
} from "../actions";
import type { AlpacaTradeController } from "@/lib/alpaca-trade-controller";
import type { AlpacaBarTimeframe, AlpacaOrder, AlpacaPosition } from "@/lib/alpaca";
import type {
  SpatialBehaviorProfile,
  SpatialCockpitContext,
  SpatialPromptTarget,
} from "@/lib/spatial-agent-prompts";

type Snapshot = Awaited<ReturnType<typeof getAlpacaAlgoSnapshot>>;
type TurboOptionCandidatesResult = Awaited<ReturnType<typeof getTurboOptionCandidates>>;
type ControllerResult = Awaited<ReturnType<typeof runAlpacaTradeController>>;
type ControllerMode = "standard" | "turbo";
type Bias = "bearish" | "neutral" | "bullish";
type CopilotModeRecommendation = "standard" | "turbo" | "hold";
type GaugeKey = "trend" | "momentum" | "execution" | "timeframeConfluence";
type MarketLensOffset = -2 | -1 | 0 | 1 | 2;
type GaugeSubscore = { label: string; score: number };
type LensReadout = {
  offset: MarketLensOffset;
  label: string;
  timeframe: AlpacaBarTimeframe;
  score: number;
  summary: string;
};
type GaugeResult = {
  key: GaugeKey;
  label: string;
  score: number;
  band: string;
  tone: string;
  reason: string;
  subscores: GaugeSubscore[];
  lensReadouts?: LensReadout[];
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
type GaugeToggleState = Record<GaugeKey, boolean>;
type SimpleGaugeCard = {
  key: "trend" | "structure" | "candle";
  label: string;
  score: number;
  band: string;
  tone: string;
  summary: string;
  details: string[];
};
type StandardMarketModel = {
  overview: string;
  cards: SimpleGaugeCard[];
};
type CopilotMessage = {
  role: "assistant" | "user";
  text: string;
  suggestedActions?: string[];
  warnings?: string[];
  recommendedMode?: CopilotModeRecommendation;
};
type SpatialHoverTarget = {
  kind: "header" | "gauge" | "timeframe" | "contract" | "controls" | "actions";
  label: string;
  summary: string;
  score?: number | null;
  tone?: string;
  symbol?: string | null;
};
type CopilotContextOptions = {
  symbol: string;
  snapshot: Snapshot | null;
  controller: AlpacaTradeController | null;
  position: AlpacaPosition | null;
  confluenceModel: ConfluenceModel;
  standardModel: StandardMarketModel;
  lensReadout: LensReadout | null;
  requestedSymbolInPrompt: string | null;
  effectiveMode: ControllerMode;
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
const COPILOT_SYMBOL_STOPWORDS = new Set([
  "A",
  "AN",
  "AND",
  "ARE",
  "ASK",
  "BASE",
  "BE",
  "BLOCKED",
  "CAN",
  "CHECK",
  "COCKPIT",
  "CONFLUENCE",
  "DAILY",
  "DO",
  "FOR",
  "GAUGE",
  "GAUGES",
  "GOOD",
  "HERE",
  "HOW",
  "I",
  "IN",
  "IS",
  "IT",
  "ITS",
  "LOOKING",
  "MARKET",
  "ME",
  "MODE",
  "MINUTE",
  "MINUTES",
  "NOW",
  "OF",
  "ON",
  "OR",
  "QUESTION",
  "READ",
  "RIGHT",
  "SAYING",
  "SETUP",
  "SHOULD",
  "SIGNAL",
  "STANDARD",
  "TELL",
  "TEXT",
  "THE",
  "THIS",
  "TICKER",
  "TIMEFRAME",
  "TODAY",
  "TO",
  "TURBO",
  "V2",
  "WHAT",
  "WEEK",
  "WEEKLY",
  "WHY",
  "HOUR",
  "HOURLY",
]);
const ANALYSIS_TIMEFRAMES: Array<{ value: AlpacaBarTimeframe; label: string }> = [
  { value: "1Min", label: "1 Min" },
  { value: "5Min", label: "5 Min" },
  { value: "15Min", label: "15 Min" },
  { value: "30Min", label: "30 Min" },
  { value: "1Hour", label: "1 Hour" },
  { value: "1Day", label: "1 Day" },
  { value: "1Week", label: "1 Week" },
];
const MARKET_LENS_STOPS: Array<{ offset: MarketLensOffset; label: string }> = [
  { offset: -2, label: "In 2" },
  { offset: -1, label: "In 1" },
  { offset: 0, label: "Base" },
  { offset: 1, label: "Out 1" },
  { offset: 2, label: "Out 2" },
];
const FAVORABLE_GAUGE_THRESHOLD = 61;
const STRONG_GAUGE_THRESHOLD = 81;
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
  timeframeConfluence: {
    "higher trend": 0.2,
    "structure agreement": 0.2,
    "lower timing": 0.2,
    alignment: 0.15,
    conflict: 0.15,
    "risk context": 0.1,
  },
};

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

function extractRequestedMarketSymbol(message: string) {
  const tokens = message.match(/[A-Za-z]{1,10}(?:\/[A-Za-z]{2,10})?/g) ?? [];

  for (const token of tokens) {
    const normalized = canonicalizeMarketSymbol(token);

    if (!normalized) {
      continue;
    }

    const base = normalized.split("/")[0] ?? normalized;

    if (COPILOT_SYMBOL_STOPWORDS.has(base)) {
      continue;
    }

    if (normalized.includes("/")) {
      return normalized;
    }

    if (/^[A-Z]{1,5}$/.test(base)) {
      return normalized;
    }
  }

  return null;
}

function extractRequestedTimeframe(message: string): AlpacaBarTimeframe | null {
  const normalized = message.toLowerCase();
  const patterns: Array<{ pattern: RegExp; timeframe: AlpacaBarTimeframe }> = [
    { pattern: /\b1\s*min(?:ute)?\b|\b1m\b/, timeframe: "1Min" },
    { pattern: /\b5\s*min(?:ute)?s?\b|\b5m\b/, timeframe: "5Min" },
    { pattern: /\b15\s*min(?:ute)?s?\b|\b15m\b/, timeframe: "15Min" },
    { pattern: /\b30\s*min(?:ute)?s?\b|\b30m\b/, timeframe: "30Min" },
    { pattern: /\b1\s*hour\b|\b1h\b|\bhourly\b/, timeframe: "1Hour" },
    { pattern: /\bdaily\b|\b1\s*day\b|\b1d\b/, timeframe: "1Day" },
    { pattern: /\bweekly\b|\b1\s*week\b|\b1w\b/, timeframe: "1Week" },
  ];

  const match = patterns.find((entry) => entry.pattern.test(normalized));
  return match?.timeframe ?? null;
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
  if (score >= STRONG_GAUGE_THRESHOLD) {
    return "is-strong";
  }

  if (score >= FAVORABLE_GAUGE_THRESHOLD) {
    return "is-positive";
  }

  if (score >= 46) {
    return "is-neutral";
  }

  return "is-negative";
}

function getScoreBand(score: number) {
  if (score >= STRONG_GAUGE_THRESHOLD) {
    return "Strong";
  }

  if (score >= FAVORABLE_GAUGE_THRESHOLD) {
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
  if (label === "Timeframe Confluence") {
    if (score >= 81) return "The setup remains strong when you zoom in and out.";
    if (score >= 61) return "Nearby timeframes broadly support this setup.";
    if (score >= 46) return "Timeframe agreement is mixed across nearby lenses.";
    if (score >= 26) return "Nearby timeframes show weak agreement.";
    return "Nearby timeframes are working against this setup.";
  }

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

function formatSignedPercentValue(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function scoreFromCount(count: number, total: number) {
  if (total <= 0) {
    return 50;
  }

  return clamp((count / total) * 100, 0, 100);
}

function buildStandardMarketModel(snapshot: Snapshot | null): StandardMarketModel {
  if (!snapshot) {
    return {
      overview: "Load a live snapshot to inspect EMA structure and candlestick context.",
      cards: [],
    };
  }

  const emaLevels = [
    { label: "EMA 5", value: snapshot.ema5, slope: snapshot.ema5SlopePercent },
    { label: "EMA 9", value: snapshot.ema9, slope: snapshot.ema9SlopePercent },
    { label: "EMA 20", value: snapshot.ema20, slope: snapshot.ema20SlopePercent },
    { label: "EMA 100", value: snapshot.ema100, slope: snapshot.ema100SlopePercent },
    { label: "EMA 200", value: snapshot.ema200, slope: snapshot.ema200SlopePercent },
  ].filter(
    (item): item is { label: string; value: number; slope: number | null } =>
      item.value !== null,
  );
  const aboveCount = emaLevels.filter((item) => snapshot.latestPrice > item.value).length;
  const belowCount = emaLevels.filter((item) => snapshot.latestPrice < item.value).length;
  const risingCount = emaLevels.filter((item) => (item.slope ?? 0) > 0).length;
  const fallingCount = emaLevels.filter((item) => (item.slope ?? 0) < 0).length;
  const bullishOrder =
    snapshot.ema5 !== null &&
    snapshot.ema9 !== null &&
    snapshot.ema20 !== null &&
    snapshot.ema100 !== null &&
    snapshot.ema200 !== null &&
    snapshot.ema5 > snapshot.ema9 &&
    snapshot.ema9 > snapshot.ema20 &&
    snapshot.ema20 > snapshot.ema100 &&
    snapshot.ema100 > snapshot.ema200;
  const bearishOrder =
    snapshot.ema5 !== null &&
    snapshot.ema9 !== null &&
    snapshot.ema20 !== null &&
    snapshot.ema100 !== null &&
    snapshot.ema200 !== null &&
    snapshot.ema5 < snapshot.ema9 &&
    snapshot.ema9 < snapshot.ema20 &&
    snapshot.ema20 < snapshot.ema100 &&
    snapshot.ema100 < snapshot.ema200;
  const priceLocation =
    aboveCount === emaLevels.length
      ? "Above all key EMAs"
      : belowCount === emaLevels.length
        ? "Below all key EMAs"
        : aboveCount >= 3
          ? "Above short-term EMAs, mixed against the full stack"
          : belowCount >= 3
            ? "Below short-term EMAs, mixed against the full stack"
            : "Moving between fast and slow EMAs";
  const trendScore = Math.round(
    clamp(
      50 +
        (aboveCount - belowCount) * 7 +
        (risingCount - fallingCount) * 5 +
        (bullishOrder ? 14 : 0) -
        (bearishOrder ? 14 : 0),
      0,
      100,
    ),
  );
  const distFromEma9 =
    snapshot.ema9 && snapshot.ema9 > 0
      ? ((snapshot.latestPrice - snapshot.ema9) / snapshot.ema9) * 100
      : null;
  const distFromEma20 =
    snapshot.ema20 && snapshot.ema20 > 0
      ? ((snapshot.latestPrice - snapshot.ema20) / snapshot.ema20) * 100
      : null;
  const absDist20 = Math.abs(distFromEma20 ?? 0);
  const structureZone =
    snapshot.structurePercent === null
      ? "Range location unavailable"
      : snapshot.structurePercent >= 80
        ? "Pressing near the top of the recent range"
        : snapshot.structurePercent <= 20
          ? "Pressing near the bottom of the recent range"
          : snapshot.structurePercent >= 60
            ? "Holding in the upper half of the recent range"
            : snapshot.structurePercent <= 40
              ? "Holding in the lower half of the recent range"
              : "Trading near the middle of the recent range";
  const structureScore = Math.round(
    clamp(
      55 +
        (snapshot.structurePercent === null ? 0 : (snapshot.structurePercent - 50) * 0.55) -
        absDist20 * 8 +
        (snapshot.relativeVolume !== null ? Math.min(10, (snapshot.relativeVolume - 1) * 10) : 0),
      0,
      100,
    ),
  );
  const topPattern = snapshot.candlestickSignals[0] ?? null;
  const patternNearFastEma =
    Math.min(Math.abs(distFromEma9 ?? 99), Math.abs(distFromEma20 ?? 99)) <= 1.2;
  const patternAtRangeEdge =
    snapshot.structurePercent !== null &&
    (snapshot.structurePercent <= 25 || snapshot.structurePercent >= 75);
  const patternConfirmation =
    topPattern === null
      ? "No high-confidence pattern is active."
      : patternNearFastEma && patternAtRangeEdge
        ? "Pattern is printing near a key EMA and a meaningful range edge."
        : patternNearFastEma
          ? "Pattern is printing near a key fast EMA."
          : patternAtRangeEdge
            ? "Pattern is printing near the edge of the recent range."
            : "Pattern is present, but confirmation is lighter.";
  const candleScore = Math.round(
    clamp(
      50 +
        (topPattern ? (topPattern.bias === "bullish" ? 12 : topPattern.bias === "bearish" ? -12 : 0) : 0) +
        (topPattern ? (topPattern.confidence - 50) * 0.6 : 0) +
        (patternNearFastEma ? 8 : 0) +
        (patternAtRangeEdge ? 6 : 0),
      0,
      100,
    ),
  );

  const cards: SimpleGaugeCard[] = [
    {
      key: "trend",
      label: "Trend",
      score: trendScore,
      band: getScoreBand(trendScore),
      tone: getScoreTone(trendScore),
      summary:
        bullishOrder
          ? "Short and long EMAs are stacked cleanly bullish."
          : bearishOrder
            ? "Short and long EMAs are stacked cleanly bearish."
            : priceLocation,
      details: [
        `${aboveCount} of ${emaLevels.length} tracked EMAs are below price.`,
        `${risingCount} EMA slopes are rising and ${fallingCount} are falling.`,
        `Location: ${priceLocation}.`,
      ],
    },
    {
      key: "structure",
      label: "Structure",
      score: structureScore,
      band: getScoreBand(structureScore),
      tone: getScoreTone(structureScore),
      summary: structureZone,
      details: [
        `Distance from EMA 9: ${formatSignedPercentValue(distFromEma9)}.`,
        `Distance from EMA 20: ${formatSignedPercentValue(distFromEma20)}.`,
        `Range position: ${snapshot.structurePercent === null ? "--" : `${snapshot.structurePercent.toFixed(0)}%`}.`,
      ],
    },
    {
      key: "candle",
      label: "Candle Signal",
      score: candleScore,
      band: getScoreBand(candleScore),
      tone: getScoreTone(candleScore),
      summary: topPattern
        ? `${topPattern.name} (${topPattern.bias}) with ${topPattern.confidence}% confidence.`
        : "No standout bullish or bearish candle pattern is active.",
      details: [
        topPattern ? topPattern.summary : "The recent candles do not match a tracked reversal or continuation pattern.",
        patternConfirmation,
        snapshot.candlestickSignals.length > 1
          ? `Also detected: ${snapshot.candlestickSignals
              .slice(1, 3)
              .map((signal) => signal.name)
              .join(", ")}.`
          : "No secondary candle pattern is competing for attention.",
      ],
    },
  ];

  return {
    overview: `${priceLocation}. ${structureZone}. ${
      topPattern ? `${topPattern.name} is the strongest current candle signal.` : "No dominant candle signal is active."
    }`,
    cards,
  };
}

function buildStandardTimeframeCard({
  gauge,
  selectedLensReadout,
}: {
  gauge: GaugeResult | null;
  selectedLensReadout: LensReadout | null;
}): SimpleGaugeCard | null {
  if (!gauge) {
    return null;
  }

  return {
    key: "structure",
    label: "Timeframe Confluence",
    score: gauge.score,
    band: gauge.band,
    tone: gauge.tone,
    summary: selectedLensReadout
      ? `${selectedLensReadout.label} on ${selectedLensReadout.timeframe}: ${selectedLensReadout.summary}`
      : gauge.reason,
    details: [
      `${gauge.score} overall score with ${gauge.band.toLowerCase()} agreement.`,
      selectedLensReadout
        ? `Active lens: ${selectedLensReadout.label} (${selectedLensReadout.timeframe}).`
        : "Base timeframe lens is active.",
      gauge.lensReadouts && gauge.lensReadouts.length > 0
        ? `Nearby reads: ${gauge.lensReadouts
            .map((readout) => `${readout.label} ${readout.score}`)
            .join(" · ")}`
        : "Nearby timeframe reads are unavailable.",
    ],
  };
}

function getGaugeScore(gauges: GaugeResult[], key: GaugeKey) {
  return gauges.find((gauge) => gauge.key === key)?.score ?? 50;
}

function deriveAutoBias({
  snapshot,
  confluence,
  displayedOverallScore,
}: {
  snapshot: Snapshot | null;
  confluence: ConfluenceModel;
  displayedOverallScore: number | null;
}): Bias {
  if (!snapshot || !confluence.isReady) {
    return "neutral";
  }

  const trendScore = getGaugeScore(confluence.gauges, "trend");
  const momentumScore = getGaugeScore(confluence.gauges, "momentum");
  const executionScore = getGaugeScore(confluence.gauges, "execution");
  const timeframeScore = getGaugeScore(confluence.gauges, "timeframeConfluence");
  const signalScore =
    snapshot.signal.action === "buy" ? 16 : snapshot.signal.action === "sell" ? -16 : 0;
  const slopeScore = (snapshot.emaShortSlopePercent ?? 0) * 90;
  const priceChangeScore = (snapshot.priceChangePercent ?? 0) * 3.5;
  const vwapScore =
    snapshot.vwap && snapshot.vwap > 0
      ? ((snapshot.latestPrice - snapshot.vwap) / snapshot.vwap) * 180
      : 0;
  const directionalComposite =
    signalScore +
    (trendScore - 50) * 1.15 +
    (momentumScore - 50) * 0.95 +
    (timeframeScore - 50) * 0.75 +
    (executionScore - 50) * 0.2 +
    slopeScore +
    priceChangeScore +
    vwapScore;

  if (
    directionalComposite >= 18 &&
    trendScore >= 54 &&
    timeframeScore >= 52 &&
    (displayedOverallScore ?? 50) >= 50
  ) {
    return "bullish";
  }

  if (
    directionalComposite <= -18 &&
    trendScore <= 46 &&
    timeframeScore <= 48
  ) {
    return "bearish";
  }

  return "neutral";
}

function getOverallWeights(): Record<GaugeKey, number> {
  return {
    trend: 0.25,
    momentum: 0.25,
    execution: 0.25,
    timeframeConfluence: 0.25,
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

function formatElapsedTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const start = new Date(value);

  if (Number.isNaN(start.getTime())) {
    return "--";
  }

  const elapsedMs = Date.now() - start.getTime();

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return "--";
  }

  const totalMinutes = Math.floor(elapsedMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getExecutionStateLabel(status: "ACTIVE" | "PAUSED" | "EJECTED" | "UNSET", hasExposure: boolean) {
  if (status === "ACTIVE" || hasExposure) {
    return "Active";
  }

  if (status === "PAUSED") {
    return "Paused";
  }

  return "Armed";
}

function getTimeframeProfile(timeframe: AlpacaBarTimeframe) {
  switch (timeframe) {
    case "1Week":
      return {
        trendMultiplier: 1.45,
        momentumMultiplier: 1,
        freshnessPenaltyDivisor: 43200,
        executionFreshnessDivisor: 7200,
      };
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
    case "30Min":
      return {
        trendMultiplier: 1.08,
        momentumMultiplier: 1.02,
        freshnessPenaltyDivisor: 1500,
        executionFreshnessDivisor: 600,
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

function getShiftedTimeframe(base: AlpacaBarTimeframe, offset: MarketLensOffset) {
  const lensMap: Record<AlpacaBarTimeframe, Record<MarketLensOffset, AlpacaBarTimeframe>> = {
    "1Min": {
      [-2]: "1Min",
      [-1]: "1Min",
      [0]: "1Min",
      [1]: "5Min",
      [2]: "15Min",
    },
    "5Min": {
      [-2]: "1Min",
      [-1]: "1Min",
      [0]: "5Min",
      [1]: "15Min",
      [2]: "30Min",
    },
    "15Min": {
      [-2]: "1Min",
      [-1]: "5Min",
      [0]: "15Min",
      [1]: "30Min",
      [2]: "1Hour",
    },
    "30Min": {
      [-2]: "5Min",
      [-1]: "15Min",
      [0]: "30Min",
      [1]: "1Hour",
      [2]: "1Day",
    },
    "1Hour": {
      [-2]: "15Min",
      [-1]: "30Min",
      [0]: "1Hour",
      [1]: "1Day",
      [2]: "1Week",
    },
    "1Day": {
      [-2]: "30Min",
      [-1]: "1Hour",
      [0]: "1Day",
      [1]: "1Week",
      [2]: "1Week",
    },
    "1Week": {
      [-2]: "1Hour",
      [-1]: "1Day",
      [0]: "1Week",
      [1]: "1Week",
      [2]: "1Week",
    },
  };

  return lensMap[base]?.[offset] ?? base;
}

function getLensSummary(score: number, offset: MarketLensOffset) {
  if (offset < 0) {
    if (score >= 81) return "Entry timing stays strong when zooming in.";
    if (score >= 61) return "Nearer-term timing remains supportive.";
    if (score >= 46) return "Zooming in shows mixed entry timing.";
    if (score >= 26) return "Zooming in weakens the setup.";
    return "Zooming in shows clear near-term conflict.";
  }

  if (offset > 0) {
    if (score >= 81) return "Broader structure strongly confirms the setup.";
    if (score >= 61) return "Broader structure remains supportive.";
    if (score >= 46) return "Zooming out shows mixed higher-timeframe agreement.";
    if (score >= 26) return "Broader structure offers limited support.";
    return "Zooming out reveals higher-timeframe conflict.";
  }

  if (score >= 81) return "The base timeframe is strongly aligned.";
  if (score >= 61) return "The base timeframe is supportive.";
  if (score >= 46) return "The base timeframe is balanced.";
  if (score >= 26) return "The base timeframe is tentative.";
  return "The base timeframe is not supportive.";
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

function applySensitivityToScore(rawScore: number, sensitivity: number) {
  const bias = (sensitivity - 50) / 50;

  if (bias === 0) {
    return clamp(rawScore, 0, 100);
  }

  if (bias < 0) {
    return clamp(
      rawScore >= 50
        ? rawScore + (100 - rawScore) * Math.abs(bias) * 0.35
        : rawScore + (50 - rawScore) * Math.abs(bias) * 0.15,
      0,
      100,
    );
  }

  return clamp(
    rawScore >= 50
      ? rawScore - (rawScore - 50) * bias * 0.45
      : rawScore - (50 - rawScore) * bias * 0.15,
    0,
    100,
  );
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
  sensitivity: number,
  lensReadouts?: LensReadout[],
) {
  const score = Math.round(
    applySensitivityToScore(clamp(weightedScore(subscores, weights), 0, 100), sensitivity),
  );
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
    lensReadouts,
  } satisfies GaugeResult;
}

function buildConfluenceModel({
  snapshot,
  isCrypto,
  sensitivity,
}: {
  snapshot: Snapshot | null;
  isCrypto: boolean;
  sensitivity: number;
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
  const baseTrendScore = weightedScore(trendSubscores, GAUGE_WEIGHTS.trend);
  const baseMomentumScore = weightedScore(momentumSubscores, GAUGE_WEIGHTS.momentum);
  const baseExecutionScore = weightedScore(executionSubscores, GAUGE_WEIGHTS.execution);
  const lensReadouts: LensReadout[] = MARKET_LENS_STOPS.map((stop) => {
    const lensTimeframe = getShiftedTimeframe(snapshot.timeframe, stop.offset);
    const lensProfile = getTimeframeProfile(lensTimeframe);
    const directionalBias =
      (snapshot.emaShort !== null && snapshot.emaLong !== null && snapshot.emaShort > snapshot.emaLong ? 8 : -6) +
      (snapshot.structurePercent !== null ? (snapshot.structurePercent - 50) * 0.18 : 0);
    const timingBias =
      (snapshot.rsi14 !== null ? (snapshot.rsi14 - 50) * 0.65 : 0) +
      ((snapshot.macdHistogramPercent ?? 0) * 110 * lensProfile.momentumMultiplier);
    const conflictPenalty =
      Math.abs((snapshot.priceChangePercent ?? 0) * 2.8) +
      Math.max(0, 65 - (snapshot.relativeVolume ?? 50)) * 0.08;
    const lensScore = clamp(
      50 +
        directionalBias * lensProfile.trendMultiplier * (stop.offset > 0 ? 1.15 : 0.85) +
        timingBias * (stop.offset < 0 ? 1.2 : 0.7) +
        (baseExecutionScore - 50) * (stop.offset === 0 ? 0.5 : 0.35) -
        conflictPenalty * (stop.offset < 0 ? 1.15 : 0.7),
      0,
      100,
    );

    return {
      offset: stop.offset,
      label: stop.label,
      timeframe: lensTimeframe,
      score: Math.round(applySensitivityToScore(lensScore, sensitivity)),
      summary: getLensSummary(Math.round(applySensitivityToScore(lensScore, sensitivity)), stop.offset),
    };
  });
  const timeframeSubscores: GaugeSubscore[] = [
    {
      label: "higher trend",
      score: clamp(
        baseTrendScore +
          (lensReadouts.find((lens) => lens.offset === 1)?.score ?? 50 - 50) * 0.7 +
          (lensReadouts.find((lens) => lens.offset === 2)?.score ?? 50 - 50) * 0.9,
        0,
        100,
      ),
    },
    {
      label: "structure agreement",
      score: clamp(
        50 +
          ((snapshot.structurePercent ?? 50) - 50) * 1.1 +
          Math.abs(((snapshot.emaShortSlopePercent ?? 0) * 12)),
        0,
        100,
      ),
    },
    {
      label: "lower timing",
      score: clamp(
        baseMomentumScore * 0.5 +
          (lensReadouts.find((lens) => lens.offset === -1)?.score ?? 50) * 0.3 +
          (lensReadouts.find((lens) => lens.offset === -2)?.score ?? 50) * 0.2,
        0,
        100,
      ),
    },
    {
      label: "alignment",
      score: clamp(
        100 -
          (Math.max(...lensReadouts.map((lens) => lens.score)) -
            Math.min(...lensReadouts.map((lens) => lens.score))) *
            1.2,
        0,
        100,
      ),
    },
    {
      label: "conflict",
      score: clamp(
        100 -
          (Math.abs((lensReadouts.find((lens) => lens.offset === 2)?.score ?? 50) - baseTrendScore) * 0.8 +
            Math.abs((lensReadouts.find((lens) => lens.offset === -2)?.score ?? 50) - baseMomentumScore) * 0.9),
        0,
        100,
      ),
    },
    {
      label: "risk context",
      score: clamp(
        55 +
          (baseExecutionScore - 50) * 0.8 -
          (snapshot.quoteAgeSeconds === null
            ? 0
            : snapshot.quoteAgeSeconds / timeframeProfile.freshnessPenaltyDivisor) *
            24,
        0,
        100,
      ),
    },
  ];
  const gauges: GaugeResult[] = [
    createGauge("trend", "Trend", trendSubscores, GAUGE_WEIGHTS.trend, sensitivity),
    createGauge("momentum", "Momentum", momentumSubscores, GAUGE_WEIGHTS.momentum, sensitivity),
    createGauge("execution", "Execution", executionSubscores, GAUGE_WEIGHTS.execution, sensitivity),
    createGauge(
      "timeframeConfluence",
      "Timeframe Confluence",
      timeframeSubscores,
      GAUGE_WEIGHTS.timeframeConfluence,
      sensitivity,
      lensReadouts,
    ),
  ];
  const overallWeights = getOverallWeights();
  const overallWeightTotal = gauges.reduce((sum, gauge) => sum + overallWeights[gauge.key], 0);
  const overallScore = Math.round(
    gauges.reduce((sum, gauge) => sum + gauge.score * overallWeights[gauge.key], 0) /
      overallWeightTotal,
  );
  const alignmentCount = gauges.filter((gauge) => gauge.score >= FAVORABLE_GAUGE_THRESHOLD).length;
  const strongCount = gauges.filter((gauge) => gauge.score >= STRONG_GAUGE_THRESHOLD).length;

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

function formatOptionExpiration(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatOptionSpreadLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "quote pending";
  }

  if (value <= 1.5) {
    return "tight";
  }

  if (value <= 4) {
    return "workable";
  }

  return "wider";
}

export function AlgoControllerV2({
  initialSymbol,
  initialControllers,
  initialPositions,
  initialOpenOrders,
  initialRecentOrders,
  initialPnl,
  initialError,
}: {
  initialSymbol: string;
  initialControllers: AlpacaTradeController[];
  initialPositions: AlpacaPosition[];
  initialOpenOrders: AlpacaOrder[];
  initialRecentOrders: AlpacaOrder[];
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
  const [confluenceSensitivity, setConfluenceSensitivity] = useState(50);
  const [marketLens, setMarketLens] = useState<MarketLensOffset>(0);
  const [targetSize, setTargetSize] = useState(
    String(initialControllers.find((controller) => controller.symbol === initialSymbol)?.targetQty ?? 10),
  );
  const [deltaTarget, setDeltaTarget] = useState(0.4);
  const [daysToExpiry, setDaysToExpiry] = useState(30);
  const [autoBiasEnabled, setAutoBiasEnabled] = useState(true);
  const [bias, setBias] = useState<Bias>("bullish");
  const [selectedTurboContractSymbol, setSelectedTurboContractSymbol] = useState("");
  const [turboContractStatus, setTurboContractStatus] = useState<"UNSET" | "ACTIVE" | "PAUSED" | "EJECTED">("UNSET");
  const [gaugeToggles, setGaugeToggles] = useState<GaugeToggleState>({
    trend: true,
    momentum: true,
    execution: true,
    timeframeConfluence: true,
  });
  const [selectedTurboGauge, setSelectedTurboGauge] = useState<GaugeKey>("trend");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [turboCandidates, setTurboCandidates] = useState<TurboOptionCandidatesResult | null>(null);
  const [turboCandidatesError, setTurboCandidatesError] = useState("");
  const [isTurboLoading, setIsTurboLoading] = useState(false);
  const [controllers, setControllers] = useState(initialControllers);
  const [positions, setPositions] = useState(initialPositions);
  const [error, setError] = useState(initialError);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [snapshotRefreshKey, setSnapshotRefreshKey] = useState(0);
  const [actionNotice, setActionNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [hoveredSpatialTarget, setHoveredSpatialTarget] = useState<SpatialHoverTarget | null>(null);
  const [clipboardMemory, setClipboardMemory] = useState("");
  const [spatialInsight, setSpatialInsight] = useState("");
  const [isSpatialInsightLoading, setIsSpatialInsightLoading] = useState(false);
  const [spatialHudPinned, setSpatialHudPinned] = useState(false);
  const [spatialHudInteractive, setSpatialHudInteractive] = useState(false);
  const [spatialHudPinnedPosition, setSpatialHudPinnedPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [lastAutoInsightKey, setLastAutoInsightKey] = useState("");
  const [spatialQuery, setSpatialQuery] = useState("");
  const [copilotFocusSymbol, setCopilotFocusSymbol] = useState<string | null>(null);
  const [copilotFocusTimeframe, setCopilotFocusTimeframe] = useState<AlpacaBarTimeframe | null>(null);
  const [copilotInput, setCopilotInput] = useState("");
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      role: "assistant",
      text:
        "Algo Controller V2 copilot is online. Ask why the setup is blocked, whether Standard or Turbo fits better, or what the current gauges are saying.",
    },
  ]);
  const spatialHudRef = useRef<HTMLDivElement | null>(null);
  const normalizedSymbol = canonicalizeMarketSymbol(symbol);
  const clipboardSymbol = useMemo(
    () => extractRequestedMarketSymbol(clipboardMemory),
    [clipboardMemory],
  );

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
  }, [activeController, analysisTimeframe, normalizedSymbol, snapshotRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    if (mode !== "turbo" || !normalizedSymbol || isCrypto || bias === "neutral") {
      setTurboCandidates(null);
      setTurboCandidatesError("");
      setIsTurboLoading(false);
      return;
    }

    setIsTurboLoading(true);
    setTurboCandidatesError("");

    startTransition(async () => {
      try {
        const result = await getTurboOptionCandidates({
          underlyingSymbol: normalizedSymbol,
          bias,
          targetDelta: deltaTarget,
          daysToExpiry,
        });

        if (cancelled) {
          return;
        }

        setTurboCandidates(result);
        setIsTurboLoading(false);
      } catch (turboError) {
        if (cancelled) {
          return;
        }

        setTurboCandidates(null);
        setIsTurboLoading(false);
        setTurboCandidatesError(
          turboError instanceof Error
            ? turboError.message
            : "Unable to load Turbo option candidates right now.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bias, daysToExpiry, deltaTarget, isCrypto, mode, normalizedSymbol]);

  const currentQty = snapshot?.position?.qty ?? activePosition?.qty ?? 0;
  const pendingChange = orderQtyValue;
  const positionPnl = snapshot?.position?.unrealizedPl ?? activePosition?.unrealizedPl ?? initialPnl;
  const confluence = buildConfluenceModel({
    snapshot,
    isCrypto,
    sensitivity: confluenceSensitivity,
  });
  const timeframeConfluenceGauge =
    confluence.gauges.find((gauge) => gauge.key === "timeframeConfluence") ?? null;
  const selectedLensReadout =
    timeframeConfluenceGauge?.lensReadouts?.find((readout) => readout.offset === marketLens) ?? null;
  const standardMarketModel = useMemo(() => {
    const baseModel = buildStandardMarketModel(snapshot);
    const timeframeCard = buildStandardTimeframeCard({
      gauge: timeframeConfluenceGauge,
      selectedLensReadout,
    });

    return {
      ...baseModel,
      cards: timeframeCard ? [...baseModel.cards, timeframeCard] : baseModel.cards,
    };
  }, [selectedLensReadout, snapshot, timeframeConfluenceGauge]);
  const enabledGauges = confluence.gauges.filter((gauge) => gaugeToggles[gauge.key]);
  const enabledOverallWeights = getOverallWeights();
  const enabledWeightTotal = enabledGauges.reduce(
    (sum, gauge) => sum + enabledOverallWeights[gauge.key],
    0,
  );
  const overallScoreFromEnabledGauges =
    enabledGauges.length > 0 && enabledWeightTotal > 0
      ? Math.round(
          enabledGauges.reduce(
            (sum, gauge) => sum + gauge.score * enabledOverallWeights[gauge.key],
            0,
          ) / enabledWeightTotal,
        )
      : null;
  const favorableEnabledCount = enabledGauges.filter(
    (gauge) => gauge.score >= FAVORABLE_GAUGE_THRESHOLD,
  ).length;
  const strongEnabledCount = enabledGauges.filter(
    (gauge) => gauge.score >= STRONG_GAUGE_THRESHOLD,
  ).length;
  const displayedOverallScore = confluence.isReady ? overallScoreFromEnabledGauges : null;
  const displayedOverallBand =
    displayedOverallScore === null ? "Unavailable" : getScoreBand(displayedOverallScore);
  const displayedOverallTone =
    displayedOverallScore === null ? "is-neutral" : getScoreTone(displayedOverallScore);
  const displayedAlignmentLabel =
    enabledGauges.length > 0
      ? `${favorableEnabledCount} of ${enabledGauges.length} favorable`
      : "0 of 0 favorable";
  const displayedConfluenceReason =
    enabledGauges.length > 0
      ? getConfluenceReason(favorableEnabledCount, strongEnabledCount, enabledGauges.length)
      : "Turn on at least one gauge to calculate confluence.";
  const autoBiasSuggestion = deriveAutoBias({
    snapshot,
    confluence,
    displayedOverallScore,
  });
  const primaryCommand = getPrimaryCommand(activeController);
  const turboContracts = useMemo(() => turboCandidates?.suggestions ?? [], [turboCandidates]);
  const selectedTurboContract =
    turboContracts.find((contract) => contract.symbol === selectedTurboContractSymbol) ?? turboContracts[0] ?? null;
  const selectedTurboPosition = selectedTurboContract
    ? positions.find((position) => canonicalizeMarketSymbol(position.symbol) === selectedTurboContract.symbol)
    : null;
  const turboCurrentQty = Math.max(0, Math.abs(selectedTurboPosition?.qty ?? 0));
  const leadTurboContract = turboContracts[0] ?? null;
  const turboFitScore =
    leadTurboContract && displayedOverallScore !== null
      ? Math.round(clamp(leadTurboContract.fitScore * 0.55 + displayedOverallScore * 0.45, 0, 100))
      : leadTurboContract?.fitScore ?? displayedOverallScore ?? null;
  const turboFitBand = turboFitScore === null ? "Unavailable" : getScoreBand(turboFitScore);
  const turboFitTone = turboFitScore === null ? "is-neutral" : getScoreTone(turboFitScore);
  const turboBiasHeadline =
    bias === "bullish"
      ? "Calls favored"
      : bias === "bearish"
        ? "Puts favored"
        : "Neutral handoff";
  const turboBiasCopy =
    bias === "bullish"
      ? "The controller is leaning toward call-side exposure with the current contract filters."
      : bias === "bearish"
        ? "The controller is leaning toward put-side exposure with the current contract filters."
        : "Turbo is staged in a neutral handoff while you inspect direction and contract quality.";
  const confluenceStatusReason = !normalizedSymbol
    ? "Enter a market to begin scoring confluence."
    : isSnapshotLoading
      ? `Loading ${normalizedSymbol} snapshot...`
      : error
        ? `Confluence unavailable: ${error}`
        : displayedConfluenceReason;
  const resultingTargetQty = Math.max(
    (primaryCommand.command === "PLAY" ? Math.abs(currentQty) + orderQtyValue : orderQtyValue) ||
      minimumTargetQty,
    minimumTargetQty,
  );

  useEffect(() => {
    if (turboContracts.length === 0) {
      setSelectedTurboContractSymbol("");
      if (mode === "turbo") {
        setTurboContractStatus("UNSET");
      }
      return;
    }

    const hasSelection = turboContracts.some((contract) => contract.symbol === selectedTurboContractSymbol);

    if (!hasSelection) {
      setSelectedTurboContractSymbol(turboContracts[0].symbol);
      setTurboContractStatus("UNSET");
    }
  }, [mode, selectedTurboContractSymbol, turboContracts]);

  const turboPrimaryCommand =
    turboContractStatus === "ACTIVE" || turboCurrentQty > 0
      ? {
          command: "PAUSE" as const,
          label: "Pause Risk",
          helper: "Flatten the selected option contract while keeping it armed for resume.",
          tone: "algo-v2-action-button is-primary",
        }
      : turboContractStatus === "PAUSED"
        ? {
            command: "RESUME" as const,
            label: "Resume Position",
            helper: "Re-enter the selected option contract at the chosen contract size.",
            tone: "algo-v2-action-button is-positive",
          }
        : {
            command: "PLAY" as const,
            label: "Play Position",
            helper: "Enter the selected option contract using the size you set above.",
            tone: "algo-v2-action-button is-positive",
          };
  const executionGauge = confluence.gauges.find((gauge) => gauge.key === "execution") ?? null;
  const standardTelemetryScore = scoreFromCount(
    standardMarketModel.cards.filter((card) => card.score >= FAVORABLE_GAUGE_THRESHOLD).length,
    Math.max(standardMarketModel.cards.length, 1),
  );
  const standardHandoffReady =
    displayedOverallScore !== null &&
    displayedOverallScore >= FAVORABLE_GAUGE_THRESHOLD &&
    (timeframeConfluenceGauge?.score ?? 0) >= FAVORABLE_GAUGE_THRESHOLD;
  const sessionClockAnchor = activeController?.lastCommandAt ?? activeController?.updatedAt ?? null;
  const sessionDuration = formatElapsedTime(sessionClockAnchor);
  const standardSessionState = getExecutionStateLabel(
    activeController?.status ?? "UNSET",
    Math.abs(currentQty) > 0,
  );
  const turboSessionState = getExecutionStateLabel(turboContractStatus, turboCurrentQty > 0);
  const displayedSessionState = mode === "turbo" && !isCrypto ? turboSessionState : standardSessionState;
  const displayedCommand = mode === "turbo" && !isCrypto ? turboPrimaryCommand : primaryCommand;
  const standardPlayLocked =
    !normalizedSymbol ||
    isBusy ||
    isSnapshotLoading ||
    (executionGauge?.score ?? 0) < FAVORABLE_GAUGE_THRESHOLD;
  const turboPlayLocked =
    !selectedTurboContract ||
    isBusy ||
    isTurboLoading ||
    bias === "neutral" ||
    (executionGauge?.score ?? 0) < FAVORABLE_GAUGE_THRESHOLD ||
    (turboFitScore ?? 0) < FAVORABLE_GAUGE_THRESHOLD;
  const playLocked = mode === "turbo" && !isCrypto ? turboPlayLocked : standardPlayLocked;
  const playLockReason =
    mode === "turbo" && !isCrypto
      ? !selectedTurboContract
        ? "Select a contract before you start Turbo."
        : bias === "neutral"
          ? "Choose a directional bias before arming Turbo."
          : (executionGauge?.score ?? 0) < 20
            ? "Execution conditions are poor, so entry is blocked."
          : (executionGauge?.score ?? 0) < FAVORABLE_GAUGE_THRESHOLD
            ? "Execution quality is below the safety threshold, so Play stays locked."
            : (turboFitScore ?? 0) < FAVORABLE_GAUGE_THRESHOLD
              ? "Turbo readiness is below the safety threshold, so Play stays locked."
              : ""
      : (executionGauge?.score ?? 0) < FAVORABLE_GAUGE_THRESHOLD
        ? "Execution quality is below the safety threshold, so Play stays locked."
        : "";
  const addActionLabel =
    mode === "turbo" && !isCrypto
      ? `Add Position (+${Math.max(1, Math.round(orderQtyValue || 1))})`
      : `Add Position (+${formatNumber(Math.max(orderQtyValue, minimumTargetQty), isCrypto ? 2 : 0)})`;
  const addActionCopy =
    mode === "turbo" && !isCrypto
      ? "Buy one more clip into the selected contract while the session is active."
      : "Add another controller clip at the current sizing profile.";
  const contractTelemetrySummary = selectedTurboContract
    ? `${formatOptionExpiration(selectedTurboContract.expirationDate)} ${Math.round(
        selectedTurboContract.strikePrice,
      )}${selectedTurboContract.type === "call" ? "C" : "P"}`
    : "--";
  const spatialHud = useMemo(() => {
    if (!hoveredSpatialTarget) {
      return null;
    }

    const nextActions: string[] = [];

    if (clipboardSymbol && clipboardSymbol !== normalizedSymbol) {
      nextActions.push(`Load copied ticker ${clipboardSymbol} into the cockpit`);
    }

    if (
      hoveredSpatialTarget.kind === "gauge" ||
      hoveredSpatialTarget.kind === "timeframe"
    ) {
      nextActions.push(
        `Inspect ${hoveredSpatialTarget.label.toLowerCase()} before changing risk`,
      );
    }

    if (hoveredSpatialTarget.kind === "actions") {
      nextActions.push("Confirm whether the session is Armed, Active, or Paused");
    }

    if (
      hoveredSpatialTarget.kind === "contract" &&
      hoveredSpatialTarget.symbol &&
      hoveredSpatialTarget.symbol !== selectedTurboContract?.symbol
    ) {
      nextActions.push(`Select ${hoveredSpatialTarget.symbol} as the active contract`);
    }

    return {
      title: hoveredSpatialTarget.label,
      summary: hoveredSpatialTarget.summary,
      tone: hoveredSpatialTarget.tone ?? "is-neutral",
      nextActions,
    };
  }, [clipboardSymbol, hoveredSpatialTarget, normalizedSymbol, selectedTurboContract?.symbol]);
  const spatialCockpitContext = useMemo<SpatialCockpitContext>(
    () => ({
      symbol: normalizedSymbol || "--",
      timeframe: analysisTimeframe,
      mode,
      overallConfluence: displayedOverallScore,
      sessionState: displayedSessionState,
      price: snapshot?.latestPrice ?? null,
      priceChangePercent: snapshot?.priceChangePercent ?? null,
      topCandleSignal: snapshot?.candlestickSignals[0]?.name ?? "",
      executionLockReason: playLockReason,
    }),
    [
      analysisTimeframe,
      displayedOverallScore,
      displayedSessionState,
      mode,
      normalizedSymbol,
      playLockReason,
      snapshot,
    ],
  );
  const spatialBehaviorProfile = useMemo<SpatialBehaviorProfile>(
    () => ({
      copiedText: clipboardMemory || undefined,
      copiedSymbol: clipboardSymbol || undefined,
      recentHoverPattern: hoveredSpatialTarget ? [hoveredSpatialTarget.label] : [],
      inferredInterests: hoveredSpatialTarget ? [hoveredSpatialTarget.kind] : [],
    }),
    [clipboardMemory, clipboardSymbol, hoveredSpatialTarget],
  );
  const spatialPromptTarget = useMemo<SpatialPromptTarget | null>(() => {
    if (!hoveredSpatialTarget) {
      return null;
    }

    if (hoveredSpatialTarget.kind === "contract" && hoveredSpatialTarget.symbol) {
      const contract = turboContracts.find(
        (entry) => entry.symbol === hoveredSpatialTarget.symbol,
      );

      return {
        kind: "contract_card",
        label: hoveredSpatialTarget.label,
        symbol: hoveredSpatialTarget.symbol,
        fitScore: hoveredSpatialTarget.score ?? contract?.fitScore ?? 0,
        markPrice: contract?.markPrice ?? null,
        breakevenPrice: contract?.breakevenPrice ?? null,
        impliedVolatility: contract?.snapshot.impliedVolatility ?? null,
        spreadLabel: contract ? formatOptionSpreadLabel(contract.spreadPercent) : undefined,
        delta: contract?.snapshot.delta ?? null,
        summary: hoveredSpatialTarget.summary,
      };
    }

    const gauge = confluence.gauges.find(
      (entry) => entry.label === hoveredSpatialTarget.label,
    );

    if (hoveredSpatialTarget.kind === "timeframe" || hoveredSpatialTarget.label === "Timeframe Confluence") {
      return {
        kind: "timeframe_confluence",
        label: hoveredSpatialTarget.label,
        score: hoveredSpatialTarget.score ?? gauge?.score ?? 0,
        band: gauge?.band ?? "Mixed",
        summary: hoveredSpatialTarget.summary,
        subscores: gauge?.subscores,
        nearbyTimeframes: gauge?.lensReadouts?.map((entry) => ({
          label: entry.label,
          timeframe: entry.timeframe,
          score: entry.score,
          summary: entry.summary,
        })),
      };
    }

    const gaugeKind =
      hoveredSpatialTarget.label === "Execution"
        ? "execution"
        : hoveredSpatialTarget.label === "Trend"
          ? "trend"
          : null;

    if (!gaugeKind) {
      return null;
    }

    return {
      kind: gaugeKind,
      label: hoveredSpatialTarget.label,
      score: hoveredSpatialTarget.score ?? gauge?.score ?? 0,
      band: gauge?.band ?? "Mixed",
      summary: hoveredSpatialTarget.summary,
      subscores: gauge?.subscores,
    };
  }, [confluence.gauges, hoveredSpatialTarget, turboContracts]);
  const spatialPromptTargetKey = useMemo(() => {
    if (!spatialPromptTarget) {
      return "";
    }

    return JSON.stringify({
      kind: spatialPromptTarget.kind,
      label: spatialPromptTarget.label,
      symbol: "symbol" in spatialPromptTarget ? spatialPromptTarget.symbol : null,
      score: "score" in spatialPromptTarget ? spatialPromptTarget.score : spatialPromptTarget.fitScore,
      timeframe: analysisTimeframe,
      market: normalizedSymbol,
    });
  }, [analysisTimeframe, normalizedSymbol, spatialPromptTarget]);

  function buildCopilotContextText({
    symbol: contextSymbol,
    snapshot: contextSnapshot,
    controller: contextController,
    position: contextPosition,
    confluenceModel,
    standardModel,
    lensReadout,
    requestedSymbolInPrompt,
    effectiveMode,
  }: CopilotContextOptions) {
    const controllerStatus = contextController?.status ?? "UNSET";
    const primaryPattern = contextSnapshot?.candlestickSignals[0] ?? null;
    const contextCurrentQty = contextSnapshot?.position?.qty ?? contextPosition?.qty ?? 0;
    const contextPositionPnl =
      contextSnapshot?.position?.unrealizedPl ?? contextPosition?.unrealizedPl ?? initialPnl;
    const contextExecutionGauge =
      confluenceModel.gauges.find((gauge) => gauge.key === "execution") ?? null;
    const contextDisplayedOverallScore = confluenceModel.isReady ? confluenceModel.overallScore : null;
    const contextDisplayedOverallBand =
      contextDisplayedOverallScore === null ? "Unavailable" : getScoreBand(contextDisplayedOverallScore);
    const contextDisplayedAlignmentLabel = confluenceModel.isReady
      ? confluenceModel.alignmentLabel
      : "0 of 0 favorable";
    const contextDisplayedSessionState = getExecutionStateLabel(
      contextController?.status ?? "UNSET",
      Math.abs(contextCurrentQty) > 0,
    );
    const contextPlayLockReason =
      !contextSymbol
        ? "No symbol is selected."
        : (contextExecutionGauge?.score ?? 0) < FAVORABLE_GAUGE_THRESHOLD
          ? "Execution quality is below the safety threshold, so Play stays locked."
          : "";
    const topContractText = selectedTurboContract
      ? `${selectedTurboContract.symbol} | fit ${selectedTurboContract.fitScore} | mark ${formatMoney(
          selectedTurboContract.markPrice,
        )} | breakeven ${formatMoney(selectedTurboContract.breakevenPrice)}`
      : "(none selected)";
    const openOrderSummary =
      initialOpenOrders.length > 0
        ? initialOpenOrders
            .slice(0, 5)
            .map(
              (order) =>
                `${order.symbol} ${order.side} ${order.status} qty ${order.qty ?? "--"} submitted ${order.submittedAt ?? "--"}`,
            )
            .join("\n")
        : "(none)";
    const recentOrderSummary =
      initialRecentOrders.length > 0
        ? initialRecentOrders
            .slice(0, 5)
            .map(
              (order) =>
                `${order.symbol} ${order.side} ${order.status} filled ${order.filledQty ?? "--"} avg ${order.filledAvgPrice ?? "--"}`,
            )
            .join("\n")
        : "(none)";

    return `Priority cockpit summary:
Selected ticker: ${contextSymbol || "(not set)"}
Requested ticker from user message: ${requestedSymbolInPrompt || "(none, use cockpit ticker)"}
Analysis timeframe: ${contextSnapshot?.timeframe ?? analysisTimeframe}
Controller mode: ${effectiveMode}
Recommended mode from cockpit: ${
      contextDisplayedOverallScore !== null && contextDisplayedOverallScore >= FAVORABLE_GAUGE_THRESHOLD
        ? "turbo handoff available"
        : "hold current mode"
    }
Overall confluence: ${contextDisplayedOverallScore ?? "--"} ${contextDisplayedOverallBand}
Alignment: ${contextDisplayedAlignmentLabel}
Controller status: ${controllerStatus}
Displayed session state: ${contextDisplayedSessionState}
Execution safety lock: ${contextPlayLockReason || "clear"}
Signal action: ${contextSnapshot?.signal.action ?? "--"}
Latest price: ${contextSnapshot ? formatMoney(contextSnapshot.latestPrice) : "--"}
Price change: ${formatPercent(contextSnapshot?.priceChangePercent ?? null)}
Top candle signal: ${primaryPattern ? `${primaryPattern.name} ${primaryPattern.bias} ${primaryPattern.confidence}%` : "none"}
Candlestick bias: ${contextSnapshot?.candlestickBias ?? "--"}
Timeframe lens: ${lensReadout ? `${lensReadout.label} ${lensReadout.timeframe}` : "Base"}
Bias: ${bias}
Auto bias: ${autoBiasEnabled ? "on" : "off"}

Structural overview:
${standardModel.overview}

Standard cards:
${standardModel.cards
  .map((card) => `${card.label}: ${card.score} ${card.band} | ${card.summary}`)
  .join("\n")}

Turbo gauges:
${confluenceModel.gauges
  .map((gauge) => `${gauge.label}: ${gauge.score} ${gauge.band} | ${gauge.reason}`)
  .join("\n")}

Overall confluence:
${contextDisplayedOverallScore ?? "--"} ${contextDisplayedOverallBand}
Alignment: ${contextDisplayedAlignmentLabel}
Confluence reason: ${confluenceModel.reason}

Snapshot telemetry:
Relative volume: ${formatRelativeVolume(contextSnapshot?.relativeVolume ?? null)}
Signal freshness: ${formatSignalAge(contextSnapshot?.signalAgeSeconds ?? null)}
EMA stack summary: ${
      contextSnapshot?.ema5 && contextSnapshot?.ema9 && contextSnapshot?.ema20
        ? contextSnapshot.ema5 > contextSnapshot.ema9 && contextSnapshot.ema9 > contextSnapshot.ema20
          ? "fast bullish"
          : contextSnapshot.ema5 < contextSnapshot.ema9 && contextSnapshot.ema9 < contextSnapshot.ema20
            ? "fast bearish"
            : "mixed"
        : "--"
    }
Distance to EMA 20: ${
      contextSnapshot?.ema20
        ? formatSignedPercentValue(
            ((contextSnapshot.latestPrice - contextSnapshot.ema20) / contextSnapshot.ema20) * 100,
          )
        : "--"
    }
Confluence sensitivity: ${confluenceSensitivity}
Order size target: ${formatNumber(orderQtyValue, isCrypto ? 2 : 0)}
Current position qty: ${formatNumber(contextCurrentQty, isCrypto ? 4 : 0)}
Current position P&L: ${formatSignedMoney(contextPositionPnl)}
Snapshot loading: ${isSnapshotLoading ? "yes" : "no"}
Snapshot error: ${error || "(none)"}
Action notice: ${actionNotice || "(none)"}

Turbo contract context:
Selected contract: ${topContractText}
Turbo readiness: ${turboFitScore ?? "--"} ${turboFitBand}
Turbo status: ${turboContractStatus}
Turbo candidate count: ${turboContracts.length}

Open orders:
${openOrderSummary}

Recent orders:
${recentOrderSummary}`;
  }
  const copilotContextText = useMemo(
    () =>
      buildCopilotContextText({
        symbol: normalizedSymbol,
        snapshot,
        controller: activeController,
        position: activePosition,
        confluenceModel: confluence,
        standardModel: standardMarketModel,
        lensReadout: selectedLensReadout,
        requestedSymbolInPrompt: null,
        effectiveMode: mode,
      }),
    [
      activeController,
      activePosition,
      confluence,
      mode,
      normalizedSymbol,
      selectedLensReadout,
      snapshot,
      standardMarketModel,
    ],
  );
  const copilotConversationText = useMemo(
    () =>
      copilotMessages
        .slice(-6)
        .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.text}`)
        .join("\n"),
    [copilotMessages],
  );

  useEffect(() => {
    try {
      const storedClipboard = window.sessionStorage.getItem("algo-v2-clipboard-memory");

      if (storedClipboard) {
        setClipboardMemory(storedClipboard);
      }
    } catch {
      setClipboardMemory("");
    }
  }, []);

  useEffect(() => {
    setSpatialInsight("");
  }, [hoveredSpatialTarget]);

  useEffect(() => {
    if (!spatialPromptTarget || !spatialPromptTargetKey) {
      return;
    }

    if (isSpatialInsightLoading || spatialInsight || lastAutoInsightKey === spatialPromptTargetKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLastAutoInsightKey(spatialPromptTargetKey);
      void handleSpatialInsightRequest();
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    isSpatialInsightLoading,
    lastAutoInsightKey,
    spatialInsight,
    spatialPromptTarget,
    spatialPromptTargetKey,
  ]);

  useEffect(() => {
    try {
      if (clipboardMemory.trim()) {
        window.sessionStorage.setItem("algo-v2-clipboard-memory", clipboardMemory);
      } else {
        window.sessionStorage.removeItem("algo-v2-clipboard-memory");
      }
    } catch {}
  }, [clipboardMemory]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (spatialHudPinned || spatialHudInteractive) {
        return;
      }

      setCursorPosition({ x: event.clientX, y: event.clientY });
    }

    function handleCopy(event: ClipboardEvent) {
      const copiedText =
        event.clipboardData?.getData("text/plain")?.trim() ||
        document.getSelection()?.toString().trim() ||
        "";

      if (copiedText) {
        setClipboardMemory(copiedText.slice(0, 120));
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("copy", handleCopy);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("copy", handleCopy);
    };
  }, [spatialHudInteractive, spatialHudPinned]);

  useEffect(() => {
    if (!autoBiasEnabled || mode !== "turbo") {
      return;
    }

    setBias(autoBiasSuggestion);
  }, [autoBiasEnabled, autoBiasSuggestion, mode]);

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

  async function handleTurboContractTrade(contractSymbol: string) {
    setError("");
    setActionNotice("");
    setIsBusy(true);

    startTransition(async () => {
      try {
        const qty = Math.max(1, Math.round(orderQtyValue || 1));
        const result = await submitTurboOptionPaperTrade({
          contractSymbol,
          qty,
          side: "buy",
        });

        setActionNotice(result.success);
        setSelectedTurboContractSymbol(contractSymbol);
        setTurboContractStatus("ACTIVE");
        setPositions((current) => {
          const next = current.filter((position) => position.symbol !== contractSymbol);

          if (!result.position || result.position.qty === 0) {
            return next;
          }

          return [result.position, ...next];
        });
      } catch (tradeError) {
        setError(
          tradeError instanceof Error
            ? tradeError.message
            : "Unable to submit the Turbo option order right now.",
        );
      } finally {
        setIsBusy(false);
      }
    });
  }

  async function handleTurboPrimaryCommand(command: "PLAY" | "PAUSE" | "RESUME" | "EJECT") {
    if (!selectedTurboContract) {
      setError("Select a suggested contract first.");
      return;
    }

    setError("");
    setActionNotice("");
    setIsBusy(true);

    startTransition(async () => {
      try {
        const qty = Math.max(1, Math.round(orderQtyValue || 1));
        const result = await runTurboOptionControllerCommand({
          contractSymbol: selectedTurboContract.symbol,
          command,
          targetQty: qty,
        });

        setActionNotice(result.success);
        setTurboContractStatus(result.status);
        setPositions((current) => {
          const next = current.filter((position) => position.symbol !== selectedTurboContract.symbol);

          if (!result.position || result.position.qty === 0) {
            return next;
          }

          return [result.position, ...next];
        });
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "Unable to run the Turbo option controller right now.",
        );
      } finally {
        setIsBusy(false);
      }
    });
  }

  async function handleCopilotSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInput = copilotInput.trim();

    if (!trimmedInput || isCopilotLoading) {
      return;
    }

    const nextUserMessage: CopilotMessage = {
      role: "user",
      text: trimmedInput,
    };

    setCopilotInput("");
    setCopilotMessages((current) => [...current, nextUserMessage]);
    setIsCopilotLoading(true);

    try {
      const requestedSymbol = extractRequestedMarketSymbol(trimmedInput) ?? copilotFocusSymbol;
      const requestedTimeframe =
        extractRequestedTimeframe(trimmedInput) ?? copilotFocusTimeframe ?? analysisTimeframe;
      let contextText = copilotContextText;
      let resolvedSymbol = requestedSymbol;

      if (
        (requestedSymbol && requestedSymbol !== normalizedSymbol) ||
        requestedTimeframe !== analysisTimeframe
      ) {
        try {
          const effectiveSymbol = requestedSymbol ?? normalizedSymbol;

          if (!effectiveSymbol) {
            throw new Error("No market ticker is available for this follow-up question.");
          }

          const overrideController =
            controllers.find(
              (controller) =>
                canonicalizeMarketSymbol(controller.symbol) === effectiveSymbol,
            ) ?? null;
          const overridePosition =
            positions.find(
              (position) =>
                canonicalizeMarketSymbol(position.symbol) === effectiveSymbol,
            ) ?? null;
          const overrideSnapshot = await getAlpacaAlgoSnapshot({
            symbol: effectiveSymbol,
            strategyType: overrideController?.strategyType ?? "NONE",
            strategyTimeframe: requestedTimeframe,
            fastPeriod: overrideController?.fastPeriod ?? 5,
            slowPeriod: overrideController?.slowPeriod ?? 20,
            bollingerLength: overrideController?.bollingerLength ?? 20,
            bollingerStdDev: overrideController?.bollingerStdDev ?? 2,
            maxNotional: overrideController?.maxNotional ?? 100,
            maxDailyLoss: overrideController?.maxDailyLoss ?? 25,
          });
          const overrideConfluence = buildConfluenceModel({
            snapshot: overrideSnapshot,
            isCrypto: isCryptoLikeSymbol(effectiveSymbol),
            sensitivity: confluenceSensitivity,
          });
          const overrideTimeframeGauge =
            overrideConfluence.gauges.find((gauge) => gauge.key === "timeframeConfluence") ?? null;
          const overrideLensReadout =
            overrideTimeframeGauge?.lensReadouts?.find((readout) => readout.offset === marketLens) ??
            null;
          const overrideStandardBase = buildStandardMarketModel(overrideSnapshot);
          const overrideTimeframeCard = buildStandardTimeframeCard({
            gauge: overrideTimeframeGauge,
            selectedLensReadout: overrideLensReadout,
          });
          const overrideStandardModel = {
            ...overrideStandardBase,
            cards: overrideTimeframeCard
              ? [...overrideStandardBase.cards, overrideTimeframeCard]
              : overrideStandardBase.cards,
          };

          contextText = buildCopilotContextText({
            symbol: effectiveSymbol,
            snapshot: overrideSnapshot,
            controller: overrideController,
            position: overridePosition,
            confluenceModel: overrideConfluence,
            standardModel: overrideStandardModel,
            lensReadout: overrideLensReadout,
            requestedSymbolInPrompt: requestedSymbol,
            effectiveMode: mode,
          });
          resolvedSymbol = effectiveSymbol;
        } catch {
          contextText = `${copilotContextText}

Follow-up note:
The requested follow-up market refresh could not be loaded, so answer using the most recent available cockpit context. Do not mention internal server errors. If the user asked for a different timeframe or symbol, say the refresh did not complete and answer from the last available read instead.`;
          resolvedSymbol = requestedSymbol ?? normalizedSymbol;
        }
      }

      if (resolvedSymbol) {
        setCopilotFocusSymbol(resolvedSymbol);
      }

      if (requestedTimeframe) {
        setCopilotFocusTimeframe(requestedTimeframe);
        setAnalysisTimeframe(requestedTimeframe);
      }

      if (resolvedSymbol && resolvedSymbol !== normalizedSymbol) {
        setSymbol(resolvedSymbol);
      }

      const response = await fetch("/api/ai/algo-controller-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMessage: trimmedInput,
          contextText,
          conversationText: copilotConversationText,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        reply?: string;
        suggestedActions?: string[];
        warnings?: string[];
        recommendedMode?: CopilotModeRecommendation;
      };

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "The V2 copilot could not respond right now.");
      }

      const reply = payload.reply;

      setCopilotMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: reply,
          suggestedActions: payload.suggestedActions ?? [],
          warnings: payload.warnings ?? [],
          recommendedMode: payload.recommendedMode ?? "hold",
        },
      ]);
    } catch (copilotError) {
      setCopilotMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            copilotError instanceof Error
              ? copilotError.message
              : "The V2 copilot could not respond right now.",
        },
      ]);
    } finally {
      setIsCopilotLoading(false);
    }
  }

  async function handleSpatialInsightRequest(userQuery = "") {
    if (!spatialPromptTarget || isSpatialInsightLoading) {
      return;
    }

    setIsSpatialInsightLoading(true);

    try {
      const response = await fetch("/api/ai/spatial-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cockpit: spatialCockpitContext,
          target: spatialPromptTarget,
          behavior: spatialBehaviorProfile,
          mode: spatialPromptTarget.kind === "contract_card" ? "active_workspace" : "passive_hud",
          userQuery: userQuery.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string; reply?: string };

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "Spatial insight could not load right now.");
      }

      setSpatialInsight(payload.reply);
    } catch (spatialError) {
      setSpatialInsight(
        spatialError instanceof Error
          ? spatialError.message
          : "Spatial insight could not load right now.",
      );
    } finally {
      setIsSpatialInsightLoading(false);
    }
  }

  async function handleSpatialQuerySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = spatialQuery.trim();

    if (!trimmedQuery) {
      return;
    }

    await handleSpatialInsightRequest(trimmedQuery);
  }

  function toggleSpatialHudPin() {
    setSpatialHudPinned((current) => {
      const next = !current;

      if (next) {
        setSpatialHudPinnedPosition({
          x: Math.max(16, cursorPosition.x + 18),
          y: Math.max(16, cursorPosition.y + 18),
        });
        window.setTimeout(() => {
          spatialHudRef.current?.focus();
        }, 0);
      } else {
        setSpatialHudPinnedPosition(null);
      }

      return next;
    });
  }

  return (
    <section
      className="algo-v2-shell"
      onMouseLeave={() => {
        if (!spatialHudPinned) {
          setHoveredSpatialTarget(null);
          setSpatialHudInteractive(false);
        }
      }}
    >
      <div className="algo-v2-stage">
        <div
          className="algo-v2-topbar"
          onMouseEnter={() =>
            setHoveredSpatialTarget({
              kind: "header",
              label: `${normalizedSymbol || "Market"} cockpit`,
              summary: `Session is ${displayedSessionState.toLowerCase()} with ${
                displayedOverallScore ?? "--"
              } overall confluence on ${analysisTimeframe}.`,
            })
          }
        >
          <div className="algo-v2-topbar-left">
            <div className="algo-v2-symbol-badge">{normalizedSymbol || "--"}</div>
            <div>
              <div className="algo-v2-state-strip">
                <span className={`algo-v2-state-pill is-${displayedSessionState.toLowerCase()}`}>
                  {displayedSessionState}
                </span>
                <span className="algo-v2-state-copy">
                  {mode === "turbo" ? "Execution dashboard" : "Structural navigator"}
                </span>
              </div>
              <h2 className="algo-v2-title">
                {normalizedSymbol || "Market"} Controller ({mode === "turbo" ? "Turbo Mode" : "Standard Mode"})
              </h2>
              <p className="algo-v2-subtitle">
                <span className="algo-v2-dot is-green" /> Session live
                <span className="algo-v2-dot is-blue" /> {snapshot?.quoteAgeSeconds !== null ? "Snapshot online" : "Awaiting snapshot"}
              </p>
            </div>
          </div>
          <div className="algo-v2-topbar-right algo-v2-metric-cluster">
            <div className="algo-v2-header-metric">
              <span className="algo-v2-pnl-label">Equity P&amp;L</span>
              <strong className={positionPnl >= 0 ? "algo-v2-pnl is-positive" : "algo-v2-pnl is-negative"}>
                {formatSignedMoney(positionPnl)}
              </strong>
            </div>
            <div className="algo-v2-header-metric is-secondary">
              <span className="algo-v2-pnl-label">Session Time</span>
              <strong className="algo-v2-pnl">{sessionDuration}</strong>
            </div>
          </div>
        </div>

        <div
          className={mode === "turbo" ? "algo-v2-controls-row is-turbo" : "algo-v2-controls-row"}
          onMouseEnter={() =>
            setHoveredSpatialTarget({
              kind: "controls",
              label: "Snapshot controls",
              summary: `${
                clipboardSymbol && clipboardSymbol !== normalizedSymbol
                  ? `Copied ticker ${clipboardSymbol} is ready to load. `
                  : ""
              }Change the market, timeframe, or order size from here.`,
            })
          }
        >
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
              Order Size {mode === "turbo" && !isCrypto ? "(contracts)" : isCrypto ? "(units)" : "(shares)"}
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

          <div className="algo-v2-field algo-v2-field-wide">
            <span className="algo-v2-field-label">Snapshot Controls</span>
            <div className="algo-v2-inline-controls">
              <span className="algo-v2-inline-readout">
                {isSnapshotLoading ? `Refreshing ${normalizedSymbol || "market"}...` : formatTimestamp(snapshot?.lastBarTimestamp ?? null)}
              </span>
              <button
                type="button"
                className="algo-v2-icon-button"
                onClick={() => setSnapshotRefreshKey((current) => current + 1)}
                disabled={isSnapshotLoading}
                aria-label="Refresh snapshot"
                title="Refresh snapshot"
              >
                R
              </button>
            </div>
          </div>

          {mode === "turbo" ? (
            <label className="algo-v2-field algo-v2-field-wide algo-v2-sensitivity-field">
              <span className="algo-v2-field-label">Sensitivity</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={confluenceSensitivity}
                onChange={(event) => setConfluenceSensitivity(Number(event.target.value))}
                className="algo-v2-range"
              />
              <div className="algo-v2-slider-scale">
                <span>Aggressive</span>
                <span>
                  {confluenceSensitivity < 35
                    ? "Aggressive"
                    : confluenceSensitivity > 65
                      ? "Conservative"
                      : "Balanced"}
                </span>
                <span>Conservative</span>
              </div>
            </label>
          ) : null}
        </div>

        {mode === "standard" ? (
          <div className="algo-v2-panel-grid">
            <section className="algo-v2-main-card">
              <div className="algo-v2-panel-heading">
                <div className="algo-v2-panel-heading-main">
                  <div className="algo-v2-panel-icon is-standard">S</div>
                  <div>
                    <h3 className="algo-v2-panel-title">Structural Navigator</h3>
                    <p className="algo-v2-panel-copy">
                      Decision stack view of trend, structure, candle context, and handoff readiness.
                    </p>
                  </div>
                </div>
                <div className="algo-v2-mode-toggle" role="tablist" aria-label="Controller mode">
                  <button
                    type="button"
                    className="algo-v2-mode-button is-active is-standard"
                    onClick={() => setMode("standard")}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className="algo-v2-mode-button"
                    onClick={() => setMode("turbo")}
                  >
                    Turbo
                    <span className="algo-v2-mode-tag">Advanced</span>
                  </button>
                </div>
              </div>

              <div className="algo-v2-confluence-card is-telemetry">
                <div className="algo-v2-confluence-header">
                  <div>
                    <p className="algo-v2-meter-label">Conclusion Header</p>
                    <strong className={`algo-v2-confluence-score ${standardMarketModel.cards[0]?.tone ?? "is-neutral"}`}>
                      {snapshot ? standardMarketModel.overview : "Waiting for a live structural read."}
                    </strong>
                  </div>
                  <div className="algo-v2-confluence-meta">
                    <strong>{standardTelemetryScore}</strong>
                    <span>Navigator score</span>
                  </div>
                </div>
                {snapshot ? (
                  <>
                    <div className="algo-v2-health-meter">
                      <div className="algo-v2-health-meter-track" />
                      <div className="algo-v2-health-meter-thumb" style={{ left: `${standardTelemetryScore}%` }} />
                    </div>
                    <div className="algo-v2-health-meter-scale">
                      <span>Fragile</span>
                      <span>Structure bar</span>
                      <span>Aligned</span>
                    </div>
                  </>
                ) : (
                  <div className="algo-v2-confluence-empty">A market structure summary will appear once a valid snapshot loads.</div>
                )}
                <p className="algo-v2-confluence-copy">
                  {snapshot
                    ? `Price is being compared against the EMA stack, range position, and the strongest recent candle pattern on ${snapshot.timeframe}.`
                    : confluenceStatusReason}
                </p>
              </div>

              {standardHandoffReady ? (
                <div className="algo-v2-handoff-card">
                  <div>
                    <p className="algo-v2-meter-label">Suggested Action</p>
                    <strong>Standard is seeing enough alignment to hand off toward Turbo.</strong>
                    <p className="algo-v2-mini-gauge-copy">
                      Nearby timeframes are cooperating, so this setup may be ready for the execution dashboard.
                    </p>
                  </div>
                  <button type="button" className="algo-v2-handoff-button" onClick={() => setMode("turbo")}>
                    Open Turbo
                  </button>
                </div>
              ) : null}

              <div className="algo-v2-decision-stack">
                <div className="algo-v2-section-header">
                  <div>
                    <p className="algo-v2-meter-label">Decision Stack</p>
                    <strong>Trend, structure, candle signal, then timeframe agreement.</strong>
                  </div>
                </div>
                <div className="algo-v2-mini-gauge-grid is-stack">
                  {standardMarketModel.cards.map((gauge) => (
                    <article
                      key={gauge.key}
                      className="algo-v2-mini-gauge-card is-stack"
                      onMouseEnter={() =>
                        setHoveredSpatialTarget({
                          kind: gauge.label === "Timeframe Confluence" ? "timeframe" : "gauge",
                          label: gauge.label,
                          summary: gauge.summary,
                          score: gauge.score,
                          tone: gauge.tone,
                        })
                      }
                    >
                      <div className="algo-v2-mini-gauge-top">
                        <div>
                          <p className="algo-v2-meter-label">{gauge.label}</p>
                          <strong className={`algo-v2-mini-gauge-score ${gauge.tone}`}>{gauge.score}</strong>
                        </div>
                        <span className={`algo-v2-gauge-band ${gauge.tone}`}>{gauge.band}</span>
                      </div>
                      <div className="algo-v2-mini-track">
                        <span style={{ width: `${gauge.score}%` }} />
                      </div>
                      <p className="algo-v2-mini-gauge-copy">{gauge.summary}</p>
                      {gauge.label === "Timeframe Confluence" && timeframeConfluenceGauge?.lensReadouts ? (
                        <div className="algo-v2-lens-block">
                          <div className="algo-v2-slider-header">
                            <strong>Market Lens</strong>
                            <strong>{selectedLensReadout?.label ?? "Base"}</strong>
                          </div>
                          <input
                            type="range"
                            min="-2"
                            max="2"
                            step="1"
                            value={marketLens}
                            onChange={(event) => setMarketLens(Number(event.target.value) as MarketLensOffset)}
                            className="algo-v2-range"
                          />
                          <div className="algo-v2-slider-scale algo-v2-slider-scale-tight">
                            {MARKET_LENS_STOPS.map((stop) => (
                              <span key={stop.offset}>{stop.label}</span>
                            ))}
                          </div>
                          <p className="algo-v2-lens-copy">
                            {selectedLensReadout
                              ? `${selectedLensReadout.label} · ${selectedLensReadout.timeframe}: ${selectedLensReadout.summary}`
                              : "Move the lens to inspect nearby timeframe agreement."}
                          </p>
                        </div>
                      ) : null}
                      <details className="algo-v2-gauge-debug">
                        <summary>Debug</summary>
                        <div className="algo-v2-debug-list">
                          {gauge.details.map((detail) => (
                            <div key={detail}>
                              <span>{detail}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </div>

              <div className="algo-v2-order-row">
                <div className="algo-v2-slider-card">
                  <div className="algo-v2-slider-header">
                    <strong>Order Size Lever</strong>
                    <strong>
                      {orderQtyValue > 0 ? formatNumber(orderQtyValue, isCrypto ? 2 : 0) : "--"} {isCrypto ? "units" : "shares"}
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
                      Resulting position: {formatNumber(resultingTargetQty, isCrypto ? 2 : 0)} {isCrypto ? "units" : "shares"}
                    </span>
                    <span>Larger</span>
                  </div>
                </div>

                <div className="algo-v2-stat-row is-telemetry">
                  <div>
                    <span className="algo-v2-stat-label">Order Amount</span>
                    <strong className="is-positive">
                      +{formatNumber(pendingChange, isCrypto ? 2 : 0)} {isCrypto ? "units" : "shares"}
                    </strong>
                  </div>
                  <div>
                    <span className="algo-v2-stat-label">Current Position</span>
                    <strong>{formatNumber(currentQty, isCrypto ? 4 : 0)} {isCrypto ? "units" : "shares"}</strong>
                  </div>
                  <div>
                    <span className="algo-v2-stat-label">Signal Freshness</span>
                    <strong>{formatSignalAge(snapshot?.signalAgeSeconds ?? null)}</strong>
                  </div>
                </div>
              </div>
            </section>

            <aside className="algo-v2-side-card">
              <h3 className="algo-v2-mini-title">Telemetry Readout</h3>
              <div className="algo-v2-mini-list">
                <div>
                  <span>Selected market</span>
                  <strong>{normalizedSymbol || "--"}</strong>
                </div>
                <div>
                  <span>Controller state</span>
                  <strong>{activeController?.status ?? "UNSET"}</strong>
                </div>
                <div>
                  <span>EMA stack</span>
                  <strong>
                    {snapshot?.ema5 && snapshot?.ema9 && snapshot?.ema20
                      ? snapshot.ema5 > snapshot.ema9 && snapshot.ema9 > snapshot.ema20
                        ? "Fast bullish"
                        : snapshot.ema5 < snapshot.ema9 && snapshot.ema9 < snapshot.ema20
                          ? "Fast bearish"
                          : "Mixed"
                      : "--"}
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
                  <span>Distance to EMA 20</span>
                  <strong>
                    {snapshot?.ema20 ? formatSignedPercentValue(((snapshot.latestPrice - snapshot.ema20) / snapshot.ema20) * 100) : "--"}
                  </strong>
                </div>
                <div>
                  <span>Top candle signal</span>
                  <strong>{snapshot?.candlestickSignals[0]?.name ?? "None"}</strong>
                </div>
                <div>
                  <span>Pattern bias</span>
                  <strong>{snapshot?.candlestickBias ?? "--"}</strong>
                </div>
                <div>
                  <span>Daily P&amp;L</span>
                  <strong>{snapshot ? formatSignedMoney(snapshot.dailyPnL) : "--"}</strong>
                </div>
              </div>
              <p className="algo-v2-mini-gauge-copy" style={{ marginTop: "1rem" }}>
                {standardMarketModel.overview}
              </p>
            </aside>
          </div>
        ) : (
          <div className="algo-v2-panel-grid is-turbo-layout">
            <section className="algo-v2-main-card">
              <div className="algo-v2-panel-heading">
                <div className="algo-v2-panel-heading-main">
                  <div className="algo-v2-panel-icon is-turbo">T</div>
                  <div>
                    <h3 className="algo-v2-panel-title">Execution Dashboard</h3>
                    <p className="algo-v2-panel-copy">
                      Setup analysis on the left, options controls on the right, and contract targets off to the side.
                    </p>
                  </div>
                </div>
                <div className="algo-v2-mode-toggle" role="tablist" aria-label="Controller mode">
                  <button
                    type="button"
                    className="algo-v2-mode-button"
                    onClick={() => setMode("standard")}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className="algo-v2-mode-button is-active is-turbo"
                    onClick={() => setMode("turbo")}
                  >
                    Turbo
                    <span className="algo-v2-mode-tag">Advanced</span>
                  </button>
                </div>
              </div>

              <div className="algo-v2-turbo-columns">
                <div className="algo-v2-turbo-analysis">
                  <div className="algo-v2-health-meter-card">
                    <div className="algo-v2-confluence-header">
                      <div>
                        <p className="algo-v2-meter-label">Overall Confluence</p>
                        {confluence.isReady ? (
                          <strong className={`algo-v2-confluence-score ${displayedOverallTone}`}>
                            {displayedOverallScore} · {displayedOverallBand}
                          </strong>
                        ) : (
                          <strong className="algo-v2-confluence-score is-neutral">
                            {isSnapshotLoading ? "Loading" : "Unavailable"}
                          </strong>
                        )}
                      </div>
                      <div className="algo-v2-confluence-meta">
                        <strong>{displayedAlignmentLabel}</strong>
                        <span>Decision stack</span>
                      </div>
                    </div>
                    {confluence.isReady && displayedOverallScore !== null ? (
                      <>
                        <div className="algo-v2-health-meter">
                          <div className="algo-v2-health-meter-track" />
                          <div className="algo-v2-health-meter-thumb" style={{ left: `${displayedOverallScore}%` }} />
                        </div>
                        <div className="algo-v2-health-meter-scale">
                          <span>Low</span>
                          <span>Confluence meter</span>
                          <span>High</span>
                        </div>
                      </>
                    ) : (
                      <div className="algo-v2-confluence-empty is-dark">Confluence will appear once a valid snapshot loads.</div>
                    )}
                    <p className="algo-v2-confluence-copy">{confluenceStatusReason}</p>
                  </div>

                  <div className="algo-v2-decision-stack">
                    <div className="algo-v2-section-header">
                      <div>
                        <p className="algo-v2-meter-label">Setup Analysis</p>
                        <strong>Read the stack before you touch execution.</strong>
                      </div>
                    </div>
                    <div className="algo-v2-compact-gauge-row">
                      {confluence.gauges.map((gauge) => (
                        <button
                          key={gauge.key}
                          type="button"
                          className={
                            gauge.key === selectedTurboGauge
                              ? gaugeToggles[gauge.key]
                                ? "algo-v2-compact-gauge is-selected"
                                : "algo-v2-compact-gauge is-selected is-disabled"
                              : gaugeToggles[gauge.key]
                                ? "algo-v2-compact-gauge"
                                : "algo-v2-compact-gauge is-disabled"
                          }
                          onClick={() => setSelectedTurboGauge(gauge.key)}
                          onMouseEnter={() =>
                            setHoveredSpatialTarget({
                              kind: gauge.key === "timeframeConfluence" ? "timeframe" : "gauge",
                              label: gauge.label,
                              summary: gauge.reason,
                              score: gauge.score,
                              tone: gauge.tone,
                            })
                          }
                        >
                          <span className="algo-v2-compact-gauge-label">{gauge.label}</span>
                          <strong className={`algo-v2-compact-gauge-score ${gauge.tone}`}>{gauge.score}</strong>
                          <span className={`algo-v2-gauge-band ${gauge.tone}`}>{gauge.band}</span>
                        </button>
                      ))}
                    </div>
                    {confluence.gauges
                      .filter((gauge) => gauge.key === selectedTurboGauge)
                      .map((gauge) => (
                        <article
                          key={gauge.key}
                          className={gaugeToggles[gauge.key] ? "algo-v2-mini-gauge-card is-stack is-focus" : "algo-v2-mini-gauge-card is-stack is-focus is-disabled"}
                          onMouseEnter={() =>
                            setHoveredSpatialTarget({
                              kind: gauge.key === "timeframeConfluence" ? "timeframe" : "gauge",
                              label: gauge.label,
                              summary: gauge.reason,
                              score: gauge.score,
                              tone: gauge.tone,
                            })
                          }
                        >
                          <div className="algo-v2-mini-gauge-top">
                            <div>
                              <p className="algo-v2-meter-label">{gauge.label}</p>
                              <strong className={`algo-v2-mini-gauge-score ${gauge.tone}`}>{gauge.score}</strong>
                            </div>
                            <span className={`algo-v2-gauge-band ${gauge.tone}`}>{gauge.band}</span>
                          </div>
                          <label className="algo-v2-gauge-toggle">
                            <span>{gaugeToggles[gauge.key] ? "On" : "Off"}</span>
                            <input
                              type="checkbox"
                              checked={gaugeToggles[gauge.key]}
                              onChange={() =>
                                setGaugeToggles((current) => ({
                                  ...current,
                                  [gauge.key]: !current[gauge.key],
                                }))
                              }
                            />
                          </label>
                          <div className="algo-v2-mini-track">
                            <span style={{ width: `${gauge.score}%` }} />
                          </div>
                          <p className="algo-v2-mini-gauge-copy">{gauge.reason}</p>
                          {gauge.key === "timeframeConfluence" && gauge.lensReadouts ? (
                            <div className="algo-v2-lens-block">
                              <div className="algo-v2-slider-header">
                                <strong>Market Lens</strong>
                                <strong>{selectedLensReadout?.label ?? "Base"}</strong>
                              </div>
                              <input
                                type="range"
                                min="-2"
                                max="2"
                                step="1"
                                value={marketLens}
                                onChange={(event) => setMarketLens(Number(event.target.value) as MarketLensOffset)}
                                className="algo-v2-range"
                              />
                              <div className="algo-v2-slider-scale algo-v2-slider-scale-tight">
                                {MARKET_LENS_STOPS.map((stop) => (
                                  <span key={stop.offset}>{stop.label}</span>
                                ))}
                              </div>
                              <p className="algo-v2-lens-copy">
                                {selectedLensReadout
                                  ? `${selectedLensReadout.label} · ${selectedLensReadout.timeframe}: ${selectedLensReadout.summary}`
                                  : "Move the lens to inspect nearby timeframe agreement."}
                              </p>
                            </div>
                          ) : null}
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
                </div>

                <div className="algo-v2-turbo-options">
                  <div className="algo-v2-slider-card">
                    <div className="algo-v2-slider-header">
                      <strong>Options Control</strong>
                      <strong>{turboBiasHeadline}</strong>
                    </div>
                    <p className="algo-v2-mini-gauge-copy">{turboBiasCopy}</p>
                    <div className="algo-v2-turbo-control-group">
                      <div className="algo-v2-inline-stat">
                        <span>Directional rail</span>
                        <strong>{bias === "neutral" ? "Transition" : turboBiasHeadline}</strong>
                      </div>
                      <label className="algo-v2-gauge-toggle">
                        <span>{autoBiasEnabled ? "Auto Bias On" : "Auto Bias Off"}</span>
                        <input
                          type="checkbox"
                          checked={autoBiasEnabled}
                          onChange={(event) => setAutoBiasEnabled(event.target.checked)}
                        />
                      </label>
                    </div>
                    <div className="algo-v2-bias-buttons is-rail">
                      <button type="button" className={getBiasButtonClass(bias, "bearish")} onClick={() => setBias("bearish")}>
                        Put
                      </button>
                      <button type="button" className={getBiasButtonClass(bias, "neutral")} onClick={() => setBias("neutral")}>
                        Transition
                      </button>
                      <button type="button" className={getBiasButtonClass(bias, "bullish")} onClick={() => setBias("bullish")}>
                        Call
                      </button>
                    </div>
                  </div>

                  <div className="algo-v2-slider-card">
                    <div className="algo-v2-slider-header">
                      <strong>Transitions</strong>
                      <strong>{turboCurrentQty > 0 ? "Session live" : "Ready"}</strong>
                    </div>
                    <div className="algo-v2-mini-list">
                      <div>
                        <span>Turbo Readiness</span>
                        <strong className={turboFitTone}>
                          {turboFitScore ?? "--"} {turboFitBand !== "Unavailable" ? turboFitBand : ""}
                        </strong>
                      </div>
                      <div>
                        <span>Execution</span>
                        <strong>{executionGauge?.score ?? "--"}</strong>
                      </div>
                      <div>
                        <span>Timeframe Confluence</span>
                        <strong>{timeframeConfluenceGauge?.score ?? "--"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="algo-v2-slider-card">
                    <div className="algo-v2-slider-header">
                      <strong>Contract Settings</strong>
                      <strong>{deltaTarget.toFixed(2)} · {formatDteLabel(daysToExpiry)}</strong>
                    </div>
                    <div className="algo-v2-contract-settings-grid">
                      <div>
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
                      <div>
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
                  </div>
                </div>
              </div>
            </section>

            <aside
              className={
                turboContracts.length > 0 || turboContractStatus !== "UNSET"
                  ? "algo-v2-side-card algo-v2-turbo-sidecard is-live"
                  : "algo-v2-side-card algo-v2-turbo-sidecard is-idle"
              }
            >
              <h3 className="algo-v2-mini-title">Suggested Contracts</h3>
              <div className="algo-v2-mini-list">
                <div>
                  <span>Lead contract</span>
                  <strong>{contractTelemetrySummary}</strong>
                </div>
                <div>
                  <span>Target expiry</span>
                  <strong>{turboCandidates ? formatOptionExpiration(turboCandidates.targetExpirationDate) : "--"}</strong>
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
                  <span>Signal freshness</span>
                  <strong>{formatSignalAge(snapshot?.signalAgeSeconds ?? null)}</strong>
                </div>
                <div>
                  <span>Contract state</span>
                  <strong>{turboCurrentQty > 0 ? "ACTIVE" : turboContractStatus}</strong>
                </div>
              </div>
              {turboCandidatesError ? <p className="form-error">{turboCandidatesError}</p> : null}
              {isTurboLoading ? <p className="form-help">Loading live option candidates...</p> : null}
              <div className="algo-v2-contract-list">
                {turboContracts.length > 0 ? (
                  turboContracts.map((contract, index) => (
                    <article
                      key={contract.symbol}
                      className={
                        contract.symbol === selectedTurboContract?.symbol
                          ? "algo-v2-contract-card is-primary is-selected"
                          : "algo-v2-contract-card"
                      }
                      onMouseEnter={() =>
                        setHoveredSpatialTarget({
                          kind: "contract",
                          label: `${normalizedSymbol} ${Math.round(contract.strikePrice)}${contract.type === "call" ? "C" : "P"}`,
                          summary: `Fit ${contract.fitScore}, mark ${formatMoney(contract.markPrice)}, breakeven ${formatMoney(contract.breakevenPrice)}.`,
                          score: contract.fitScore,
                          tone: getScoreTone(contract.fitScore),
                          symbol: contract.symbol,
                        })
                      }
                    >
                      <div className="algo-v2-contract-top">
                        <div>
                          <strong>
                            {normalizedSymbol} {formatOptionExpiration(contract.expirationDate)} {Math.round(contract.strikePrice)}
                            {contract.type === "call" ? "C" : "P"}
                          </strong>
                          <span>Fit {contract.fitScore} · {index === 0 ? "best candidate" : "alternate"}</span>
                        </div>
                        <span className={`algo-v2-gauge-band ${getScoreTone(contract.fitScore)}`}>Fit {contract.fitScore}</span>
                      </div>
                      <div className="algo-v2-contract-metrics">
                        <div>
                          <span>Delta</span>
                          <strong>
                            {contract.snapshot.delta !== null && contract.snapshot.delta > 0 ? "+" : ""}
                            {formatNumber(contract.snapshot.delta, 2)}
                          </strong>
                        </div>
                        <div>
                          <span>Mark</span>
                          <strong>{formatMoney(contract.markPrice)}</strong>
                        </div>
                        <div>
                          <span>Spread</span>
                          <strong>{formatOptionSpreadLabel(contract.spreadPercent)}</strong>
                        </div>
                        <div>
                          <span>IV</span>
                          <strong>{formatPercent(contract.snapshot.impliedVolatility, 1)}</strong>
                        </div>
                        <div>
                          <span>IV Rank</span>
                          <strong>Pending</strong>
                        </div>
                        <div>
                          <span>Breakeven</span>
                          <strong>{formatMoney(contract.breakevenPrice)}</strong>
                        </div>
                      </div>
                      <p className="algo-v2-contract-note">
                        Breakeven guide is ready for a chart overlay once the underlying chart is attached to this cockpit.
                      </p>
                      <button
                        type="button"
                        className="algo-v2-contract-select-button"
                        onClick={() => {
                          setSelectedTurboContractSymbol(contract.symbol);
                          setTurboContractStatus(turboCurrentQty > 0 && selectedTurboContract?.symbol === contract.symbol ? "ACTIVE" : "UNSET");
                        }}
                        disabled={isBusy}
                      >
                        {contract.symbol === selectedTurboContract?.symbol ? "Selected" : "Select Contract"}
                      </button>
                      <button
                        type="button"
                        className="algo-v2-contract-trade-button"
                        onClick={() => handleTurboContractTrade(contract.symbol)}
                        disabled={isBusy}
                      >
                        Buy {Math.max(1, Math.round(orderQtyValue || 1))} Contract
                        {Math.max(1, Math.round(orderQtyValue || 1)) === 1 ? "" : "s"}
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="algo-v2-contract-card">
                    <strong>No live contract candidates yet</strong>
                    <span>
                      {bias === "neutral"
                        ? "Choose a bullish or bearish bias to fetch real option candidates."
                        : isCrypto
                          ? "Turbo options currently support stocks and ETFs only."
                          : "Widen the delta target or time horizon and try again."}
                    </span>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        <div
          className="algo-v2-actions is-media-player"
          onMouseEnter={() =>
            setHoveredSpatialTarget({
              kind: "actions",
              label: "Execution bar",
              summary: `The cockpit is ${displayedSessionState.toLowerCase()}. Primary control is ${
                displayedSessionState === "Paused" ? "Resume Session" : displayedSessionState === "Active" ? "Pause Session" : "Arm"
              }.`,
            })
          }
        >
          <div className="algo-v2-action-bar">
            <div className="algo-v2-action-state">
              <p className="algo-v2-meter-label">Media Player</p>
              <strong>{displayedSessionState} session</strong>
              <span>
                {mode === "turbo" && !isCrypto
                  ? `State ${turboCurrentQty > 0 ? "B" : turboContractStatus === "PAUSED" ? "C" : "A"} · ${turboCurrentQty > 0 ? "Active session" : turboContractStatus === "PAUSED" ? "Paused session" : "Waiting for entry"}`
                  : `State ${activeController?.status === "ACTIVE" ? "B" : activeController?.status === "PAUSED" ? "C" : "A"} · ${displayedCommand.helper}`}
              </span>
            </div>
            <div className="algo-v2-action-cluster">
              {displayedSessionState === "Active" ? (
                <>
                  <button
                    type="button"
                    className="algo-v2-action-button is-primary"
                    onClick={() =>
                      mode === "turbo" && !isCrypto
                        ? handleTurboPrimaryCommand("PAUSE")
                        : handleControllerCommand("PAUSE")
                    }
                    disabled={isBusy}
                  >
                    <span className="algo-v2-action-label">Pause Session</span>
                    <span className="algo-v2-action-copy">
                      {mode === "turbo" && !isCrypto ? "Flatten the option while staying armed." : "Flatten the controller while keeping the session warm."}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="algo-v2-action-button is-secondary"
                    onClick={() =>
                      mode === "turbo" && !isCrypto
                        ? handleTurboContractTrade(selectedTurboContract?.symbol ?? "")
                        : handleControllerCommand("PLAY")
                    }
                    disabled={isBusy || (mode === "turbo" && !isCrypto && !selectedTurboContract)}
                  >
                    <span className="algo-v2-action-label">{addActionLabel}</span>
                    <span className="algo-v2-action-copy">{addActionCopy}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={
                    displayedSessionState === "Paused"
                      ? "algo-v2-action-button is-positive"
                      : mode === "turbo" && !isCrypto && (executionGauge?.score ?? 0) < 20
                        ? "algo-v2-action-button is-blocked"
                        : displayedCommand.tone
                  }
                  onClick={() =>
                    mode === "turbo" && !isCrypto
                      ? handleTurboPrimaryCommand(displayedSessionState === "Paused" ? "RESUME" : "PLAY")
                      : handleControllerCommand(displayedSessionState === "Paused" ? "RESUME" : "PLAY")
                  }
                  disabled={displayedSessionState === "Armed" ? playLocked : isBusy}
                >
                  <span className="algo-v2-action-label">
                    {mode === "turbo" && !isCrypto && displayedSessionState === "Armed" && (executionGauge?.score ?? 0) < 20
                      ? "Blocked"
                      : displayedSessionState === "Paused"
                        ? "Resume Session"
                        : "Arm"}
                  </span>
                  <span className="algo-v2-action-copy">
                    {mode === "turbo" && !isCrypto && displayedSessionState === "Armed" && (executionGauge?.score ?? 0) < 20
                      ? "Execution conditions poor. Entry not advised."
                      : displayedSessionState === "Paused"
                        ? "Resume the session from cash while preserving the plan."
                        : displayedCommand.helper}
                  </span>
                </button>
              )}
              <button
                type="button"
                className="algo-v2-action-button is-danger"
                onClick={() =>
                  mode === "turbo" && !isCrypto
                    ? handleTurboPrimaryCommand("EJECT")
                    : handleControllerCommand("EJECT")
                }
                disabled={isBusy}
              >
                <span className="algo-v2-action-label">Eject</span>
                <span className="algo-v2-action-copy">Exit and flatten the current controller cycle.</span>
              </button>
            </div>
          </div>
          {playLockReason ? <p className="algo-v2-lock-note">{playLockReason}</p> : null}
        </div>

        <section className="algo-v2-copilot">
          <div className="algo-v2-copilot-header">
            <div>
              <p className="algo-v2-meter-label">V2 Copilot</p>
              <h3 className="algo-v2-mini-title">Explain and recommend from the live cockpit</h3>
            </div>
            <span className="algo-v2-copilot-badge">
              {isCopilotLoading ? "Thinking" : "Explain-only"}
            </span>
          </div>
          <div className="algo-v2-copilot-log">
            {copilotMessages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={
                  message.role === "assistant"
                    ? "algo-v2-copilot-message is-assistant"
                    : "algo-v2-copilot-message is-user"
                }
              >
                <span className="algo-v2-copilot-role">
                  {message.role === "assistant" ? "Copilot" : "You"}
                </span>
                <p>{message.text}</p>
                {message.recommendedMode ? (
                  <div className="algo-v2-copilot-meta">
                    <span>Recommended mode</span>
                    <strong>{message.recommendedMode}</strong>
                  </div>
                ) : null}
                {message.suggestedActions && message.suggestedActions.length > 0 ? (
                  <div className="algo-v2-copilot-list-block">
                    <span>Suggested actions</span>
                    <ul className="algo-v2-copilot-list">
                      {message.suggestedActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {message.warnings && message.warnings.length > 0 ? (
                  <div className="algo-v2-copilot-list-block is-warning">
                    <span>Warnings</span>
                    <ul className="algo-v2-copilot-list">
                      {message.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <form className="algo-v2-copilot-form" onSubmit={handleCopilotSubmit}>
            <textarea
              className="form-input algo-v2-copilot-input"
              value={copilotInput}
              onChange={(event) => setCopilotInput(event.target.value)}
              placeholder="Ask why the setup is blocked, whether Turbo fits here, or what the gauges are saying."
              rows={3}
            />
            <div className="algo-v2-copilot-actions">
              <p className="algo-v2-copilot-hint">
                The copilot reads the current V2 state, explains it, and recommends next steps. It does not execute trades.
              </p>
              <button
                type="submit"
                className="algo-v2-copilot-submit"
                disabled={isCopilotLoading || !copilotInput.trim()}
              >
                {isCopilotLoading ? "Analyzing..." : "Ask Copilot"}
              </button>
            </div>
          </form>
        </section>

        {actionNotice ? <p className="form-help">{actionNotice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
      {spatialHud ? (
        <div
          ref={spatialHudRef}
          className="algo-v2-spatial-hud"
          tabIndex={0}
          onDoubleClick={toggleSpatialHudPin}
          onMouseEnter={() => {
            if (!spatialHudPinned) {
              setSpatialHudInteractive(true);
              setSpatialHudPinnedPosition({
                x: Math.max(16, cursorPosition.x + 18),
                y: Math.max(16, cursorPosition.y + 18),
              });
            }
          }}
          onMouseLeave={() => {
            if (!spatialHudPinned) {
              setSpatialHudInteractive(false);
              setSpatialHudPinnedPosition(null);
            }
          }}
          style={{
            left: `${spatialHudPinned || spatialHudInteractive
              ? spatialHudPinnedPosition?.x ?? Math.max(16, cursorPosition.x + 18)
              : Math.max(16, cursorPosition.x + 18)}px`,
            top: `${spatialHudPinned || spatialHudInteractive
              ? spatialHudPinnedPosition?.y ?? Math.max(16, cursorPosition.y + 18)
              : Math.max(16, cursorPosition.y + 18)}px`,
          }}
        >
          <div className="algo-v2-spatial-hud-header">
            <span className="algo-v2-spatial-hud-label">Cursor HUD</span>
            <div className="algo-v2-spatial-hud-topline">
              {clipboardMemory ? (
                <span className="algo-v2-spatial-hud-memory">
                  Copied: {clipboardSymbol || clipboardMemory}
                </span>
              ) : null}
              <button
                type="button"
                className="algo-v2-spatial-hud-pin"
                onClick={toggleSpatialHudPin}
              >
                {spatialHudPinned ? "Release Lens" : "Freeze Lens"}
              </button>
            </div>
          </div>
          <strong className={`algo-v2-spatial-hud-title ${spatialHud.tone}`}>{spatialHud.title}</strong>
          <p className="algo-v2-spatial-hud-copy">{spatialHud.summary}</p>
          <div className="algo-v2-spatial-hud-actions">
            {spatialPromptTarget ? (
              <button
                type="button"
                className="algo-v2-spatial-hud-button is-secondary"
                onClick={() => {
                  void handleSpatialInsightRequest();
                }}
              >
                {isSpatialInsightLoading ? "Thinking..." : "Explain"}
              </button>
            ) : null}
            {clipboardSymbol && clipboardSymbol !== normalizedSymbol ? (
              <button
                type="button"
                className="algo-v2-spatial-hud-button"
                onClick={() => setSymbol(clipboardSymbol)}
              >
                Load {clipboardSymbol}
              </button>
            ) : null}
            {hoveredSpatialTarget?.kind === "contract" &&
            hoveredSpatialTarget.symbol &&
            hoveredSpatialTarget.symbol !== selectedTurboContract?.symbol ? (
              <button
                type="button"
                className="algo-v2-spatial-hud-button is-secondary"
                onClick={() => setSelectedTurboContractSymbol(hoveredSpatialTarget.symbol ?? "")}
              >
                Select Contract
              </button>
            ) : null}
          </div>
          {spatialInsight ? (
            <p className="algo-v2-spatial-hud-copy is-insight">{spatialInsight}</p>
          ) : null}
          <form className="algo-v2-spatial-hud-form" onSubmit={handleSpatialQuerySubmit}>
            <input
              className="form-input algo-v2-spatial-hud-input"
              value={spatialQuery}
              onChange={(event) => setSpatialQuery(event.target.value)}
              placeholder="Ask about this target..."
            />
            <button
              type="submit"
              className="algo-v2-spatial-hud-button is-secondary"
              disabled={isSpatialInsightLoading || !spatialQuery.trim()}
            >
              Ask
            </button>
          </form>
          <p className="algo-v2-spatial-hud-hint">
            Hover to auto-explain after a short delay. Double-click the lens to freeze it in place.
          </p>
          <ul className="algo-v2-spatial-hud-list">
            {spatialHud.nextActions.slice(0, 3).map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
