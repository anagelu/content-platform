import {
  getAlpacaAccount,
  type AlpacaCredentials,
  type AlpacaBarTimeframe,
  getAlpacaCredentials,
  getCryptoBars,
  getAlpacaPosition,
  getLatestCryptoQuote,
  getLatestCryptoTrade,
  getLatestStockQuote,
  getLatestStockTrade,
  getStockBars,
  isAlpacaCryptoSymbol,
  normalizeAlpacaTradingSymbol,
} from "@/lib/alpaca";
import {
  analyzeCandlestickPatterns,
  type PatternBias,
  type PatternSignal,
} from "@/lib/candlestick-patterns";

export type AlpacaPaperStrategyDecision =
  | { action: "buy"; reason: string }
  | { action: "sell"; reason: string }
  | { action: "hold"; reason: string };

export type AlpacaPaperStrategyType = "NONE" | "SMA" | "EMA" | "BOLLINGER";

export type AlpacaPaperStrategySnapshot = {
  mode: "analysis-only";
  environment: "paper" | "live";
  symbol: string;
  timeframe: AlpacaBarTimeframe;
  strategyType: AlpacaPaperStrategyType;
  latestPrice: number;
  dailyPnL: number;
  maxNotional: number;
  maxDailyLoss: number;
  fastPeriod: number;
  slowPeriod: number;
  bollingerLength: number;
  bollingerStdDev: number;
  bollingerBasis: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  position: {
    qty: number;
    avgEntryPrice: number;
    marketValue: number;
    unrealizedPl: number;
  } | null;
  signal: AlpacaPaperStrategyDecision;
  latestTradePrice: number;
  latestTradeTimestamp: string;
  quoteTimestamp: string;
  lastBarTimestamp: string | null;
  trendStrength: number;
  priceChangePercent: number;
  relativeVolume: number | null;
  signalAgeSeconds: number | null;
  quoteAgeSeconds: number | null;
  spreadPercent: number | null;
  ema5: number | null;
  ema9: number | null;
  ema20: number | null;
  ema100: number | null;
  ema200: number | null;
  ema5SlopePercent: number | null;
  ema9SlopePercent: number | null;
  ema20SlopePercent: number | null;
  ema100SlopePercent: number | null;
  ema200SlopePercent: number | null;
  candlestickBias: PatternBias;
  candlestickScore: number;
  candlestickSignals: PatternSignal[];
  emaShort: number | null;
  emaLong: number | null;
  emaShortSlopePercent: number | null;
  vwap: number | null;
  structurePercent: number | null;
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdHistogramPercent: number | null;
  roc12: number | null;
  candleExpansionRatio: number | null;
};

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function calculateSimpleMovingAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateExponentialMovingAverage(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }

  const smoothing = 2 / (period + 1);
  let ema = values[0] ?? 0;

  for (let index = 1; index < values.length; index += 1) {
    ema = values[index] * smoothing + ema * (1 - smoothing);
  }

  return ema;
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

function calculateStandardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const mean = calculateSimpleMovingAverage(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function pickFirstUsablePrice(...values: Array<number | null | undefined>) {
  return values.find(
    (value): value is number => typeof value === "number" && value > 0,
  ) ?? null;
}

function buildStrategyDecision({
  closes,
  fastPeriod,
  slowPeriod,
  hasLongPosition,
}: {
  closes: number[];
  fastPeriod: number;
  slowPeriod: number;
  hasLongPosition: boolean;
}): AlpacaPaperStrategyDecision {
  if (closes.length < slowPeriod) {
    return {
      action: "hold",
      reason: `Need at least ${slowPeriod} candles before the moving-average signal is valid.`,
    };
  }

  const fastAverage = calculateSimpleMovingAverage(closes.slice(-fastPeriod));
  const slowAverage = calculateSimpleMovingAverage(closes.slice(-slowPeriod));

  if (fastAverage > slowAverage && !hasLongPosition) {
    return {
      action: "buy",
      reason: `Fast SMA ${fastAverage.toFixed(2)} crossed above slow SMA ${slowAverage.toFixed(2)}.`,
    };
  }

  if (fastAverage < slowAverage && hasLongPosition) {
    return {
      action: "sell",
      reason: `Fast SMA ${fastAverage.toFixed(2)} moved below slow SMA ${slowAverage.toFixed(2)}.`,
    };
  }

  return {
    action: "hold",
    reason: `Fast SMA ${fastAverage.toFixed(2)} vs slow SMA ${slowAverage.toFixed(2)} does not require a position change.`,
  };
}

function buildEmaDecision({
  closes,
  fastPeriod,
  slowPeriod,
  hasLongPosition,
}: {
  closes: number[];
  fastPeriod: number;
  slowPeriod: number;
  hasLongPosition: boolean;
}) {
  if (closes.length < slowPeriod) {
    return {
      action: "hold" as const,
      reason: `Need at least ${slowPeriod} candles before the EMA signal is valid.`,
    };
  }

  const fastAverage = calculateExponentialMovingAverage(closes, fastPeriod);
  const slowAverage = calculateExponentialMovingAverage(closes, slowPeriod);

  if (fastAverage > slowAverage && !hasLongPosition) {
    return {
      action: "buy" as const,
      reason: `Fast EMA ${fastAverage.toFixed(2)} crossed above slow EMA ${slowAverage.toFixed(2)}.`,
    };
  }

  if (fastAverage < slowAverage && hasLongPosition) {
    return {
      action: "sell" as const,
      reason: `Fast EMA ${fastAverage.toFixed(2)} moved below slow EMA ${slowAverage.toFixed(2)}.`,
    };
  }

  return {
    action: "hold" as const,
    reason: `Fast EMA ${fastAverage.toFixed(2)} vs slow EMA ${slowAverage.toFixed(2)} does not require a position change.`,
  };
}

function buildBollingerDecision({
  closes,
  latestPrice,
  hasLongPosition,
  bollingerLength,
  bollingerStdDev,
}: {
  closes: number[];
  latestPrice: number;
  hasLongPosition: boolean;
  bollingerLength: number;
  bollingerStdDev: number;
}) {
  if (closes.length < bollingerLength) {
    return {
      signal: {
        action: "hold" as const,
        reason: `Need at least ${bollingerLength} candles before the Bollinger signal is valid.`,
      },
      basis: null,
      upper: null,
      lower: null,
    };
  }

  const sample = closes.slice(-bollingerLength);
  const basis = calculateSimpleMovingAverage(sample);
  const deviation = calculateStandardDeviation(sample) * bollingerStdDev;
  const upper = basis + deviation;
  const lower = basis - deviation;

  if (latestPrice <= lower && !hasLongPosition) {
    return {
      signal: {
        action: "buy" as const,
        reason: `Price ${latestPrice.toFixed(4)} is near or below the lower Bollinger band ${lower.toFixed(4)}.`,
      },
      basis,
      upper,
      lower,
    };
  }

  if (latestPrice >= upper && hasLongPosition) {
    return {
      signal: {
        action: "sell" as const,
        reason: `Price ${latestPrice.toFixed(4)} is near or above the upper Bollinger band ${upper.toFixed(4)}.`,
      },
      basis,
      upper,
      lower,
    };
  }

  return {
    signal: {
      action: "hold" as const,
      reason: `Price ${latestPrice.toFixed(4)} is inside the Bollinger band range ${lower.toFixed(4)} to ${upper.toFixed(4)}.`,
    },
    basis,
    upper,
    lower,
  };
}

function buildNoStrategyDecision(): AlpacaPaperStrategyDecision {
  return {
    action: "hold",
    reason:
      "No automated strategy is active. Use the controller for direct manual entry and exit.",
  };
}

function calculatePriceChangePercent(currentPrice: number, referencePrice: number | null) {
  if (!referencePrice || referencePrice <= 0) {
    return 0;
  }

  return ((currentPrice - referencePrice) / referencePrice) * 100;
}

function calculateTrendStrength(closes: number[], latestPrice: number) {
  if (closes.length === 0) {
    return 0;
  }

  const recentWindow = closes.slice(-5);
  const baselineWindow = closes.slice(-20);
  const recentAverage = calculateSimpleMovingAverage(recentWindow);
  const baselineAverage = calculateSimpleMovingAverage(baselineWindow);

  if (baselineAverage <= 0) {
    return 0;
  }

  const priceVsBaseline = ((latestPrice - baselineAverage) / baselineAverage) * 100;
  const momentum = recentAverage > 0 ? ((latestPrice - recentAverage) / recentAverage) * 100 : 0;

  return Math.max(-1, Math.min(1, (priceVsBaseline * 0.65 + momentum * 0.35) / 4));
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

function calculateSignalAgeSeconds(...timestamps: Array<string | null | undefined>) {
  const timestamp = timestamps.find((value): value is string => Boolean(value));

  if (!timestamp) {
    return null;
  }

  const ageMs = Date.now() - new Date(timestamp).getTime();

  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return null;
  }

  return Math.round(ageMs / 1000);
}

function calculateLatestEmaValue(closes: number[], period: number) {
  const series = calculateExponentialMovingAverageSeries(closes, period);
  return {
    value: series.at(-1) ?? null,
    lookback: series.length > 5 ? series.at(-6) ?? null : null,
  };
}

function calculateSlopePercent(value: number | null, lookback: number | null) {
  if (value === null || lookback === null || lookback <= 0) {
    return null;
  }

  return ((value - lookback) / lookback) * 100;
}

function getWeekStartKey(timestamp: string) {
  const date = new Date(timestamp);
  const utcDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - utcDay + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function aggregateBarsToWeekly(
  bars: Array<{
    symbol: string;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>,
) {
  const weeklyBars = new Map<string, (typeof bars)[number]>();

  for (const bar of bars) {
    const key = getWeekStartKey(bar.timestamp);
    const existing = weeklyBars.get(key);

    if (!existing) {
      weeklyBars.set(key, {
        ...bar,
        timestamp: key,
      });
      continue;
    }

    weeklyBars.set(key, {
      ...existing,
      high: Math.max(existing.high, bar.high),
      low: Math.min(existing.low, bar.low),
      close: bar.close,
      volume: existing.volume + bar.volume,
    });
  }

  return Array.from(weeklyBars.values()).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
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

export async function getAlpacaPaperStrategySnapshot(input?: {
  symbol?: string;
  strategyType?: AlpacaPaperStrategyType;
  timeframe?: AlpacaBarTimeframe;
  fastPeriod?: number;
  slowPeriod?: number;
  bollingerLength?: number;
  bollingerStdDev?: number;
  maxNotional?: number;
  maxDailyLoss?: number;
  credentials?: AlpacaCredentials;
}) {
  const credentials = input?.credentials ?? getAlpacaCredentials();
  const symbol = normalizeAlpacaTradingSymbol(
    input?.symbol || process.env.ALPACA_SYMBOL || "SPY",
  );
  const timeframe = input?.timeframe ?? "1Min";
  const strategyType = input?.strategyType ?? "NONE";
  const fastPeriod = Math.floor(
    input?.fastPeriod ??
      parsePositiveNumber(process.env.ALPACA_FAST_SMA, 5),
  );
  const slowPeriod = Math.floor(
    input?.slowPeriod ??
      parsePositiveNumber(process.env.ALPACA_SLOW_SMA, 20),
  );
  const bollingerLength = Math.floor(
    input?.bollingerLength ?? parsePositiveNumber(undefined, 20),
  );
  const bollingerStdDev =
    input?.bollingerStdDev ?? parsePositiveNumber(undefined, 2);
  const maxNotional =
    input?.maxNotional ??
    parsePositiveNumber(process.env.ALPACA_MAX_NOTIONAL, 100);
  const maxDailyLoss =
    input?.maxDailyLoss ??
    parsePositiveNumber(process.env.ALPACA_MAX_DAILY_LOSS, 25);
  const requestedTimeframe = timeframe;
  const sourceTimeframe = requestedTimeframe === "1Week" ? "1Day" : requestedTimeframe;
  const sourceBarLimit =
    requestedTimeframe === "1Week"
      ? Math.max((Math.max(slowPeriod, bollingerLength, 120) + 4) * 5, 520)
      : Math.max(slowPeriod, bollingerLength, 120);

  if (
    (strategyType === "SMA" || strategyType === "EMA") &&
    slowPeriod <= fastPeriod
  ) {
    throw new Error(`Slow ${strategyType} must be greater than fast ${strategyType}.`);
  }

  if (strategyType === "BOLLINGER" && bollingerLength < 5) {
    throw new Error("Bollinger length must be at least 5.");
  }

  if (strategyType === "BOLLINGER" && bollingerStdDev <= 0) {
    throw new Error("Bollinger standard deviation must be greater than zero.");
  }

  const isCrypto = isAlpacaCryptoSymbol(symbol);

  const [account, quote, trade, bars, position] = await Promise.all([
    getAlpacaAccount(credentials),
    isCrypto
      ? getLatestCryptoQuote(symbol, credentials)
      : getLatestStockQuote(symbol, credentials),
    isCrypto
      ? getLatestCryptoTrade(symbol, credentials)
      : getLatestStockTrade(symbol, credentials),
    isCrypto
      ? getCryptoBars(
          symbol,
          {
            timeframe: sourceTimeframe,
            limit: sourceBarLimit,
          },
          credentials,
        )
      : getStockBars(
          symbol,
          {
            timeframe: sourceTimeframe,
            limit: sourceBarLimit,
          },
          credentials,
        ),
    getAlpacaPosition(symbol, credentials),
  ]);

  if (account.tradingBlocked || account.accountBlocked) {
    throw new Error("Trading is blocked on this Alpaca account.");
  }

  const latestPrice = pickFirstUsablePrice(
    quote.askPrice,
    quote.bidPrice,
    trade.price,
    (requestedTimeframe === "1Week" ? aggregateBarsToWeekly(bars) : bars).at(-1)?.close,
  );

  if (!latestPrice) {
    throw new Error(`Unable to determine a usable quote for ${symbol}.`);
  }

  const normalizedBars = requestedTimeframe === "1Week" ? aggregateBarsToWeekly(bars) : bars;
  const closes = normalizedBars.map((bar) => bar.close);
  const volumes = normalizedBars.map((bar) => bar.volume);
  const hasLongPosition = Boolean(position && position.qty > 0);
  const previousClose = closes.at(-2) ?? null;
  const priceChangePercent = Number(
    calculatePriceChangePercent(latestPrice, previousClose).toFixed(2),
  );
  const trendStrength = Number(calculateTrendStrength(closes, latestPrice).toFixed(3));
  const relativeVolumeRaw = calculateRelativeVolume(volumes);
  const relativeVolume =
    relativeVolumeRaw === null ? null : Number(relativeVolumeRaw.toFixed(2));
  const signalAgeSeconds = calculateSignalAgeSeconds(
    trade.timestamp,
    quote.timestamp,
    normalizedBars.at(-1)?.timestamp ?? null,
  );
  const quoteAgeSeconds = calculateSignalAgeSeconds(quote.timestamp);
  const spreadPercent =
    quote.askPrice && quote.bidPrice && latestPrice > 0
      ? ((quote.askPrice - quote.bidPrice) / latestPrice) * 100
      : null;
  const ema5Snapshot = calculateLatestEmaValue(closes, 5);
  const ema9Snapshot = calculateLatestEmaValue(closes, 9);
  const ema20Snapshot = calculateLatestEmaValue(closes, 20);
  const ema100Snapshot = calculateLatestEmaValue(closes, 100);
  const ema200Snapshot = calculateLatestEmaValue(closes, 200);
  const ema5 = ema5Snapshot.value === null ? null : Number(ema5Snapshot.value.toFixed(4));
  const ema9 = ema9Snapshot.value === null ? null : Number(ema9Snapshot.value.toFixed(4));
  const ema20 = ema20Snapshot.value === null ? null : Number(ema20Snapshot.value.toFixed(4));
  const ema100 = ema100Snapshot.value === null ? null : Number(ema100Snapshot.value.toFixed(4));
  const ema200 = ema200Snapshot.value === null ? null : Number(ema200Snapshot.value.toFixed(4));
  const ema5SlopePercentRaw = calculateSlopePercent(ema5Snapshot.value, ema5Snapshot.lookback);
  const ema9SlopePercentRaw = calculateSlopePercent(ema9Snapshot.value, ema9Snapshot.lookback);
  const ema20SlopePercentRaw = calculateSlopePercent(ema20Snapshot.value, ema20Snapshot.lookback);
  const ema100SlopePercentRaw = calculateSlopePercent(ema100Snapshot.value, ema100Snapshot.lookback);
  const ema200SlopePercentRaw = calculateSlopePercent(ema200Snapshot.value, ema200Snapshot.lookback);
  const ema5SlopePercent =
    ema5SlopePercentRaw === null ? null : Number(ema5SlopePercentRaw.toFixed(3));
  const ema9SlopePercent =
    ema9SlopePercentRaw === null ? null : Number(ema9SlopePercentRaw.toFixed(3));
  const ema20SlopePercent =
    ema20SlopePercentRaw === null ? null : Number(ema20SlopePercentRaw.toFixed(3));
  const ema100SlopePercent =
    ema100SlopePercentRaw === null ? null : Number(ema100SlopePercentRaw.toFixed(3));
  const ema200SlopePercent =
    ema200SlopePercentRaw === null ? null : Number(ema200SlopePercentRaw.toFixed(3));
  const candlestickAnalysis = analyzeCandlestickPatterns(
    normalizedBars.slice(-5).map((bar) => ({
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    })),
  );
  const emaShortSeries = calculateExponentialMovingAverageSeries(closes, 9);
  const emaLongSeries = calculateExponentialMovingAverageSeries(closes, 100);
  const emaShort = emaShortSeries.at(-1) ?? null;
  const emaLong = emaLongSeries.at(-1) ?? null;
  const emaShortLookback = emaShortSeries.length > 5 ? emaShortSeries.at(-6) ?? null : null;
  const emaShortSlopePercent =
    emaShort !== null && emaShortLookback && emaShortLookback > 0
      ? ((emaShort - emaShortLookback) / emaShortLookback) * 100
      : null;
  const vwapRaw = calculateVwap(normalizedBars);
  const vwap = vwapRaw === null ? null : Number(vwapRaw.toFixed(4));
  const structurePercentRaw = calculateStructurePercent(normalizedBars);
  const structurePercent =
    structurePercentRaw === null ? null : Number(structurePercentRaw.toFixed(2));
  const rsi14Raw = calculateRsi(closes, 14);
  const rsi14 = rsi14Raw === null ? null : Number(rsi14Raw.toFixed(2));
  const macd = calculateMacd(closes);
  const macdLine = macd.line === null ? null : Number(macd.line.toFixed(4));
  const macdSignal = macd.signal === null ? null : Number(macd.signal.toFixed(4));
  const macdHistogram = macd.histogram === null ? null : Number(macd.histogram.toFixed(4));
  const macdHistogramPercent =
    macd.histogram === null || latestPrice <= 0
      ? null
      : Number(((macd.histogram / latestPrice) * 100).toFixed(4));
  const roc12Raw = calculateRoc(closes, 12);
  const roc12 = roc12Raw === null ? null : Number(roc12Raw.toFixed(2));
  const candleExpansionRatioRaw = calculateCandleExpansionRatio(normalizedBars);
  const candleExpansionRatio =
    candleExpansionRatioRaw === null ? null : Number(candleExpansionRatioRaw.toFixed(2));
  const strategy =
    strategyType === "NONE"
      ? {
          signal: buildNoStrategyDecision(),
          basis: null,
          upper: null,
          lower: null,
        }
      : strategyType === "BOLLINGER"
      ? buildBollingerDecision({
          closes,
          latestPrice,
          hasLongPosition,
          bollingerLength,
          bollingerStdDev,
        })
      : strategyType === "EMA"
      ? {
          signal: buildEmaDecision({
            closes,
            fastPeriod,
            slowPeriod,
            hasLongPosition,
          }),
          basis: null,
          upper: null,
          lower: null,
        }
      : {
          signal: buildStrategyDecision({
            closes,
            fastPeriod,
            slowPeriod,
            hasLongPosition,
          }),
          basis: null,
          upper: null,
          lower: null,
        };
  const signal = strategy.signal;
  const dailyPnL = account.equity - account.lastEquity;

  if (dailyPnL <= -maxDailyLoss) {
    return {
      mode: "analysis-only" as const,
      environment: credentials.environment,
      symbol,
      timeframe: requestedTimeframe,
      strategyType,
      latestPrice,
      dailyPnL: Number(dailyPnL.toFixed(2)),
      maxNotional,
      maxDailyLoss,
      fastPeriod,
      slowPeriod,
      bollingerLength,
      bollingerStdDev,
      bollingerBasis: strategy.basis,
      bollingerUpper: strategy.upper,
      bollingerLower: strategy.lower,
      position: position
        ? {
            qty: position.qty,
            avgEntryPrice: position.avgEntryPrice,
            marketValue: position.marketValue,
            unrealizedPl: position.unrealizedPl,
          }
        : null,
      signal: {
        action: "hold" as const,
        reason: `Daily PnL ${dailyPnL.toFixed(2)} is below the max loss limit of ${maxDailyLoss.toFixed(2)}.`,
      },
      latestTradePrice: trade.price,
      latestTradeTimestamp: trade.timestamp,
      quoteTimestamp: quote.timestamp,
      lastBarTimestamp: normalizedBars.at(-1)?.timestamp ?? null,
      trendStrength,
      priceChangePercent,
      relativeVolume,
      signalAgeSeconds,
      quoteAgeSeconds,
      spreadPercent,
      ema5,
      ema9,
      ema20,
      ema100,
      ema200,
      ema5SlopePercent,
      ema9SlopePercent,
      ema20SlopePercent,
      ema100SlopePercent,
      ema200SlopePercent,
      candlestickBias: candlestickAnalysis.overallBias,
      candlestickScore: candlestickAnalysis.score,
      candlestickSignals: candlestickAnalysis.signals,
      emaShort,
      emaLong,
      emaShortSlopePercent,
      vwap,
      structurePercent,
      rsi14,
      macdLine,
      macdSignal,
      macdHistogram,
      macdHistogramPercent,
      roc12,
      candleExpansionRatio,
    };
  }

  return {
    mode: "analysis-only" as const,
    environment: credentials.environment,
    symbol,
    timeframe: requestedTimeframe,
    strategyType,
    latestPrice,
    dailyPnL: Number(dailyPnL.toFixed(2)),
    maxNotional,
    maxDailyLoss,
    fastPeriod,
    slowPeriod,
    bollingerLength,
    bollingerStdDev,
    bollingerBasis: strategy.basis,
    bollingerUpper: strategy.upper,
    bollingerLower: strategy.lower,
    position: position
      ? {
          qty: position.qty,
          avgEntryPrice: position.avgEntryPrice,
          marketValue: position.marketValue,
          unrealizedPl: position.unrealizedPl,
        }
      : null,
    signal,
    latestTradePrice: trade.price,
    latestTradeTimestamp: trade.timestamp,
    quoteTimestamp: quote.timestamp,
    lastBarTimestamp: normalizedBars.at(-1)?.timestamp ?? null,
    trendStrength,
    priceChangePercent,
    relativeVolume,
    signalAgeSeconds,
    quoteAgeSeconds,
    spreadPercent,
    ema5,
    ema9,
    ema20,
    ema100,
    ema200,
    ema5SlopePercent,
    ema9SlopePercent,
    ema20SlopePercent,
    ema100SlopePercent,
    ema200SlopePercent,
    candlestickBias: candlestickAnalysis.overallBias,
    candlestickScore: candlestickAnalysis.score,
    candlestickSignals: candlestickAnalysis.signals,
    emaShort,
    emaLong,
    emaShortSlopePercent,
    vwap,
    structurePercent,
    rsi14,
    macdLine,
    macdSignal,
    macdHistogram,
    macdHistogramPercent,
    roc12,
    candleExpansionRatio,
  };
}
