import {
  type AlpacaBar,
  type AlpacaBarTimeframe,
  type AlpacaCredentials,
  getCryptoBars,
  getStockBars,
  isAlpacaCryptoSymbol,
  normalizeAlpacaTradingSymbol,
} from "@/lib/alpaca";
import { analyzeCandlestickPatterns, type PatternSignal } from "@/lib/candlestick-patterns";

type HistoricalSnapshot = {
  symbol: string;
  timeframe: AlpacaBarTimeframe;
  latestPrice: number;
  relativeVolume: number | null;
  quoteAgeSeconds: number | null;
  spreadPercent: number | null;
  emaShort: number | null;
  emaLong: number | null;
  emaShortSlopePercent: number | null;
  vwap: number | null;
  structurePercent: number | null;
  rsi14: number | null;
  macdHistogramPercent: number | null;
  roc12: number | null;
  candleExpansionRatio: number | null;
  priceChangePercent: number;
  candlestickSignals: PatternSignal[];
};

type GaugeKey = "trend" | "momentum" | "execution" | "timeframeConfluence";

type GaugeSubscore = {
  label: string;
  score: number;
};

type LensReadout = {
  offset: -2 | -1 | 0 | 1 | 2;
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

export type AlgoBacktestTrade = {
  timestamp: string;
  entryPrice: number;
  exitPrice: number;
  returnPercent: number;
  maxDrawdownPercent: number;
  barsHeld: number;
  trendScore: number;
  timeframeConfluenceScore: number;
  overallScore: number;
};

export type AlgoBacktestReport = {
  symbol: string;
  timeframe: AlpacaBarTimeframe;
  startDate: string;
  endDate: string;
  barCount: number;
  trades: AlgoBacktestTrade[];
  tradeCount: number;
  wins: number;
  losses: number;
  winRate: number;
  averageReturnPercent: number;
  bestReturnPercent: number | null;
  worstReturnPercent: number | null;
  maxDrawdownPercent: number | null;
  thresholds: {
    trend: number;
    timeframeConfluence: number;
  };
  lookaheadBars: number;
  topSetups: AlgoBacktestTrade[];
  worstSetups: AlgoBacktestTrade[];
};

const FAVORABLE_GAUGE_THRESHOLD = 61;
const STRONG_GAUGE_THRESHOLD = 81;
const MARKET_LENS_STOPS = [
  { offset: -2 as const, label: "In 2" },
  { offset: -1 as const, label: "In 1" },
  { offset: 0 as const, label: "Base" },
  { offset: 1 as const, label: "Out 1" },
  { offset: 2 as const, label: "Out 2" },
];

const GAUGE_WEIGHTS = {
  trend: {
    "EMA alignment": 0.35,
    "VWAP alignment": 0.25,
    Slope: 0.2,
    Structure: 0.2,
  },
  momentum: {
    RSI: 0.25,
    MACD: 0.3,
    ROC: 0.2,
    "candle expansion": 0.25,
  },
  execution: {
    "spread quality": 0.3,
    "relative volume": 0.25,
    "quote stability": 0.2,
    "slippage risk": 0.25,
  },
  timeframeConfluence: {
    "higher trend": 0.2,
    "structure agreement": 0.18,
    "lower timing": 0.18,
    alignment: 0.16,
    conflict: 0.14,
    "risk context": 0.14,
  },
} satisfies Record<GaugeKey, Record<string, number>>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateSimpleMovingAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateExponentialMovingAverageSeries(values: number[], period: number) {
  if (values.length === 0) {
    return [];
  }

  const smoothing = 2 / (period + 1);
  const series: number[] = [];
  let ema = values[0] ?? 0;
  series.push(ema);

  for (let index = 1; index < values.length; index += 1) {
    ema = values[index] * smoothing + ema * (1 - smoothing);
    series.push(ema);
  }

  return series;
}

function calculateRelativeVolume(volumes: number[]) {
  if (volumes.length < 2) {
    return null;
  }

  const latestVolume = volumes.at(-1) ?? 0;
  const baselineVolumes = volumes.slice(0, -1);
  const averageVolume = calculateSimpleMovingAverage(baselineVolumes);

  if (averageVolume <= 0) {
    return null;
  }

  return latestVolume / averageVolume;
}

function calculateVwap(bars: Array<{ high: number; low: number; close: number; volume: number }>) {
  let weightedTotal = 0;
  let volumeTotal = 0;

  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    weightedTotal += typicalPrice * bar.volume;
    volumeTotal += bar.volume;
  }

  if (volumeTotal <= 0) {
    return null;
  }

  return weightedTotal / volumeTotal;
}

function calculateStructurePercent(
  bars: Array<{ high: number; low: number; close: number }>,
  lookback = 20,
) {
  if (bars.length === 0) {
    return null;
  }

  const sample = bars.slice(-lookback);
  const latestClose = sample.at(-1)?.close ?? null;
  const highestHigh = Math.max(...sample.map((bar) => bar.high));
  const lowestLow = Math.min(...sample.map((bar) => bar.low));

  if (latestClose === null || highestHigh <= lowestLow) {
    return null;
  }

  return ((latestClose - lowestLow) / (highestHigh - lowestLow)) * 100;
}

function calculateRsi(values: number[], period: number) {
  if (values.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateMacd(values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (values.length < slowPeriod + signalPeriod) {
    return {
      line: null,
      signal: null,
      histogram: null,
    };
  }

  const fastSeries = calculateExponentialMovingAverageSeries(values, fastPeriod);
  const slowSeries = calculateExponentialMovingAverageSeries(values, slowPeriod);
  const macdSeries = values.map((_, index) => fastSeries[index] - slowSeries[index]);
  const signalSeries = calculateExponentialMovingAverageSeries(macdSeries, signalPeriod);
  const line = macdSeries.at(-1) ?? null;
  const signal = signalSeries.at(-1) ?? null;

  return {
    line,
    signal,
    histogram: line !== null && signal !== null ? line - signal : null,
  };
}

function calculateRoc(values: number[], period: number) {
  if (values.length <= period) {
    return null;
  }

  const previous = values.at(-(period + 1)) ?? null;
  const latest = values.at(-1) ?? null;

  if (!previous || !latest) {
    return null;
  }

  return ((latest - previous) / previous) * 100;
}

function calculateCandleExpansionRatio(
  bars: Array<{ open: number; high: number; low: number; close: number }>,
  lookback = 10,
) {
  if (bars.length < 2) {
    return null;
  }

  const latestBar = bars.at(-1);
  if (!latestBar) {
    return null;
  }

  const recentBars = bars.slice(-Math.max(lookback, 2), -1);
  const latestRange = Math.max(latestBar.high - latestBar.low, Math.abs(latestBar.close - latestBar.open));
  const averageRange =
    recentBars.reduce(
      (sum, bar) => sum + Math.max(bar.high - bar.low, Math.abs(bar.close - bar.open)),
      0,
    ) / recentBars.length;

  if (averageRange <= 0) {
    return null;
  }

  return latestRange / averageRange;
}

function scoreFromSignedPercent(value: number | null, positiveRange = 3) {
  if (value === null || !Number.isFinite(value)) {
    return 50;
  }

  return clamp(50 + (value / positiveRange) * 50, 0, 100);
}

function scoreFromCenteredValue(value: number | null, center = 50, divisor = 1) {
  if (value === null || !Number.isFinite(value)) {
    return 50;
  }

  return clamp(50 + ((value - center) / divisor), 0, 100);
}

function scoreFromInversePercent(value: number | null, ideal = 0.02, worst = 0.2) {
  if (value === null || !Number.isFinite(value)) {
    return 50;
  }

  if (value <= ideal) {
    return 100;
  }

  if (value >= worst) {
    return 0;
  }

  return clamp(100 - ((value - ideal) / (worst - ideal)) * 100, 0, 100);
}

function applySensitivityToScore(rawScore: number, sensitivity: number) {
  const bias = (sensitivity - 50) / 50;

  if (Math.abs(bias) < 0.01) {
    return clamp(rawScore, 0, 100);
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

function getScoreBand(score: number) {
  if (score <= 25) return "Unfavorable";
  if (score <= 45) return "Weak";
  if (score <= 60) return "Mixed";
  if (score <= 80) return "Favorable";
  return "Strong";
}

function getScoreTone(score: number) {
  if (score >= 81) return "is-strong";
  if (score >= 61) return "is-positive";
  if (score >= 46) return "is-neutral";
  return "is-negative";
}

function getGaugeReason(label: string, score: number) {
  if (label === "Trend") {
    return score >= 61 ? "Trend structure is supportive." : score >= 46 ? "Trend structure is mixed." : "Trend support is weak.";
  }

  if (label === "Momentum") {
    return score >= 61 ? "Momentum is improving." : score >= 46 ? "Momentum is mixed." : "Momentum is weak.";
  }

  if (label === "Execution") {
    return score >= 61 ? "Execution conditions are acceptable." : score >= 46 ? "Execution conditions are mixed." : "Execution conditions are weak.";
  }

  return score >= 61
    ? "Nearby timeframes broadly support this setup."
    : score >= 46
      ? "Nearby timeframes are mixed."
      : "Nearby timeframes are conflicted.";
}

function getConfluenceReason(favorableCount: number, strongCount: number, total: number) {
  if (strongCount === total && total > 0) {
    return "All gauges are strong right now.";
  }
  if (favorableCount === total && total > 0) {
    return "All active gauges are favorable right now.";
  }
  if (favorableCount === 0) {
    return "Current market conditions are not yet favorable.";
  }
  if (favorableCount === 1) {
    return "Only one gauge is favorable right now.";
  }
  return "Market conditions are leaning favorable, but not all gauges agree.";
}

function getTimeframeProfile(timeframe: AlpacaBarTimeframe) {
  switch (timeframe) {
    case "1Min":
      return { trendMultiplier: 0.75, momentumMultiplier: 1.25, executionFreshnessDivisor: 18, freshnessPenaltyDivisor: 240 };
    case "5Min":
      return { trendMultiplier: 0.85, momentumMultiplier: 1.15, executionFreshnessDivisor: 28, freshnessPenaltyDivisor: 420 };
    case "15Min":
      return { trendMultiplier: 0.95, momentumMultiplier: 1.05, executionFreshnessDivisor: 42, freshnessPenaltyDivisor: 720 };
    case "30Min":
      return { trendMultiplier: 1, momentumMultiplier: 1, executionFreshnessDivisor: 60, freshnessPenaltyDivisor: 1200 };
    case "1Hour":
      return { trendMultiplier: 1.08, momentumMultiplier: 0.92, executionFreshnessDivisor: 120, freshnessPenaltyDivisor: 2400 };
    case "1Day":
      return { trendMultiplier: 1.18, momentumMultiplier: 0.82, executionFreshnessDivisor: 720, freshnessPenaltyDivisor: 28800 };
    case "1Week":
      return { trendMultiplier: 1.25, momentumMultiplier: 0.72, executionFreshnessDivisor: 7200, freshnessPenaltyDivisor: 172800 };
  }
}

function getShiftedTimeframe(timeframe: AlpacaBarTimeframe, offset: -2 | -1 | 0 | 1 | 2): AlpacaBarTimeframe {
  const ladders: Record<AlpacaBarTimeframe, AlpacaBarTimeframe[]> = {
    "1Min": ["1Min", "5Min", "15Min"],
    "5Min": ["1Min", "5Min", "15Min", "30Min", "1Hour"],
    "15Min": ["1Min", "5Min", "15Min", "30Min", "1Hour", "1Day"],
    "30Min": ["5Min", "15Min", "30Min", "1Hour", "1Day", "1Week"],
    "1Hour": ["15Min", "30Min", "1Hour", "1Day", "1Week"],
    "1Day": ["30Min", "1Hour", "1Day", "1Week"],
    "1Week": ["1Hour", "1Day", "1Week"],
  };
  const ladder = ladders[timeframe];
  const currentIndex = ladder.indexOf(timeframe);
  const targetIndex = clamp(currentIndex + offset, 0, ladder.length - 1);
  return ladder[targetIndex] ?? timeframe;
}

function getLensSummary(score: number, offset: -2 | -1 | 0 | 1 | 2) {
  if (offset < 0) {
    return score >= 61 ? "Zooming in still supports the entry." : "Zooming in shows weaker entry timing.";
  }
  if (offset > 0) {
    return score >= 61 ? "Zooming out keeps the broader structure supportive." : "Zooming out weakens the broader trend agreement.";
  }
  return score >= 61 ? "The base timeframe remains supportive." : "The base timeframe is tentative.";
}

function createGauge(
  key: GaugeKey,
  label: string,
  subscores: GaugeSubscore[],
  weights: Record<string, number>,
  sensitivity: number,
  lensReadouts?: LensReadout[],
): GaugeResult {
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
    lensReadouts,
  };
}

function getOverallWeights() {
  return {
    trend: 1 / 4,
    momentum: 1 / 4,
    execution: 1 / 4,
    timeframeConfluence: 1 / 4,
  } satisfies Record<GaugeKey, number>;
}

function buildConfluenceModel(snapshot: HistoricalSnapshot, sensitivity: number) {
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
      score: scoreFromSignedPercent(snapshot.emaShortSlopePercent, 18 * timeframeProfile.trendMultiplier),
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
      score: scoreFromSignedPercent(snapshot.macdHistogramPercent, 160 * timeframeProfile.momentumMultiplier),
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
      score: scoreFromInversePercent(snapshot.spreadPercent, 0.01, 0.12),
    },
    {
      label: "relative volume",
      score: clamp(snapshot.relativeVolume === null ? 50 : 34 + snapshot.relativeVolume * 24, 0, 100),
    },
    {
      label: "quote stability",
      score: clamp(
        snapshot.quoteAgeSeconds === null
          ? 92
          : 92 - snapshot.quoteAgeSeconds / timeframeProfile.executionFreshnessDivisor,
        0,
        100,
      ),
    },
    {
      label: "slippage risk",
      score: clamp(
        78 -
          (snapshot.spreadPercent ?? 0.08) * 120 +
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

    const adjusted = Math.round(applySensitivityToScore(lensScore, sensitivity));
    return {
      offset: stop.offset,
      label: stop.label,
      timeframe: lensTimeframe,
      score: adjusted,
      summary: getLensSummary(adjusted, stop.offset),
    };
  });

  const timeframeSubscores: GaugeSubscore[] = [
    {
      label: "higher trend",
      score: clamp(
        baseTrendScore +
          ((lensReadouts.find((lens) => lens.offset === 1)?.score ?? 50) - 50) * 0.7 +
          ((lensReadouts.find((lens) => lens.offset === 2)?.score ?? 50) - 50) * 0.9,
        0,
        100,
      ),
    },
    {
      label: "structure agreement",
      score: clamp(
        50 +
          ((snapshot.structurePercent ?? 50) - 50) * 1.1 +
          Math.abs((snapshot.emaShortSlopePercent ?? 0) * 12),
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
            Math.min(...lensReadouts.map((lens) => lens.score))) * 1.2,
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
        55 + (baseExecutionScore - 50) * 0.8,
        0,
        100,
      ),
    },
  ];

  const gauges = [
    createGauge("trend", "Trend", trendSubscores, GAUGE_WEIGHTS.trend, sensitivity),
    createGauge("momentum", "Momentum", momentumSubscores, GAUGE_WEIGHTS.momentum, sensitivity),
    createGauge("execution", "Execution", executionSubscores, GAUGE_WEIGHTS.execution, sensitivity),
    createGauge("timeframeConfluence", "Timeframe Confluence", timeframeSubscores, GAUGE_WEIGHTS.timeframeConfluence, sensitivity, lensReadouts),
  ];

  const overallWeights = getOverallWeights();
  const overallScore = Math.round(
    gauges.reduce((sum, gauge) => sum + gauge.score * overallWeights[gauge.key], 0),
  );
  const favorableCount = gauges.filter((gauge) => gauge.score >= FAVORABLE_GAUGE_THRESHOLD).length;
  const strongCount = gauges.filter((gauge) => gauge.score >= STRONG_GAUGE_THRESHOLD).length;

  return {
    gauges,
    overallScore,
    overallBand: getScoreBand(overallScore),
    overallTone: getScoreTone(overallScore),
    alignmentLabel: `${favorableCount} of ${gauges.length} favorable`,
    reason: getConfluenceReason(favorableCount, strongCount, gauges.length),
  };
}

function buildHistoricalSnapshot(
  symbol: string,
  timeframe: AlpacaBarTimeframe,
  bars: AlpacaBar[],
): HistoricalSnapshot {
  const normalizedBars = bars;
  const latestBar = normalizedBars.at(-1);

  if (!latestBar) {
    throw new Error("No historical bars available for the selected range.");
  }

  const closes = normalizedBars.map((bar) => bar.close);
  const volumes = normalizedBars.map((bar) => bar.volume);
  const latestPrice = latestBar.close;
  const previousClose = closes.at(-2) ?? null;
  const priceChangePercent =
    previousClose && previousClose > 0 ? Number((((latestPrice - previousClose) / previousClose) * 100).toFixed(2)) : 0;
  const relativeVolumeRaw = calculateRelativeVolume(volumes);
  const relativeVolume = relativeVolumeRaw === null ? null : Number(relativeVolumeRaw.toFixed(2));
  const emaShortSeries = calculateExponentialMovingAverageSeries(closes, 9);
  const emaLongSeries = calculateExponentialMovingAverageSeries(closes, 100);
  const emaShort = emaShortSeries.at(-1) ?? null;
  const emaLong = emaLongSeries.at(-1) ?? null;
  const emaShortLookback = emaShortSeries.length > 5 ? emaShortSeries.at(-6) ?? null : null;
  const emaShortSlopePercent =
    emaShort !== null && emaShortLookback && emaShortLookback > 0
      ? Number((((emaShort - emaShortLookback) / emaShortLookback) * 100).toFixed(3))
      : null;
  const vwapRaw = calculateVwap(normalizedBars);
  const structurePercentRaw = calculateStructurePercent(normalizedBars);
  const rsi14Raw = calculateRsi(closes, 14);
  const macd = calculateMacd(closes);
  const roc12Raw = calculateRoc(closes, 12);
  const candleExpansionRatioRaw = calculateCandleExpansionRatio(normalizedBars);
  const candlestickAnalysis = analyzeCandlestickPatterns(
    normalizedBars.slice(-5).map((bar) => ({
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    })),
  );

  return {
    symbol,
    timeframe,
    latestPrice,
    relativeVolume,
    quoteAgeSeconds: 0,
    spreadPercent: null,
    emaShort: emaShort === null ? null : Number(emaShort.toFixed(4)),
    emaLong: emaLong === null ? null : Number(emaLong.toFixed(4)),
    emaShortSlopePercent,
    vwap: vwapRaw === null ? null : Number(vwapRaw.toFixed(4)),
    structurePercent: structurePercentRaw === null ? null : Number(structurePercentRaw.toFixed(2)),
    rsi14: rsi14Raw === null ? null : Number(rsi14Raw.toFixed(2)),
    macdHistogramPercent:
      macd.histogram === null || latestPrice <= 0 ? null : Number(((macd.histogram / latestPrice) * 100).toFixed(4)),
    roc12: roc12Raw === null ? null : Number(roc12Raw.toFixed(2)),
    candleExpansionRatio: candleExpansionRatioRaw === null ? null : Number(candleExpansionRatioRaw.toFixed(2)),
    priceChangePercent,
    candlestickSignals: candlestickAnalysis.signals,
  };
}

function getWarmupBars(timeframe: AlpacaBarTimeframe) {
  return timeframe === "1Week" ? 60 : timeframe === "1Day" ? 140 : 120;
}

export async function runAlgoBacktest({
  symbol,
  timeframe,
  startDate,
  endDate,
  trendThreshold = 70,
  timeframeConfluenceThreshold = 60,
  lookaheadBars = 60,
  sensitivity = 50,
  credentials,
}: {
  symbol: string;
  timeframe: AlpacaBarTimeframe;
  startDate: string;
  endDate: string;
  trendThreshold?: number;
  timeframeConfluenceThreshold?: number;
  lookaheadBars?: number;
  sensitivity?: number;
  credentials: AlpacaCredentials;
}): Promise<AlgoBacktestReport> {
  const normalizedSymbol = normalizeAlpacaTradingSymbol(symbol);

  if (!normalizedSymbol) {
    throw new Error("Add a ticker symbol first.");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Choose a valid start and end date.");
  }

  if (start > end) {
    throw new Error("Start date must be on or before the end date.");
  }

  const isCrypto = isAlpacaCryptoSymbol(normalizedSymbol);
  const bars = (
    isCrypto
      ? await getCryptoBars(normalizedSymbol, { timeframe, limit: 10000, start, end }, credentials)
      : await getStockBars(normalizedSymbol, { timeframe, limit: 10000, start, end }, credentials)
  ).sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  if (bars.length === 0) {
    throw new Error("No historical bars were returned for this symbol and date range.");
  }

  const warmupBars = getWarmupBars(timeframe);
  const trades: AlgoBacktestTrade[] = [];

  for (let index = warmupBars; index < bars.length - 1; index += 1) {
    const history = bars.slice(0, index + 1);
    const future = bars.slice(index + 1, index + 1 + lookaheadBars);

    if (future.length === 0) {
      continue;
    }

    const snapshot = buildHistoricalSnapshot(normalizedSymbol, timeframe, history);
    const confluence = buildConfluenceModel(snapshot, sensitivity);
    const trendScore = confluence.gauges.find((gauge) => gauge.key === "trend")?.score ?? 0;
    const timeframeScore =
      confluence.gauges.find((gauge) => gauge.key === "timeframeConfluence")?.score ?? 0;

    if (trendScore < trendThreshold || timeframeScore < timeframeConfluenceThreshold) {
      continue;
    }

    const entryBar = bars[index];
    const exitBar = future.at(-1) ?? future[0];
    const entryPrice = entryBar.close;
    const exitPrice = exitBar.close;
    const minFutureLow = Math.min(...future.map((bar) => bar.low));
    const returnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    const maxDrawdownPercent = ((minFutureLow - entryPrice) / entryPrice) * 100;

    trades.push({
      timestamp: entryBar.timestamp,
      entryPrice,
      exitPrice,
      returnPercent: Number(returnPercent.toFixed(2)),
      maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
      barsHeld: future.length,
      trendScore,
      timeframeConfluenceScore: timeframeScore,
      overallScore: confluence.overallScore,
    });

    index += Math.max(0, lookaheadBars - 1);
  }

  const wins = trades.filter((trade) => trade.returnPercent > 0).length;
  const losses = trades.filter((trade) => trade.returnPercent <= 0).length;
  const averageReturnPercent =
    trades.length > 0
      ? Number((trades.reduce((sum, trade) => sum + trade.returnPercent, 0) / trades.length).toFixed(2))
      : 0;
  const maxDrawdownPercent =
    trades.length > 0
      ? Math.min(...trades.map((trade) => trade.maxDrawdownPercent))
      : null;

  return {
    symbol: normalizedSymbol,
    timeframe,
    startDate,
    endDate,
    barCount: bars.length,
    trades,
    tradeCount: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0,
    averageReturnPercent,
    bestReturnPercent: trades.length > 0 ? Math.max(...trades.map((trade) => trade.returnPercent)) : null,
    worstReturnPercent: trades.length > 0 ? Math.min(...trades.map((trade) => trade.returnPercent)) : null,
    maxDrawdownPercent,
    thresholds: {
      trend: trendThreshold,
      timeframeConfluence: timeframeConfluenceThreshold,
    },
    lookaheadBars,
    topSetups: [...trades].sort((a, b) => b.returnPercent - a.returnPercent).slice(0, 5),
    worstSetups: [...trades].sort((a, b) => a.returnPercent - b.returnPercent).slice(0, 5),
  };
}
