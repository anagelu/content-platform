const ALPHA_VANTAGE_QUOTE_URL = "https://www.alphavantage.co/query";

export type MarketQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  fetchedAt: string;
};

export type MarketSearchResult = {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: number;
};

export type MarketCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type LiveMarketSnapshot = {
  match: MarketSearchResult;
  quote: MarketQuote;
  candles: MarketCandle[];
};

export type MarketInterval =
  | "1min"
  | "2min"
  | "5min"
  | "15min"
  | "30min"
  | "60min"
  | "90min"
  | "1day"
  | "1week"
  | "1month"
  | "1year";

export type MarketRange = "1mo" | "3mo" | "6mo" | "1y";

type YahooSearchPayload = {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchDisp?: string;
  }>;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      description?: string;
    } | null;
  };
};

function parseNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMarketSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();

  const aliases: Record<string, string> = {
    BTC: "BTC-USD",
    ETH: "ETH-USD",
    SOL: "SOL-USD",
    XRP: "XRP-USD",
    DOGE: "DOGE-USD",
    SPX: "^GSPC",
    SPY: "SPY",
    QQQ: "QQQ",
    GOLD: "GC=F",
    SILVER: "SI=F",
    OIL: "CL=F",
  };

  return aliases[normalized] ?? normalized;
}

function getAlphaVantageApiKey() {
  return process.env.ALPHA_VANTAGE_API_KEY;
}

function buildAlphaVantageUrl(searchParams: URLSearchParams) {
  return `${ALPHA_VANTAGE_QUOTE_URL}?${searchParams}`;
}

export async function getAlphaVantageQuote(
  symbol: string,
): Promise<MarketQuote | null> {
  const apiKey = getAlphaVantageApiKey();
  const trimmedSymbol = normalizeMarketSymbol(symbol);

  if (!apiKey || !trimmedSymbol) {
    return null;
  }

  const searchParams = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol: trimmedSymbol,
    apikey: apiKey,
  });

  const response = await fetch(buildAlphaVantageUrl(searchParams), {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    "Global Quote"?: Record<string, string>;
    Note?: string;
    Information?: string;
  };

  const quote = payload["Global Quote"];

  if (!quote) {
    return null;
  }

  const price = parseNumber(quote["05. price"]);
  const change = parseNumber(quote["09. change"]);
  const changePercent = parseNumber(
    quote["10. change percent"]?.replace("%", ""),
  );
  const previousClose = parseNumber(quote["08. previous close"]);
  const fetchedAt = quote["07. latest trading day"];
  const resolvedSymbol = quote["01. symbol"];

  if (
    !resolvedSymbol ||
    price === null ||
    change === null ||
    changePercent === null ||
    previousClose === null ||
    !fetchedAt
  ) {
    return null;
  }

  return {
    symbol: resolvedSymbol,
    price,
    change,
    changePercent,
    previousClose,
    fetchedAt,
  };
}

export async function getMarketQuote(symbol: string): Promise<MarketQuote | null> {
  const trimmedSymbol = normalizeMarketSymbol(symbol);

  if (!trimmedSymbol) {
    return null;
  }

  const alphaQuote = await getAlphaVantageQuote(trimmedSymbol);

  if (alphaQuote) {
    return alphaQuote;
  }

  const yahooSnapshot = await getYahooChartSnapshot(trimmedSymbol, "1day", "1mo");

  if (yahooSnapshot?.quote) {
    return yahooSnapshot.quote;
  }

  const yahooSearchMatch = await getYahooSearchResult(symbol);

  if (yahooSearchMatch?.symbol) {
    const fallbackSnapshot = await getYahooChartSnapshot(
      yahooSearchMatch.symbol,
      "1day",
      "1mo",
    );

    if (fallbackSnapshot?.quote) {
      return fallbackSnapshot.quote;
    }
  }

  return null;
}

export async function searchMarketSymbol(
  query: string,
): Promise<MarketSearchResult | null> {
  const apiKey = getAlphaVantageApiKey();
  const trimmedQuery = query.trim();

  if (!apiKey || !trimmedQuery) {
    return null;
  }

  const searchParams = new URLSearchParams({
    function: "SYMBOL_SEARCH",
    keywords: trimmedQuery,
    apikey: apiKey,
  });

  const response = await fetch(buildAlphaVantageUrl(searchParams), {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    bestMatches?: Array<Record<string, string>>;
    Note?: string;
    Information?: string;
  };

  const match = payload.bestMatches?.[0];

  if (!match) {
    return null;
  }

  const matchScore = parseNumber(match["9. matchScore"]);

  return {
    symbol: match["1. symbol"] ?? "",
    name: match["2. name"] ?? "",
    type: match["3. type"] ?? "",
    region: match["4. region"] ?? "",
    currency: match["8. currency"] ?? "",
    matchScore: matchScore ?? 0,
  };
}

export async function getIntradayCandles(
  symbol: string,
  interval: "1min" | "2min" | "5min" | "15min" | "30min" | "60min" = "5min",
): Promise<MarketCandle[]> {
  const apiKey = getAlphaVantageApiKey();
  const trimmedSymbol = symbol.trim().toUpperCase();

  if (!apiKey || !trimmedSymbol) {
    return [];
  }

  const searchParams = new URLSearchParams({
    function: "TIME_SERIES_INTRADAY",
    symbol: trimmedSymbol,
    interval,
    outputsize: "compact",
    apikey: apiKey,
  });

  const response = await fetch(buildAlphaVantageUrl(searchParams), {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    [key: string]: unknown;
    Note?: string;
    Information?: string;
  };

  const seriesKey = `Time Series (${interval})`;
  const rawSeries = payload[seriesKey];

  if (!rawSeries || typeof rawSeries !== "object") {
    return [];
  }

  return Object.entries(rawSeries as Record<string, Record<string, string>>)
    .map(([timestamp, values]) => ({
      timestamp,
      open: parseNumber(values["1. open"]),
      high: parseNumber(values["2. high"]),
      low: parseNumber(values["3. low"]),
      close: parseNumber(values["4. close"]),
      volume: parseNumber(values["5. volume"]),
    }))
    .filter(
      (candle): candle is MarketCandle =>
        candle.open !== null &&
        candle.high !== null &&
        candle.low !== null &&
        candle.close !== null,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getLiveMarketSnapshot(
  query: string,
  interval: MarketInterval = "5min",
  range: MarketRange = "1mo",
): Promise<LiveMarketSnapshot | null> {
  return getYahooLiveMarketSnapshot(query, interval, range);
}

async function getYahooSearchResult(
  query: string,
): Promise<MarketSearchResult | null> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return null;
  }

  const url = new URL("https://query2.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("quotesCount", "6");
  url.searchParams.set("newsCount", "0");

  const response = await fetch(url, {
    next: { revalidate: 60 },
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as YahooSearchPayload;
  const match = payload.quotes?.find(
    (quote) => quote.symbol && quote.quoteType === "EQUITY",
  );

  if (!match?.symbol) {
    return null;
  }

  return {
    symbol: match.symbol,
    name: match.longname ?? match.shortname ?? match.symbol,
    type: match.quoteType ?? "",
    region: match.exchDisp ?? "",
    currency: "USD",
    matchScore: 1,
  };
}

async function getYahooChartSnapshot(
  symbol: string,
  interval: MarketInterval,
  range: MarketRange,
): Promise<{
  quote: MarketQuote;
  candles: MarketCandle[];
} | null> {
  const yahooIntervalMap: Record<MarketInterval, string> = {
    "1min": "1m",
    "2min": "2m",
    "5min": "5m",
    "15min": "15m",
    "30min": "30m",
    "60min": "60m",
    "90min": "90m",
    "1day": "1d",
    "1week": "1wk",
    "1month": "1mo",
    "1year": "1mo",
  };
  const yahooRangeMap: Record<MarketRange, string> = {
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
  };
  const maxSupportedRangeByInterval: Partial<Record<MarketInterval, MarketRange>> = {
    "1min": "1mo",
    "2min": "1mo",
    "5min": "1mo",
    "15min": "1mo",
    "30min": "1mo",
  };
  const resolvedRange = maxSupportedRangeByInterval[interval] ?? range;
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  url.searchParams.set("interval", yahooIntervalMap[interval]);
  url.searchParams.set("range", yahooRangeMap[resolvedRange]);
  url.searchParams.set("includePrePost", "false");

  const response = await fetch(url, {
    next: { revalidate: 30 },
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as YahooChartPayload;
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const timestamps = result?.timestamp ?? [];
  const quoteSeries = result?.indicators?.quote?.[0];

  if (!meta || !quoteSeries || timestamps.length === 0) {
    return null;
  }

  const candles = timestamps
    .map((timestamp, index) => ({
      timestamp: new Date(timestamp * 1000).toISOString(),
      open: quoteSeries.open?.[index] ?? null,
      high: quoteSeries.high?.[index] ?? null,
      low: quoteSeries.low?.[index] ?? null,
      close: quoteSeries.close?.[index] ?? null,
      volume: quoteSeries.volume?.[index] ?? null,
    }))
    .filter(
      (candle): candle is MarketCandle =>
        candle.open !== null &&
        candle.high !== null &&
        candle.low !== null &&
        candle.close !== null,
    );

  const normalizedCandles =
    interval === "1year" ? aggregateCandlesByYear(candles) : candles;

  if (normalizedCandles.length < 2) {
    return null;
  }

  const currentPrice =
    meta.regularMarketPrice ??
    normalizedCandles[normalizedCandles.length - 1].close;
  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;
  const change = currentPrice - previousClose;

  return {
    quote: {
      symbol: meta.symbol ?? symbol,
      price: currentPrice,
      change,
      changePercent: previousClose === 0 ? 0 : (change / previousClose) * 100,
      previousClose,
      fetchedAt: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    },
    candles: normalizedCandles,
  };
}

async function getYahooLiveMarketSnapshot(
  query: string,
  interval: MarketInterval,
  range: MarketRange,
): Promise<LiveMarketSnapshot | null> {
  const match = await getYahooSearchResult(query);

  if (!match?.symbol) {
    return null;
  }

  const chartSnapshot = await getYahooChartSnapshot(match.symbol, interval, range);

  if (!chartSnapshot) {
    return null;
  }

  return {
    match,
    quote: chartSnapshot.quote,
    candles: chartSnapshot.candles,
  };
}

function aggregateCandlesByYear(candles: MarketCandle[]) {
  const yearlyCandles = new Map<string, MarketCandle>();

  for (const candle of candles) {
    const year = new Date(candle.timestamp).getUTCFullYear().toString();
    const existing = yearlyCandles.get(year);

    if (!existing) {
      yearlyCandles.set(year, {
        ...candle,
        timestamp: `${year}-01-01T00:00:00.000Z`,
      });
      continue;
    }

    yearlyCandles.set(year, {
      timestamp: `${year}-01-01T00:00:00.000Z`,
      open: existing.open,
      high: Math.max(existing.high, candle.high),
      low: Math.min(existing.low, candle.low),
      close: candle.close,
      volume:
        existing.volume === null && candle.volume === null
          ? null
          : (existing.volume ?? 0) + (candle.volume ?? 0),
    });
  }

  return Array.from(yearlyCandles.values()).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
}
