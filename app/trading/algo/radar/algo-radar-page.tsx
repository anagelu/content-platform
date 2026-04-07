"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { getAlpacaAlgoSnapshot } from "../actions";
import type { AlpacaBarTimeframe } from "@/lib/alpaca";

type Snapshot = Awaited<ReturnType<typeof getAlpacaAlgoSnapshot>>;
type GaugeKey = "trend" | "momentum" | "execution" | "timeframeConfluence";
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
type RadarResult = {
  symbol: string;
  snapshot: Snapshot;
  confluence: ConfluenceModel;
  matchedGaugeCount: number;
  enabledGaugeCount: number;
  qualifies: boolean;
  statusLabel: string;
  statusTone: string;
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
  { value: "30Min", label: "30 Min" },
  { value: "1Hour", label: "1 Hour" },
  { value: "1Day", label: "1 Day" },
  { value: "1Week", label: "1 Week" },
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
    return `${Math.round(value)}s ago`;
  }

  if (value < 3600) {
    return `${Math.round(value / 60)}m ago`;
  }

  return `${Math.round(value / 3600)}h ago`;
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
    if (score >= STRONG_GAUGE_THRESHOLD) return "Nearby timeframes strongly agree.";
    if (score >= FAVORABLE_GAUGE_THRESHOLD) return "Nearby timeframes are broadly supportive.";
    if (score >= 46) return "Nearby timeframes are mixed.";
    if (score >= 26) return "Nearby timeframes show weak agreement.";
    return "Nearby timeframes are conflicting.";
  }

  if (label === "Trend") {
    if (score >= STRONG_GAUGE_THRESHOLD) return "Trend structure is strongly supportive.";
    if (score >= FAVORABLE_GAUGE_THRESHOLD) return "Trend structure is supportive.";
    if (score >= 46) return "Trend conditions are mixed.";
    if (score >= 26) return "Trend support is weak.";
    return "Trend structure is unfavorable.";
  }

  if (label === "Momentum") {
    if (score >= STRONG_GAUGE_THRESHOLD) return "Momentum is strong and expanding.";
    if (score >= FAVORABLE_GAUGE_THRESHOLD) return "Momentum is improving.";
    if (score >= 46) return "Momentum is mixed.";
    if (score >= 26) return "Momentum is weak.";
    return "Momentum is unfavorable.";
  }

  if (score >= STRONG_GAUGE_THRESHOLD) return "Execution conditions are strong.";
  if (score >= FAVORABLE_GAUGE_THRESHOLD) return "Execution conditions are acceptable.";
  if (score >= 46) return "Execution conditions are mixed.";
  if (score >= 26) return "Execution conditions are weak.";
  return "Execution conditions are unfavorable.";
}

function getConfluenceReason(favorableCount: number, strongCount: number, total: number) {
  if (strongCount === total && total > 0) {
    return "All enabled detectors are strong.";
  }

  if (favorableCount === total && total > 0) {
    return "All enabled detectors are favorable.";
  }

  if (favorableCount >= Math.max(2, total - 1)) {
    return "Most enabled detectors are favorable.";
  }

  if (favorableCount >= 1) {
    return "Only part of the detector stack is favorable.";
  }

  return "The detector stack is not favorable yet.";
}

function getOverallWeights(): Record<GaugeKey, number> {
  return {
    trend: 0.25,
    momentum: 0.25,
    execution: 0.25,
    timeframeConfluence: 0.25,
  };
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
) {
  const score = Math.round(
    applySensitivityToScore(clamp(weightedScore(subscores, weights), 0, 100), sensitivity),
  );

  return {
    key,
    label,
    score,
    band: getScoreBand(score),
    tone: getScoreTone(score),
    reason: getGaugeReason(label, score),
    subscores,
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
      alignmentLabel: "0 of 4 favorable",
      reason: "A live snapshot is required before radar scoring can run.",
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
  const trendRaw = weightedScore(trendSubscores, GAUGE_WEIGHTS.trend);
  const momentumRaw = weightedScore(momentumSubscores, GAUGE_WEIGHTS.momentum);
  const executionRaw = weightedScore(executionSubscores, GAUGE_WEIGHTS.execution);
  const timeframeSubscores: GaugeSubscore[] = [
    {
      label: "higher trend",
      score: clamp(trendRaw + ((snapshot.emaLong !== null && snapshot.latestPrice > snapshot.emaLong) ? 12 : -8), 0, 100),
    },
    {
      label: "structure agreement",
      score: clamp(50 + ((snapshot.structurePercent ?? 50) - 50) * 1.15, 0, 100),
    },
    {
      label: "lower timing",
      score: clamp(momentumRaw * 0.75 + Math.max(executionRaw - 50, 0) * 0.25, 0, 100),
    },
    {
      label: "alignment",
      score: clamp(100 - (Math.max(trendRaw, momentumRaw, executionRaw) - Math.min(trendRaw, momentumRaw, executionRaw)) * 1.2, 0, 100),
    },
    {
      label: "conflict",
      score: clamp(100 - (Math.abs(trendRaw - momentumRaw) * 0.85 + Math.abs(momentumRaw - executionRaw) * 0.55), 0, 100),
    },
    {
      label: "risk context",
      score: clamp(55 + (executionRaw - 50) * 0.8 - (snapshot.signalAgeSeconds ?? 0) / timeframeProfile.freshnessPenaltyDivisor * 20, 0, 100),
    },
  ];

  const gauges = [
    createGauge("trend", "Trend", trendSubscores, GAUGE_WEIGHTS.trend, sensitivity),
    createGauge("momentum", "Momentum", momentumSubscores, GAUGE_WEIGHTS.momentum, sensitivity),
    createGauge("execution", "Execution", executionSubscores, GAUGE_WEIGHTS.execution, sensitivity),
    createGauge(
      "timeframeConfluence",
      "Timeframe Confluence",
      timeframeSubscores,
      GAUGE_WEIGHTS.timeframeConfluence,
      sensitivity,
    ),
  ];
  const weights = getOverallWeights();
  const overallScore = Math.round(
    gauges.reduce((sum, gauge) => sum + gauge.score * weights[gauge.key], 0) /
      gauges.reduce((sum, gauge) => sum + weights[gauge.key], 0),
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

function parseWatchlist(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[\n, ]+/)
        .map((symbol) => canonicalizeMarketSymbol(symbol))
        .filter(Boolean),
    ),
  );
}

export function AlgoRadarPage({ initialSymbols }: { initialSymbols: string[] }) {
  const [watchlistInput, setWatchlistInput] = useState(
    initialSymbols.length > 0 ? initialSymbols.join("\n") : "SPY\nQQQ\nNVDA\nBTC/USD",
  );
  const [analysisTimeframe, setAnalysisTimeframe] = useState<AlpacaBarTimeframe>("1Day");
  const [confluenceSensitivity, setConfluenceSensitivity] = useState(50);
  const [overallThreshold, setOverallThreshold] = useState(68);
  const [thresholds, setThresholds] = useState<Record<GaugeKey, number>>({
    trend: 61,
    momentum: 61,
    execution: 55,
    timeframeConfluence: 61,
  });
  const [enabledGauges, setEnabledGauges] = useState<Record<GaugeKey, boolean>>({
    trend: true,
    momentum: true,
    execution: true,
    timeframeConfluence: true,
  });
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);
  const [results, setResults] = useState<RadarResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const [lastScanCount, setLastScanCount] = useState(0);

  const parsedWatchlist = useMemo(() => parseWatchlist(watchlistInput), [watchlistInput]);

  useEffect(() => {
    if (initialSymbols.length === 0) {
      return;
    }

    startTransition(() => {
      void handleScan();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan() {
    const symbols = parseWatchlist(watchlistInput);

    if (symbols.length === 0) {
      setError("Add at least one ticker or market pair to scan.");
      setResults([]);
      return;
    }

    setError("");
    setIsScanning(true);

    try {
      const nextResults = await Promise.all(
        symbols.map(async (symbol) => {
          const snapshot = await getAlpacaAlgoSnapshot({
            symbol,
            strategyType: "NONE",
            strategyTimeframe: analysisTimeframe,
            fastPeriod: 5,
            slowPeriod: 20,
            bollingerLength: 20,
            bollingerStdDev: 2,
            maxNotional: 100,
            maxDailyLoss: 25,
          });
          const confluence = buildConfluenceModel({
            snapshot,
            isCrypto: isCryptoLikeSymbol(symbol),
            sensitivity: confluenceSensitivity,
          });
          const activeGauges = confluence.gauges.filter((gauge) => enabledGauges[gauge.key]);
          const matchedGaugeCount = activeGauges.filter(
            (gauge) => gauge.score >= thresholds[gauge.key],
          ).length;
          const qualifies =
            activeGauges.length > 0 &&
            matchedGaugeCount === activeGauges.length &&
            (confluence.overallScore ?? 0) >= overallThreshold;
          const scoreGap =
            activeGauges.length === 0
              ? 999
              : Math.max(
                  ...activeGauges.map((gauge) => Math.max(thresholds[gauge.key] - gauge.score, 0)),
                  Math.max(overallThreshold - (confluence.overallScore ?? 0), 0),
                );

          return {
            symbol,
            snapshot,
            confluence,
            matchedGaugeCount,
            enabledGaugeCount: activeGauges.length,
            qualifies,
            statusLabel: qualifies ? "Alert-ready" : scoreGap <= 8 ? "Close" : "Not ready",
            statusTone: qualifies ? "pipeline-alert-success" : scoreGap <= 8 ? "pipeline-alert-warning" : "pipeline-alert-neutral",
          } satisfies RadarResult;
        }),
      );

      nextResults.sort((left, right) => {
        if (left.qualifies !== right.qualifies) {
          return Number(right.qualifies) - Number(left.qualifies);
        }

        return (right.confluence.overallScore ?? 0) - (left.confluence.overallScore ?? 0);
      });

      setResults(nextResults);
      setLastScanCount(symbols.length);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Unable to scan the radar watchlist right now.",
      );
      setResults([]);
    } finally {
      setIsScanning(false);
    }
  }

  const visibleResults = showOnlyMatches ? results.filter((result) => result.qualifies) : results;
  const matchCount = results.filter((result) => result.qualifies).length;
  const closeCount = results.filter((result) => !result.qualifies && result.statusLabel === "Close").length;

  return (
    <section className="radar-shell">
      <section className="trading-hero-card">
        <h2 className="trading-section-title">Confluence Radar</h2>
        <p>
          Scan a focused watchlist against the detector stack and surface names that are already in
          your favorable range. This first pass is built for in-app discovery and alert readiness,
          not background automation yet.
        </p>
        <p className="meta">
          Detector thresholds only evaluate the enabled gauges below. A symbol becomes alert-ready
          when every enabled gauge clears its threshold and the overall confluence score also
          qualifies.
        </p>
      </section>

      <div className="radar-toolbar">
        <label className="radar-field radar-field-watchlist">
          <span className="algo-v2-field-label">Watchlist</span>
          <textarea
            className="form-input radar-watchlist-input"
            value={watchlistInput}
            onChange={(event) => setWatchlistInput(event.target.value)}
            placeholder={"NVDA\nGOOGL\nSPY\nBTC/USD"}
          />
        </label>

        <label className="radar-field">
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

        <label className="radar-field">
          <span className="algo-v2-field-label">Overall Threshold</span>
          <input
            className="form-input"
            type="number"
            min="0"
            max="100"
            value={overallThreshold}
            onChange={(event) => setOverallThreshold(clamp(Number(event.target.value) || 0, 0, 100))}
          />
        </label>

        <label className="radar-field radar-field-wide">
          <span className="algo-v2-field-label">Confluence Sensitivity</span>
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
            <span>Fast</span>
            <span>
              {confluenceSensitivity < 35
                ? "Fast"
                : confluenceSensitivity > 65
                  ? "Strict"
                  : "Balanced"}
            </span>
            <span>Strict</span>
          </div>
        </label>

        <div className="radar-actions">
          <button type="button" className="button-link" onClick={() => void handleScan()} disabled={isScanning}>
            {isScanning ? "Scanning..." : "Run Radar"}
          </button>
          <label className="checkbox-label radar-inline-toggle">
            <input
              type="checkbox"
              checked={showOnlyMatches}
              onChange={(event) => setShowOnlyMatches(event.target.checked)}
            />
            Show only alert-ready
          </label>
        </div>
      </div>

      <div className="radar-detector-grid">
        {(
          [
            ["trend", "Trend"],
            ["momentum", "Momentum"],
            ["execution", "Execution"],
            ["timeframeConfluence", "Timeframe Confluence"],
          ] as Array<[GaugeKey, string]>
        ).map(([key, label]) => (
          <article key={key} className="radar-detector-card">
            <div className="radar-detector-top">
              <div>
                <p className="algo-v2-meter-label">{label}</p>
                <p className="meta">Trigger when this detector reaches your minimum favorable range.</p>
              </div>
              <label className="algo-v2-gauge-toggle">
                <span>{enabledGauges[key] ? "On" : "Off"}</span>
                <input
                  type="checkbox"
                  checked={enabledGauges[key]}
                  onChange={() =>
                    setEnabledGauges((current) => ({
                      ...current,
                      [key]: !current[key],
                    }))
                  }
                />
              </label>
            </div>
            <input
              className="form-input"
              type="number"
              min="0"
              max="100"
              value={thresholds[key]}
              onChange={(event) =>
                setThresholds((current) => ({
                  ...current,
                  [key]: clamp(Number(event.target.value) || 0, 0, 100),
                }))
              }
            />
          </article>
        ))}
      </div>

      <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
        <div className="trading-metric-card">
          <span className="trading-metric-label">Watchlist size</span>
          <strong>{parsedWatchlist.length}</strong>
        </div>
        <div className="trading-metric-card">
          <span className="trading-metric-label">Alert-ready</span>
          <strong style={{ color: "#166534" }}>{matchCount}</strong>
        </div>
        <div className="trading-metric-card">
          <span className="trading-metric-label">Close setups</span>
          <strong style={{ color: "#92400e" }}>{closeCount}</strong>
        </div>
      </div>

      <section className="radar-results-section">
        <div className="radar-results-header">
          <div>
            <h3 className="card-title">Detector Matches</h3>
            <p className="meta">
              {lastScanCount > 0
                ? `Scanned ${lastScanCount} markets on ${analysisTimeframe}.`
                : "Run the radar to see detector matches."}
            </p>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {visibleResults.length === 0 ? (
          <div className="radar-empty card">
            <p className="meta">
              {isScanning
                ? "Scanning the current watchlist..."
                : "No radar matches to show yet. Add a watchlist and run the scan."}
            </p>
          </div>
        ) : (
          <div className="radar-results-grid">
            {visibleResults.map((result) => (
              <article key={result.symbol} className="radar-result-card">
                <div className="radar-result-top">
                  <div>
                    <h4 className="card-title" style={{ marginBottom: "0.1rem" }}>
                      {result.symbol}
                    </h4>
                    <p className="meta">
                      {formatMoney(result.snapshot.latestPrice)} · {formatPercent(result.snapshot.priceChangePercent)} ·{" "}
                      {formatRelativeVolume(result.snapshot.relativeVolume)}
                    </p>
                  </div>
                  <span className={`pipeline-alert ${result.statusTone}`}>{result.statusLabel}</span>
                </div>

                <div className="radar-overall-row">
                  <strong className={`algo-v2-confluence-score ${result.confluence.overallTone}`}>
                    {result.confluence.overallScore} · {result.confluence.overallBand}
                  </strong>
                  <span className="meta">
                    {result.matchedGaugeCount} of {result.enabledGaugeCount} detectors ready
                  </span>
                </div>
                <p className="meta">{result.confluence.reason}</p>

                <div className="radar-gauge-row">
                  {result.confluence.gauges
                    .filter((gauge) => enabledGauges[gauge.key])
                    .map((gauge) => (
                      <div key={gauge.key} className="radar-mini-gauge">
                        <div className="radar-mini-gauge-top">
                          <span>{gauge.label}</span>
                          <strong className={gauge.tone}>{gauge.score}</strong>
                        </div>
                        <div className="algo-v2-mini-track">
                          <span style={{ width: `${gauge.score}%` }} />
                        </div>
                        <p className="meta">
                          Min {thresholds[gauge.key]} · {gauge.band}
                        </p>
                      </div>
                    ))}
                </div>

                <div className="radar-result-meta">
                  <span>Signal freshness {formatSignalAge(result.snapshot.signalAgeSeconds)}</span>
                  <span>{result.confluence.alignmentLabel}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
