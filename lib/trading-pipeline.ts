import { prisma } from "@/lib/prisma";

export type ScreeningCandidate = {
  id: number;
  userId: number;
  market: string;
  timeframe: string;
  setupType: string;
  direction: "LONG" | "SHORT";
  thesis: string;
  catalyst: string | null;
  fundamentalScore: number;
  sentimentScore: number;
  technicalScore: number;
  notes: string | null;
  createdAt: string;
};

export type TrackedPosition = {
  id: number;
  userId: number;
  market: string;
  timeframe: string;
  setupType: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  targetOne: number;
  targetTwo: number | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

let ensuredTradingPipelineTables = false;

export async function ensureTradingPipelineTables() {
  if (ensuredTradingPipelineTables) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS screening_candidates (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      market TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      setupType TEXT NOT NULL,
      direction TEXT NOT NULL,
      thesis TEXT NOT NULL,
      catalyst TEXT,
      fundamentalScore INTEGER NOT NULL,
      sentimentScore INTEGER NOT NULL,
      technicalScore INTEGER NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tracked_positions (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      market TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      setupType TEXT NOT NULL,
      direction TEXT NOT NULL,
      entryPrice REAL NOT NULL,
      stopLoss REAL NOT NULL,
      targetOne REAL NOT NULL,
      targetTwo REAL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  ensuredTradingPipelineTables = true;
}

export async function createScreeningCandidate(input: Omit<ScreeningCandidate, "id" | "createdAt">) {
  await ensureTradingPipelineTables();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO screening_candidates (
        userId, market, timeframe, setupType, direction, thesis, catalyst,
        fundamentalScore, sentimentScore, technicalScore, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.userId,
    input.market,
    input.timeframe,
    input.setupType,
    input.direction,
    input.thesis,
    input.catalyst,
    input.fundamentalScore,
    input.sentimentScore,
    input.technicalScore,
    input.notes,
  );
}

export async function createTrackedPosition(input: Omit<TrackedPosition, "id" | "createdAt">) {
  await ensureTradingPipelineTables();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO tracked_positions (
        userId, market, timeframe, setupType, direction, entryPrice, stopLoss,
        targetOne, targetTwo, status, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.userId,
    input.market,
    input.timeframe,
    input.setupType,
    input.direction,
    input.entryPrice,
    input.stopLoss,
    input.targetOne,
    input.targetTwo,
    input.status,
    input.notes,
  );
}

export async function listScreeningCandidates(userId: number): Promise<ScreeningCandidate[]> {
  await ensureTradingPipelineTables();

  return prisma.$queryRawUnsafe<ScreeningCandidate[]>(
    `
      SELECT *
      FROM screening_candidates
      WHERE userId = ?
      ORDER BY datetime(createdAt) DESC, id DESC
    `,
    userId,
  );
}

export async function listTrackedPositions(userId: number): Promise<TrackedPosition[]> {
  await ensureTradingPipelineTables();

  return prisma.$queryRawUnsafe<TrackedPosition[]>(
    `
      SELECT *
      FROM tracked_positions
      WHERE userId = ?
      ORDER BY datetime(createdAt) DESC, id DESC
    `,
    userId,
  );
}

export function getPipelineScore(candidate: Pick<ScreeningCandidate, "fundamentalScore" | "sentimentScore" | "technicalScore">) {
  const score =
    candidate.fundamentalScore * 0.3 +
    candidate.sentimentScore * 0.25 +
    candidate.technicalScore * 0.45;

  return Number(score.toFixed(1));
}

export function getPipelineStage(score: number) {
  if (score >= 8) {
    return "Ready";
  }

  if (score >= 6) {
    return "Watch";
  }

  return "Filter Out";
}

export function getExitAlert(position: TrackedPosition, currentPrice: number | null) {
  if (!currentPrice || !Number.isFinite(currentPrice)) {
    return {
      severity: "neutral",
      message: "Live quote unavailable.",
    } as const;
  }

  const distanceTo = (level: number) => Math.abs(currentPrice - level) / level;

  if (position.direction === "LONG") {
    if (currentPrice <= position.stopLoss) {
      return { severity: "danger", message: "Stop loss breached. Exit review needed now." } as const;
    }
    if (position.targetTwo && currentPrice >= position.targetTwo) {
      return { severity: "success", message: "Target two reached. Scale out or close remaining position." } as const;
    }
    if (currentPrice >= position.targetOne) {
      return { severity: "success", message: "Target one reached. Consider taking partials and tightening risk." } as const;
    }
    if (distanceTo(position.targetOne) <= 0.005) {
      return { severity: "warning", message: "Price is approaching target one." } as const;
    }
    if (distanceTo(position.stopLoss) <= 0.005) {
      return { severity: "warning", message: "Price is approaching the stop loss." } as const;
    }
  } else {
    if (currentPrice >= position.stopLoss) {
      return { severity: "danger", message: "Stop loss breached. Exit review needed now." } as const;
    }
    if (position.targetTwo && currentPrice <= position.targetTwo) {
      return { severity: "success", message: "Target two reached. Scale out or close remaining position." } as const;
    }
    if (currentPrice <= position.targetOne) {
      return { severity: "success", message: "Target one reached. Consider taking partials and tightening risk." } as const;
    }
    if (distanceTo(position.targetOne) <= 0.005) {
      return { severity: "warning", message: "Price is approaching target one." } as const;
    }
    if (distanceTo(position.stopLoss) <= 0.005) {
      return { severity: "warning", message: "Price is approaching the stop loss." } as const;
    }
  }

  return { severity: "neutral", message: "Position remains inside the planned range." } as const;
}
