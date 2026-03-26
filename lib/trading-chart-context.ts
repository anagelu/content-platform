import { prisma } from "@/lib/prisma";

export type TradingChartContext = {
  tradingSessionId: number;
  chartTimeframe: string | null;
  screenshotUrl: string | null;
  chartNotes: string | null;
};

let ensuredTradingChartContextTable = false;

export async function ensureTradingChartContextTable() {
  if (ensuredTradingChartContextTable) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS trading_session_chart_contexts (
      tradingSessionId INTEGER NOT NULL PRIMARY KEY,
      chartTimeframe TEXT,
      screenshotUrl TEXT,
      chartNotes TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tradingSessionId) REFERENCES TradingSession(id) ON DELETE CASCADE
    )
  `);

  ensuredTradingChartContextTable = true;
}

export async function getTradingChartContext(
  tradingSessionId: number,
): Promise<TradingChartContext | null> {
  await ensureTradingChartContextTable();

  const rows = await prisma.$queryRawUnsafe<TradingChartContext[]>(
    `
      SELECT tradingSessionId, chartTimeframe, screenshotUrl, chartNotes
      FROM trading_session_chart_contexts
      WHERE tradingSessionId = ?
      LIMIT 1
    `,
    tradingSessionId,
  );

  return rows[0] ?? null;
}

export async function upsertTradingChartContext(input: TradingChartContext) {
  await ensureTradingChartContextTable();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO trading_session_chart_contexts (
        tradingSessionId,
        chartTimeframe,
        screenshotUrl,
        chartNotes,
        updatedAt
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(tradingSessionId) DO UPDATE SET
        chartTimeframe = excluded.chartTimeframe,
        screenshotUrl = excluded.screenshotUrl,
        chartNotes = excluded.chartNotes,
        updatedAt = CURRENT_TIMESTAMP
    `,
    input.tradingSessionId,
    input.chartTimeframe,
    input.screenshotUrl,
    input.chartNotes,
  );
}
