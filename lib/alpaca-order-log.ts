import { prisma } from "@/lib/prisma";

export type AlpacaOrderLogEntry = {
  id: number;
  userId: number;
  environment: string;
  symbol: string;
  side: string;
  orderType: string;
  timeInForce: string;
  status: string;
  qty: number | null;
  notional: number | null;
  filledQty: number | null;
  filledAvgPrice: number | null;
  alpacaOrderId: string;
  clientOrderId: string;
  createdAt: string;
};

let ensuredAlpacaOrderLogTable = false;

export async function ensureAlpacaOrderLogTable() {
  if (ensuredAlpacaOrderLogTable) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS alpaca_order_logs (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      environment TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      orderType TEXT NOT NULL,
      timeInForce TEXT NOT NULL,
      status TEXT NOT NULL,
      qty REAL,
      notional REAL,
      filledQty REAL,
      filledAvgPrice REAL,
      alpacaOrderId TEXT NOT NULL,
      clientOrderId TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  ensuredAlpacaOrderLogTable = true;
}

export async function createAlpacaOrderLog(input: Omit<AlpacaOrderLogEntry, "id" | "createdAt">) {
  await ensureAlpacaOrderLogTable();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO alpaca_order_logs (
        userId,
        environment,
        symbol,
        side,
        orderType,
        timeInForce,
        status,
        qty,
        notional,
        filledQty,
        filledAvgPrice,
        alpacaOrderId,
        clientOrderId
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.userId,
    input.environment,
    input.symbol,
    input.side,
    input.orderType,
    input.timeInForce,
    input.status,
    input.qty,
    input.notional,
    input.filledQty,
    input.filledAvgPrice,
    input.alpacaOrderId,
    input.clientOrderId,
  );
}

export async function listAlpacaOrderLogs(userId: number): Promise<AlpacaOrderLogEntry[]> {
  await ensureAlpacaOrderLogTable();

  return prisma.$queryRawUnsafe<AlpacaOrderLogEntry[]>(
    `
      SELECT *
      FROM alpaca_order_logs
      WHERE userId = ?
      ORDER BY datetime(createdAt) DESC, id DESC
    `,
    userId,
  );
}

export async function updateAlpacaOrderLog(input: {
  userId: number;
  alpacaOrderId: string;
  status: string;
  qty: number | null;
  notional: number | null;
  filledQty: number | null;
  filledAvgPrice: number | null;
}) {
  await ensureAlpacaOrderLogTable();

  await prisma.$executeRawUnsafe(
    `
      UPDATE alpaca_order_logs
      SET
        status = ?,
        qty = ?,
        notional = ?,
        filledQty = ?,
        filledAvgPrice = ?
      WHERE userId = ? AND alpacaOrderId = ?
    `,
    input.status,
    input.qty,
    input.notional,
    input.filledQty,
    input.filledAvgPrice,
    input.userId,
    input.alpacaOrderId,
  );
}
