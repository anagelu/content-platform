import {
  getAlpacaAccount,
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
}) {
  const credentials = getAlpacaCredentials();
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
  const barLimit = Math.max(slowPeriod, bollingerLength);

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
            timeframe,
            limit: barLimit,
          },
          credentials,
        )
      : getStockBars(
          symbol,
          {
            timeframe,
            limit: barLimit,
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
    bars.at(-1)?.close,
  );

  if (!latestPrice) {
    throw new Error(`Unable to determine a usable quote for ${symbol}.`);
  }

  const closes = bars.map((bar) => bar.close);
  const hasLongPosition = Boolean(position && position.qty > 0);
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
      timeframe,
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
      lastBarTimestamp: bars.at(-1)?.timestamp ?? null,
    };
  }

  return {
    mode: "analysis-only" as const,
    environment: credentials.environment,
    symbol,
    timeframe,
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
    lastBarTimestamp: bars.at(-1)?.timestamp ?? null,
  };
}
