const ALPACA_PAPER_TRADING_URL = "https://paper-api.alpaca.markets/v2";
const ALPACA_LIVE_TRADING_URL = "https://api.alpaca.markets/v2";
const ALPACA_MARKET_DATA_URL = "https://data.alpaca.markets/v2";
const ALPACA_TIMEOUT_MS = 15000;
const ALPACA_ORDER_POLL_INTERVAL_MS = 1200;
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

export type AlpacaEnvironment = "paper" | "live";
export type AlpacaOrderSide = "buy" | "sell";
export type AlpacaTimeInForce = "day" | "gtc";
export type AlpacaBarTimeframe =
  | "1Min"
  | "5Min"
  | "15Min"
  | "30Min"
  | "1Hour"
  | "1Day"
  | "1Week";

export type AlpacaCredentials = {
  keyId: string;
  secretKey: string;
  environment: AlpacaEnvironment;
};

export type AlpacaAccount = {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  equity: number;
  lastEquity: number;
  daytradeCount: number;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  accountBlocked: boolean;
  patternDayTrader: boolean;
};

export type AlpacaPosition = {
  symbol: string;
  qty: number;
  availableQty: number;
  heldForOrdersQty: number;
  marketValue: number;
  avgEntryPrice: number;
  side: "long" | "short";
  unrealizedPl: number;
};

export type AlpacaQuote = {
  symbol: string;
  askPrice: number | null;
  bidPrice: number | null;
  askSize: number | null;
  bidSize: number | null;
  timestamp: string;
};

export type AlpacaTrade = {
  symbol: string;
  price: number;
  size: number | null;
  timestamp: string;
};

export type AlpacaScreenerMover = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
};

export type AlpacaMostActiveStock = {
  symbol: string;
  volume: number;
  tradeCount: number;
};

export type AlpacaStockSnapshot = {
  symbol: string;
  latestTradePrice: number | null;
  latestTradeSize: number | null;
  latestTradeTimestamp: string | null;
  latestBidPrice: number | null;
  latestAskPrice: number | null;
  latestQuoteTimestamp: string | null;
  minuteClose: number | null;
  minuteVolume: number | null;
  minuteTimestamp: string | null;
  dailyClose: number | null;
  dailyOpen: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
  dailyVolume: number | null;
  previousClose: number | null;
  previousVolume: number | null;
};

export type AlpacaBar = {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AlpacaOrder = {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: AlpacaOrderSide;
  type: string;
  timeInForce: string;
  status: string;
  qty: number | null;
  notional: number | null;
  filledQty: number | null;
  filledAvgPrice: number | null;
  submittedAt: string | null;
  filledAt: string | null;
  canceledAt: string | null;
};

export type AlpacaOrderResolution = {
  order: AlpacaOrder;
  reachedFinalState: boolean;
};

type JsonRecord = Record<string, unknown>;

function parseFiniteNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid ${label}.`);
  }

  return value.trim();
}

export function normalizeAlpacaTradingSymbol(symbol: string) {
  const trimmed = symbol.trim().toUpperCase();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("/")) {
    return trimmed;
  }

  if (trimmed.endsWith("USD") && trimmed.length > 3) {
    return `${trimmed.slice(0, -3)}/USD`;
  }

  if (trimmed.endsWith("USDT") && trimmed.length > 4) {
    return `${trimmed.slice(0, -4)}/USDT`;
  }

  if (trimmed.endsWith("USDC") && trimmed.length > 4) {
    return `${trimmed.slice(0, -4)}/USDC`;
  }

  if (COMMON_CRYPTO_BASE_SYMBOLS.has(trimmed)) {
    return `${trimmed}/USD`;
  }

  return trimmed;
}

export function isAlpacaCryptoSymbol(symbol: string) {
  return normalizeAlpacaTradingSymbol(symbol).includes("/");
}

function normalizeAlpacaPositionLookupSymbol(symbol: string) {
  const normalized = normalizeAlpacaTradingSymbol(symbol);
  return isAlpacaCryptoSymbol(normalized) ? normalized.replace("/", "") : normalized;
}

function getTradingBaseUrl(environment: AlpacaEnvironment) {
  return environment === "live"
    ? ALPACA_LIVE_TRADING_URL
    : ALPACA_PAPER_TRADING_URL;
}

function getDefaultEnvironment() {
  return process.env.ALPACA_ENVIRONMENT === "live" ? "live" : "paper";
}

export function getAlpacaCredentials(): AlpacaCredentials {
  const keyId = process.env.ALPACA_API_KEY?.trim();
  const secretKey = process.env.ALPACA_API_SECRET?.trim();

  if (!keyId || !secretKey) {
    throw new Error(
      "Missing Alpaca credentials. Set ALPACA_API_KEY and ALPACA_API_SECRET.",
    );
  }

  return {
    keyId,
    secretKey,
    environment: getDefaultEnvironment(),
  };
}

async function createAlpacaRequest<T>({
  credentials,
  url,
  init,
}: {
  credentials: AlpacaCredentials;
  url: string;
  init?: RequestInit;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALPACA_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "APCA-API-KEY-ID": credentials.keyId,
        "APCA-API-SECRET-KEY": credentials.secretKey,
        ...init?.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alpaca request failed (${response.status}): ${errorText || "Unknown error"}`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Alpaca request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mapAccount(payload: JsonRecord): AlpacaAccount {
  return {
    id: requireString(payload.id, "account id"),
    accountNumber: requireString(payload.account_number, "account number"),
    status: requireString(payload.status, "account status"),
    currency: requireString(payload.currency, "account currency"),
    buyingPower: parseFiniteNumber(payload.buying_power) ?? 0,
    cash: parseFiniteNumber(payload.cash) ?? 0,
    portfolioValue: parseFiniteNumber(payload.portfolio_value) ?? 0,
    equity: parseFiniteNumber(payload.equity) ?? 0,
    lastEquity: parseFiniteNumber(payload.last_equity) ?? 0,
    daytradeCount: parseFiniteNumber(payload.daytrade_count) ?? 0,
    tradingBlocked: payload.trading_blocked === true,
    transfersBlocked: payload.transfers_blocked === true,
    accountBlocked: payload.account_blocked === true,
    patternDayTrader: payload.pattern_day_trader === true,
  };
}

function mapPosition(payload: JsonRecord): AlpacaPosition {
  const qty = parseFiniteNumber(payload.qty) ?? 0;
  const availableQty =
    parseFiniteNumber(payload.qty_available) ??
    parseFiniteNumber(payload.available) ??
    qty;
  const heldForOrdersQty =
    parseFiniteNumber(payload.qty_held_for_orders) ??
    parseFiniteNumber(payload.held_for_orders) ??
    Math.max(qty - availableQty, 0);

  return {
    symbol: requireString(payload.symbol, "position symbol"),
    qty,
    availableQty,
    heldForOrdersQty,
    marketValue: parseFiniteNumber(payload.market_value) ?? 0,
    avgEntryPrice: parseFiniteNumber(payload.avg_entry_price) ?? 0,
    side: payload.side === "short" ? "short" : "long",
    unrealizedPl: parseFiniteNumber(payload.unrealized_pl) ?? 0,
  };
}

function mapPositions(payload: JsonRecord[]) {
  return payload.map(mapPosition);
}

function mapOrder(payload: JsonRecord): AlpacaOrder {
  return {
    id: requireString(payload.id, "order id"),
    clientOrderId: requireString(payload.client_order_id, "client order id"),
    symbol: requireString(payload.symbol, "order symbol"),
    side: payload.side === "sell" ? "sell" : "buy",
    type: requireString(payload.type, "order type"),
    timeInForce: requireString(payload.time_in_force, "time in force"),
    status: requireString(payload.status, "order status"),
    qty: parseFiniteNumber(payload.qty),
    notional: parseFiniteNumber(payload.notional),
    filledQty: parseFiniteNumber(payload.filled_qty),
    filledAvgPrice: parseFiniteNumber(payload.filled_avg_price),
    submittedAt:
      typeof payload.submitted_at === "string" ? payload.submitted_at : null,
    filledAt: typeof payload.filled_at === "string" ? payload.filled_at : null,
    canceledAt:
      typeof payload.canceled_at === "string" ? payload.canceled_at : null,
  };
}

function mapBar(symbol: string, payload: JsonRecord): AlpacaBar {
  const timestamp = requireString(payload.t, "bar timestamp");
  const open = parseFiniteNumber(payload.o);
  const high = parseFiniteNumber(payload.h);
  const low = parseFiniteNumber(payload.l);
  const close = parseFiniteNumber(payload.c);
  const volume = parseFiniteNumber(payload.v);

  if (
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null
  ) {
    throw new Error(`Received invalid bar data for ${symbol}.`);
  }

  return {
    symbol,
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  };
}

function mapScreenerMover(payload: JsonRecord): AlpacaScreenerMover {
  const symbol = requireString(payload.symbol, "screener symbol");
  const price = parseFiniteNumber(payload.price);
  const change = parseFiniteNumber(payload.change);
  const percentChange = parseFiniteNumber(payload.percent_change);

  if (price === null || change === null || percentChange === null) {
    throw new Error(`Received invalid screener mover data for ${symbol}.`);
  }

  return {
    symbol,
    price,
    change,
    percentChange,
  };
}

function mapMostActiveStock(payload: JsonRecord): AlpacaMostActiveStock {
  const symbol = requireString(payload.symbol, "most active symbol");
  const volume = parseFiniteNumber(payload.volume);
  const tradeCount = parseFiniteNumber(payload.trade_count);

  if (volume === null || tradeCount === null) {
    throw new Error(`Received invalid most-active data for ${symbol}.`);
  }

  return {
    symbol,
    volume,
    tradeCount,
  };
}

function mapSnapshot(symbol: string, payload: JsonRecord): AlpacaStockSnapshot {
  const latestTrade =
    payload.latestTrade && typeof payload.latestTrade === "object"
      ? (payload.latestTrade as JsonRecord)
      : null;
  const latestQuote =
    payload.latestQuote && typeof payload.latestQuote === "object"
      ? (payload.latestQuote as JsonRecord)
      : null;
  const minuteBar =
    payload.minuteBar && typeof payload.minuteBar === "object"
      ? (payload.minuteBar as JsonRecord)
      : null;
  const dailyBar =
    payload.dailyBar && typeof payload.dailyBar === "object"
      ? (payload.dailyBar as JsonRecord)
      : null;
  const prevDailyBar =
    payload.prevDailyBar && typeof payload.prevDailyBar === "object"
      ? (payload.prevDailyBar as JsonRecord)
      : null;

  return {
    symbol,
    latestTradePrice: parseFiniteNumber(latestTrade?.p),
    latestTradeSize: parseFiniteNumber(latestTrade?.s),
    latestTradeTimestamp:
      typeof latestTrade?.t === "string" ? latestTrade.t : null,
    latestBidPrice: parseFiniteNumber(latestQuote?.bp),
    latestAskPrice: parseFiniteNumber(latestQuote?.ap),
    latestQuoteTimestamp:
      typeof latestQuote?.t === "string" ? latestQuote.t : null,
    minuteClose: parseFiniteNumber(minuteBar?.c),
    minuteVolume: parseFiniteNumber(minuteBar?.v),
    minuteTimestamp: typeof minuteBar?.t === "string" ? minuteBar.t : null,
    dailyClose: parseFiniteNumber(dailyBar?.c),
    dailyOpen: parseFiniteNumber(dailyBar?.o),
    dailyHigh: parseFiniteNumber(dailyBar?.h),
    dailyLow: parseFiniteNumber(dailyBar?.l),
    dailyVolume: parseFiniteNumber(dailyBar?.v),
    previousClose: parseFiniteNumber(prevDailyBar?.c),
    previousVolume: parseFiniteNumber(prevDailyBar?.v),
  };
}

export async function getAlpacaAccount(
  credentials = getAlpacaCredentials(),
): Promise<AlpacaAccount> {
  const payload = await createAlpacaRequest<JsonRecord>({
    credentials,
    url: `${getTradingBaseUrl(credentials.environment)}/account`,
  });

  return mapAccount(payload);
}

export async function getAlpacaPosition(
  symbol: string,
  credentials = getAlpacaCredentials(),
): Promise<AlpacaPosition | null> {
  try {
    const normalizedSymbol = normalizeAlpacaPositionLookupSymbol(symbol);
    const payload = await createAlpacaRequest<JsonRecord>({
      credentials,
      url: `${getTradingBaseUrl(credentials.environment)}/positions/${encodeURIComponent(
        normalizedSymbol,
      )}`,
    });

    return mapPosition(payload);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("404") &&
      error.message.includes("position does not exist")
    ) {
      return null;
    }

    throw error;
  }
}

export async function listAlpacaPositions(
  credentials = getAlpacaCredentials(),
): Promise<AlpacaPosition[]> {
  const payload = await createAlpacaRequest<JsonRecord[]>({
    credentials,
    url: `${getTradingBaseUrl(credentials.environment)}/positions`,
  });

  return mapPositions(payload);
}

export async function getLatestStockQuote(
  symbol: string,
  credentials = getAlpacaCredentials(),
  feed = process.env.ALPACA_DATA_FEED?.trim() || "iex",
): Promise<AlpacaQuote> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const url = new URL(
    `${ALPACA_MARKET_DATA_URL}/stocks/${encodeURIComponent(
      normalizedSymbol,
    )}/quotes/latest`,
  );
  url.searchParams.set("feed", feed);

  const payload = await createAlpacaRequest<{
    quote?: JsonRecord;
    symbol?: string;
  }>({
    credentials,
    url: url.toString(),
  });

  const quote = payload.quote;

  if (!quote) {
    throw new Error(`No latest quote returned for ${normalizedSymbol}.`);
  }

  return {
    symbol: normalizedSymbol,
    askPrice: parseFiniteNumber(quote.ap),
    bidPrice: parseFiniteNumber(quote.bp),
    askSize: parseFiniteNumber(quote.as),
    bidSize: parseFiniteNumber(quote.bs),
    timestamp: requireString(quote.t, "quote timestamp"),
  };
}

export async function getLatestStockTrade(
  symbol: string,
  credentials = getAlpacaCredentials(),
  feed = process.env.ALPACA_DATA_FEED?.trim() || "iex",
): Promise<AlpacaTrade> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const url = new URL(
    `${ALPACA_MARKET_DATA_URL}/stocks/${encodeURIComponent(
      normalizedSymbol,
    )}/trades/latest`,
  );
  url.searchParams.set("feed", feed);

  const payload = await createAlpacaRequest<{
    trade?: JsonRecord;
  }>({
    credentials,
    url: url.toString(),
  });

  const trade = payload.trade;
  const price = parseFiniteNumber(trade?.p);

  if (!trade || price === null) {
    throw new Error(`No latest trade returned for ${normalizedSymbol}.`);
  }

  return {
    symbol: normalizedSymbol,
    price,
    size: parseFiniteNumber(trade.s),
    timestamp: requireString(trade.t, "trade timestamp"),
  };
}

export async function getLatestCryptoQuote(
  symbol: string,
  credentials = getAlpacaCredentials(),
): Promise<AlpacaQuote> {
  const normalizedSymbol = normalizeAlpacaTradingSymbol(symbol);
  const url = new URL("https://data.alpaca.markets/v1beta3/crypto/us/latest/quotes");
  url.searchParams.set("symbols", normalizedSymbol);

  const payload = await createAlpacaRequest<{
    quotes?: Record<string, JsonRecord>;
  }>({
    credentials,
    url: url.toString(),
  });

  const quote = payload.quotes?.[normalizedSymbol];

  if (!quote) {
    throw new Error(`No latest crypto quote returned for ${normalizedSymbol}.`);
  }

  return {
    symbol: normalizedSymbol,
    askPrice: parseFiniteNumber(quote.ap),
    bidPrice: parseFiniteNumber(quote.bp),
    askSize: parseFiniteNumber(quote.as),
    bidSize: parseFiniteNumber(quote.bs),
    timestamp: requireString(quote.t, "crypto quote timestamp"),
  };
}

export async function getLatestCryptoTrade(
  symbol: string,
  credentials = getAlpacaCredentials(),
): Promise<AlpacaTrade> {
  const normalizedSymbol = normalizeAlpacaTradingSymbol(symbol);
  const url = new URL("https://data.alpaca.markets/v1beta3/crypto/us/latest/trades");
  url.searchParams.set("symbols", normalizedSymbol);

  const payload = await createAlpacaRequest<{
    trades?: Record<string, JsonRecord>;
  }>({
    credentials,
    url: url.toString(),
  });

  const trade = payload.trades?.[normalizedSymbol];
  const price = parseFiniteNumber(trade?.p);

  if (!trade || price === null) {
    throw new Error(`No latest crypto trade returned for ${normalizedSymbol}.`);
  }

  return {
    symbol: normalizedSymbol,
    price,
    size: parseFiniteNumber(trade.s),
    timestamp: requireString(trade.t, "crypto trade timestamp"),
  };
}

export async function getStockBars(
  symbol: string,
  {
    timeframe,
    limit,
    feed = process.env.ALPACA_DATA_FEED?.trim() || "iex",
  }: {
    timeframe: AlpacaBarTimeframe;
    limit: number;
    feed?: string;
  },
  credentials = getAlpacaCredentials(),
): Promise<AlpacaBar[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const url = new URL(`${ALPACA_MARKET_DATA_URL}/stocks/bars`);
  url.searchParams.set("symbols", normalizedSymbol);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("feed", feed);

  const payload = await createAlpacaRequest<{
    bars?: Record<string, JsonRecord[]>;
  }>({
    credentials,
    url: url.toString(),
  });

  const bars = payload.bars?.[normalizedSymbol] ?? [];
  return bars.map((bar) => mapBar(normalizedSymbol, bar));
}

export async function getCryptoBars(
  symbol: string,
  {
    timeframe,
    limit,
  }: {
    timeframe: AlpacaBarTimeframe;
    limit: number;
  },
  credentials = getAlpacaCredentials(),
): Promise<AlpacaBar[]> {
  const normalizedSymbol = normalizeAlpacaTradingSymbol(symbol);
  const url = new URL("https://data.alpaca.markets/v1beta3/crypto/us/bars");
  url.searchParams.set("symbols", normalizedSymbol);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("limit", String(limit));

  const payload = await createAlpacaRequest<{
    bars?: Record<string, JsonRecord[]>;
  }>({
    credentials,
    url: url.toString(),
  });

  const bars = payload.bars?.[normalizedSymbol] ?? [];
  return bars.map((bar) => mapBar(normalizedSymbol, bar));
}

export async function submitMarketOrder(
  {
    symbol,
    qty,
    side,
    timeInForce,
    clientOrderId,
  }: {
    symbol: string;
    qty: number;
    side: AlpacaOrderSide;
    timeInForce?: AlpacaTimeInForce;
    clientOrderId?: string;
  },
  credentials = getAlpacaCredentials(),
): Promise<AlpacaOrder> {
  const normalizedSymbol = normalizeAlpacaTradingSymbol(symbol);
  const resolvedTimeInForce =
    timeInForce ?? (isAlpacaCryptoSymbol(normalizedSymbol) ? "gtc" : "day");

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Order quantity must be a positive number.");
  }

  const payload = await createAlpacaRequest<JsonRecord>({
    credentials,
    url: `${getTradingBaseUrl(credentials.environment)}/orders`,
    init: {
      method: "POST",
      body: JSON.stringify({
        symbol: normalizedSymbol,
        qty: String(qty),
        side,
        type: "market",
        time_in_force: resolvedTimeInForce,
        client_order_id: clientOrderId,
      }),
    },
  });

  return mapOrder(payload);
}

export async function getAlpacaOrderById(
  orderId: string,
  credentials = getAlpacaCredentials(),
): Promise<AlpacaOrder> {
  const payload = await createAlpacaRequest<JsonRecord>({
    credentials,
    url: `${getTradingBaseUrl(credentials.environment)}/orders/${encodeURIComponent(
      orderId.trim(),
    )}`,
  });

  return mapOrder(payload);
}

export async function listAlpacaOrders(
  {
    status = "open",
    symbols,
    limit = 50,
  }: {
    status?: "open" | "closed" | "all";
    symbols?: string[];
    limit?: number;
  } = {},
  credentials = getAlpacaCredentials(),
): Promise<AlpacaOrder[]> {
  const url = new URL(`${getTradingBaseUrl(credentials.environment)}/orders`);
  url.searchParams.set("status", status);
  url.searchParams.set("limit", String(limit));

  if (symbols && symbols.length > 0) {
    url.searchParams.set(
      "symbols",
      symbols.map((symbol) => normalizeAlpacaTradingSymbol(symbol)).join(","),
    );
  }

  const payload = await createAlpacaRequest<JsonRecord[]>({
    credentials,
    url: url.toString(),
  });

  return payload.map(mapOrder);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isFinalOrderStatus(status: string) {
  return [
    "filled",
    "canceled",
    "expired",
    "rejected",
    "suspended",
    "stopped",
    "done_for_day",
  ].includes(status);
}

export async function waitForOrderResolution(
  orderId: string,
  {
    attempts = 5,
    intervalMs = ALPACA_ORDER_POLL_INTERVAL_MS,
  }: {
    attempts?: number;
    intervalMs?: number;
  } = {},
  credentials = getAlpacaCredentials(),
): Promise<AlpacaOrderResolution> {
  let latestOrder = await getAlpacaOrderById(orderId, credentials);

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (isFinalOrderStatus(latestOrder.status)) {
      return {
        order: latestOrder,
        reachedFinalState: true,
      };
    }

    await sleep(intervalMs);
    latestOrder = await getAlpacaOrderById(orderId, credentials);
  }

  return {
    order: latestOrder,
    reachedFinalState: isFinalOrderStatus(latestOrder.status),
  };
}

export async function getMarketMovers(
  top = 10,
  credentials = getAlpacaCredentials(),
): Promise<{
  gainers: AlpacaScreenerMover[];
  losers: AlpacaScreenerMover[];
  lastUpdated: string | null;
}> {
  const url = new URL(`${ALPACA_MARKET_DATA_URL.replace("/v2", "")}/v1beta1/screener/stocks/movers`);
  url.searchParams.set("top", String(top));

  const payload = await createAlpacaRequest<{
    gainers?: JsonRecord[];
    losers?: JsonRecord[];
    last_updated?: string;
  }>({
    credentials,
    url: url.toString(),
  });

  return {
    gainers: (payload.gainers ?? []).map(mapScreenerMover),
    losers: (payload.losers ?? []).map(mapScreenerMover),
    lastUpdated: payload.last_updated ?? null,
  };
}

export async function getMostActiveStocks(
  top = 10,
  credentials = getAlpacaCredentials(),
): Promise<{
  stocks: AlpacaMostActiveStock[];
  lastUpdated: string | null;
}> {
  const url = new URL(
    `${ALPACA_MARKET_DATA_URL.replace("/v2", "")}/v1beta1/screener/stocks/most-actives`,
  );
  url.searchParams.set("top", String(top));

  const payload = await createAlpacaRequest<{
    most_actives?: JsonRecord[];
    last_updated?: string;
  }>({
    credentials,
    url: url.toString(),
  });

  return {
    stocks: (payload.most_actives ?? []).map(mapMostActiveStock),
    lastUpdated: payload.last_updated ?? null,
  };
}

export async function getStockSnapshots(
  symbols: string[],
  credentials = getAlpacaCredentials(),
  feed = process.env.ALPACA_DATA_FEED?.trim() || "iex",
): Promise<Record<string, AlpacaStockSnapshot>> {
  const normalizedSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)),
  );

  if (normalizedSymbols.length === 0) {
    return {};
  }

  const url = new URL(`${ALPACA_MARKET_DATA_URL}/stocks/snapshots`);
  url.searchParams.set("symbols", normalizedSymbols.join(","));
  url.searchParams.set("feed", feed);

  const payload = await createAlpacaRequest<Record<string, JsonRecord>>({
    credentials,
    url: url.toString(),
  });

  return Object.fromEntries(
    Object.entries(payload).map(([symbol, snapshot]) => [
      symbol,
      mapSnapshot(symbol, snapshot),
    ]),
  );
}
