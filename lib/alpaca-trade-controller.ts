import { prisma } from "@/lib/prisma";

export type AlpacaTradeControllerStatus = "ACTIVE" | "PAUSED" | "EJECTED";

export type AlpacaTradeController = {
  id: number;
  userId: number;
  symbol: string;
  status: AlpacaTradeControllerStatus;
  targetQty: number;
  strategyType: "NONE" | "SMA" | "EMA" | "BOLLINGER";
  strategyTimeframe: "1Min" | "5Min" | "15Min" | "30Min" | "1Hour" | "1Day" | "1Week";
  fastPeriod: number;
  slowPeriod: number;
  bollingerLength: number;
  bollingerStdDev: number;
  maxNotional: number;
  maxDailyLoss: number;
  lastCommand: string | null;
  lastCommandAt: string | null;
  createdAt: string;
  updatedAt: string;
};

let ensuredAlpacaTradeControllerTable = false;

async function addColumnIfMissing(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch {
    // Column already exists in the local SQLite table.
  }
}

export async function ensureAlpacaTradeControllerTable() {
  if (ensuredAlpacaTradeControllerTable) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS alpaca_trade_controllers (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAUSED',
      targetQty REAL NOT NULL DEFAULT 1,
      strategyType TEXT NOT NULL DEFAULT 'NONE',
      strategyTimeframe TEXT NOT NULL DEFAULT '1Min',
      fastPeriod INTEGER NOT NULL DEFAULT 5,
      slowPeriod INTEGER NOT NULL DEFAULT 20,
      bollingerLength INTEGER NOT NULL DEFAULT 20,
      bollingerStdDev REAL NOT NULL DEFAULT 2,
      maxNotional REAL NOT NULL DEFAULT 100,
      maxDailyLoss REAL NOT NULL DEFAULT 25,
      lastCommand TEXT,
      lastCommandAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
      UNIQUE (userId, symbol)
    )
  `);

  await addColumnIfMissing(
    "ALTER TABLE alpaca_trade_controllers ADD COLUMN strategyType TEXT NOT NULL DEFAULT 'NONE'",
  );
  await addColumnIfMissing(
    "ALTER TABLE alpaca_trade_controllers ADD COLUMN strategyTimeframe TEXT NOT NULL DEFAULT '1Min'",
  );
  await addColumnIfMissing(
    "ALTER TABLE alpaca_trade_controllers ADD COLUMN bollingerLength INTEGER NOT NULL DEFAULT 20",
  );
  await addColumnIfMissing(
    "ALTER TABLE alpaca_trade_controllers ADD COLUMN bollingerStdDev REAL NOT NULL DEFAULT 2",
  );

  ensuredAlpacaTradeControllerTable = true;
}

export async function upsertAlpacaTradeController(input: {
  userId: number;
  symbol: string;
  status: AlpacaTradeControllerStatus;
  targetQty: number;
  strategyType: "NONE" | "SMA" | "EMA" | "BOLLINGER";
  strategyTimeframe: "1Min" | "5Min" | "15Min" | "30Min" | "1Hour" | "1Day" | "1Week";
  fastPeriod: number;
  slowPeriod: number;
  bollingerLength: number;
  bollingerStdDev: number;
  maxNotional: number;
  maxDailyLoss: number;
  lastCommand: string;
}) {
  await ensureAlpacaTradeControllerTable();

  const symbol = input.symbol.trim().toUpperCase();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO alpaca_trade_controllers (
        userId, symbol, status, targetQty, strategyType, strategyTimeframe, fastPeriod, slowPeriod,
        bollingerLength, bollingerStdDev, maxNotional, maxDailyLoss,
        lastCommand, lastCommandAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(userId, symbol) DO UPDATE SET
        status = excluded.status,
        targetQty = excluded.targetQty,
        strategyType = excluded.strategyType,
        strategyTimeframe = excluded.strategyTimeframe,
        fastPeriod = excluded.fastPeriod,
        slowPeriod = excluded.slowPeriod,
        bollingerLength = excluded.bollingerLength,
        bollingerStdDev = excluded.bollingerStdDev,
        maxNotional = excluded.maxNotional,
        maxDailyLoss = excluded.maxDailyLoss,
        lastCommand = excluded.lastCommand,
        lastCommandAt = CURRENT_TIMESTAMP,
        updatedAt = CURRENT_TIMESTAMP
    `,
    input.userId,
    symbol,
    input.status,
    input.targetQty,
    input.strategyType,
    input.strategyTimeframe,
    input.fastPeriod,
    input.slowPeriod,
    input.bollingerLength,
    input.bollingerStdDev,
    input.maxNotional,
    input.maxDailyLoss,
    input.lastCommand,
  );
}

export async function getAlpacaTradeController(
  userId: number,
  symbol: string,
): Promise<AlpacaTradeController | null> {
  await ensureAlpacaTradeControllerTable();

  const rows = await prisma.$queryRawUnsafe<AlpacaTradeController[]>(
    `
      SELECT *
      FROM alpaca_trade_controllers
      WHERE userId = ? AND symbol = ?
      LIMIT 1
    `,
    userId,
    symbol.trim().toUpperCase(),
  );

  return rows[0] ?? null;
}

export async function listAlpacaTradeControllers(
  userId: number,
): Promise<AlpacaTradeController[]> {
  await ensureAlpacaTradeControllerTable();

  return prisma.$queryRawUnsafe<AlpacaTradeController[]>(
    `
      SELECT *
      FROM alpaca_trade_controllers
      WHERE userId = ?
      ORDER BY datetime(updatedAt) DESC, id DESC
    `,
    userId,
  );
}

export async function listActiveAlpacaTradeControllers(): Promise<
  AlpacaTradeController[]
> {
  await ensureAlpacaTradeControllerTable();

  return prisma.$queryRawUnsafe<AlpacaTradeController[]>(
    `
      SELECT *
      FROM alpaca_trade_controllers
      WHERE status = 'ACTIVE'
      ORDER BY datetime(updatedAt) DESC, id DESC
    `,
  );
}
