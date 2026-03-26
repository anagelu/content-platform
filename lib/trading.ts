import { prisma } from "@/lib/prisma";
import { prismaWithJournal } from "@/lib/prisma-journal";
import { generateSummary } from "@/lib/post-summary";
import { slugify } from "@/lib/slugify";

export async function generateUniqueTradingSessionSlug(title: string) {
  const baseSlug = slugify(title) || "trading-session";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.tradingSession.findUnique({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function generateUniqueTradingJournalSlug(title: string) {
  const baseSlug = slugify(title) || "trading-journal-entry";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prismaWithJournal.tradingJournalEntry.findUnique({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export function buildTradingSummary(thesis: string, workflowNotes: string) {
  return generateSummary([thesis, workflowNotes].filter(Boolean).join(" "));
}

export function buildStructuredTradingSummary({
  market,
  timeframe,
  setupType,
  direction,
  thesis,
  workflowNotes,
  chartNotes,
  setupNarrative,
  entryMin,
  entryMax,
  stopLoss,
  targetOne,
  targetTwo,
  confidence,
  currentPrice,
}: {
  market: string;
  timeframe: string;
  setupType: string;
  direction: "LONG" | "SHORT";
  thesis: string;
  workflowNotes?: string;
  chartNotes?: string;
  setupNarrative?: string;
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  targetOne: number;
  targetTwo?: number | null;
  confidence: number;
  currentPrice?: number | null;
}) {
  const tradeBias = direction === "SHORT" ? "short" : "long";
  const lines = [
    `${market} on the ${timeframe} timeframe is set up as a ${setupType} ${tradeBias} idea with ${confidence}/10 confidence.`,
    `Entry plan: participate between ${formatPrice(entryMin)} and ${formatPrice(entryMax)}.`,
    `Stop loss: ${formatPrice(stopLoss)}.`,
    `Exit plan: take profit at ${formatPrice(targetOne)}${
      targetTwo ? ` and ${formatPrice(targetTwo)} for the second target.` : "."
    }`,
  ];

  if (currentPrice && Number.isFinite(currentPrice)) {
    lines.push(
      `Live market reference: current price is ${formatPrice(currentPrice)}.`,
    );
  }

  if (thesis.trim()) {
    lines.push(`Thesis: ${thesis.trim()}`);
  }

  if (setupNarrative?.trim()) {
    lines.push(`Setup details: ${setupNarrative.trim()}`);
  }

  if (chartNotes?.trim()) {
    lines.push(`Chart context: ${chartNotes.trim()}`);
  }

  if (workflowNotes?.trim()) {
    lines.push(`Execution notes: ${workflowNotes.trim()}`);
  }

  return lines.join(" ");
}

export function buildPersonalizedInsight({
  market,
  timeframe,
  setupType,
  priorSessions,
}: {
  market: string;
  timeframe: string;
  setupType: string;
  priorSessions: Array<{
    market: string;
    timeframe: string;
    setupType: string;
  }>;
}) {
  if (priorSessions.length === 0) {
    return `This is the first trading session in your workspace. Use it to establish your baseline approach for ${market} on the ${timeframe} timeframe.`;
  }

  const sameMarketCount = priorSessions.filter(
    (session) => session.market === market,
  ).length;
  const sameTimeframeCount = priorSessions.filter(
    (session) => session.timeframe === timeframe,
  ).length;
  const sameSetupCount = priorSessions.filter(
    (session) => session.setupType === setupType,
  ).length;

  return `Your workflow is starting to show a pattern: ${sameMarketCount + 1} sessions around ${market}, ${sameTimeframeCount + 1} sessions on ${timeframe}, and ${sameSetupCount + 1} sessions using the ${setupType} setup. Consider turning that repeatable edge into a public framework when it feels mature.`;
}

export function formatPrice(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

type WeightedSession = {
  timeframe: string;
  direction: "LONG" | "SHORT";
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  targetOne: number;
  confidence: number;
  votes: number;
  outcome: "PENDING" | "HIT_TARGET" | "STOPPED_OUT" | "PARTIAL" | "INVALIDATED";
};

function getOutcomeWeight(outcome: WeightedSession["outcome"]) {
  switch (outcome) {
    case "HIT_TARGET":
      return 1.35;
    case "PARTIAL":
      return 1.1;
    case "PENDING":
      return 0.95;
    case "STOPPED_OUT":
      return 0.65;
    case "INVALIDATED":
      return 0.5;
    default:
      return 1;
  }
}

function getSessionWeight(session: WeightedSession) {
  const confidenceWeight = Math.max(session.confidence, 1) / 10;
  const voteWeight = 1 + Math.min(session.votes, 20) * 0.03;
  const outcomeWeight = getOutcomeWeight(session.outcome);

  return confidenceWeight * voteWeight * outcomeWeight;
}

function weightedAverage(
  values: Array<{
    value: number;
    weight: number;
  }>,
) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return (
    values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
  );
}

export function buildMarketRecommendationSummary(sessions: WeightedSession[]) {
  const totalWeight = sessions.reduce(
    (sum, session) => sum + getSessionWeight(session),
    0,
  );

  const longWeight = sessions
    .filter((session) => session.direction === "LONG")
    .reduce((sum, session) => sum + getSessionWeight(session), 0);
  const shortWeight = sessions
    .filter((session) => session.direction === "SHORT")
    .reduce((sum, session) => sum + getSessionWeight(session), 0);

  const directionBias =
    longWeight === shortWeight ? "Balanced" : longWeight > shortWeight ? "Long" : "Short";

  const groupedByTimeframe = Object.entries(
    sessions.reduce<Record<string, WeightedSession[]>>((acc, session) => {
      acc[session.timeframe] = [...(acc[session.timeframe] ?? []), session];
      return acc;
    }, {}),
  );

  const timeframeScores = groupedByTimeframe.map(([timeframe, timeframeSessions]) => ({
    timeframe,
    weight: timeframeSessions.reduce(
      (sum, session) => sum + getSessionWeight(session),
      0,
    ),
  }));

  const bestTimeframe =
    timeframeScores.sort((a, b) => b.weight - a.weight)[0]?.timeframe ??
    sessions[0]?.timeframe ??
    "";

  const weightedEntryMin = weightedAverage(
    sessions.map((session) => ({
      value: session.entryMin,
      weight: getSessionWeight(session),
    })),
  );
  const weightedEntryMax = weightedAverage(
    sessions.map((session) => ({
      value: session.entryMax,
      weight: getSessionWeight(session),
    })),
  );
  const weightedStop = weightedAverage(
    sessions.map((session) => ({
      value: session.stopLoss,
      weight: getSessionWeight(session),
    })),
  );
  const weightedTarget = weightedAverage(
    sessions.map((session) => ({
      value: session.targetOne,
      weight: getSessionWeight(session),
    })),
  );
  const weightedConfidence = weightedAverage(
    sessions.map((session) => ({
      value: session.confidence,
      weight: getSessionWeight(session),
    })),
  );

  return {
    totalWeight,
    directionBias,
    bestTimeframe,
    weightedEntryMin,
    weightedEntryMax,
    weightedStop,
    weightedTarget,
    weightedConfidence,
  };
}

export function isSpxMarket(market: string) {
  return market.trim().toUpperCase() === "SPX";
}

export function buildSpxTradingOverview({
  sessions,
  journalEntries,
}: {
  sessions: Array<{
    market: string;
    timeframe: string;
    setupType: string;
    outcome: "PENDING" | "HIT_TARGET" | "PARTIAL" | "STOPPED_OUT" | "INVALIDATED";
    confidence: number;
  }>;
  journalEntries: Array<{
    market: string;
    direction: "LONG" | "SHORT";
  }>;
}) {
  const spxSessions = sessions.filter((session) => isSpxMarket(session.market));
  const resolvedSessions = spxSessions.filter((session) => session.outcome !== "PENDING");
  const positiveSessions = resolvedSessions.filter(
    (session) => session.outcome === "HIT_TARGET" || session.outcome === "PARTIAL",
  );
  const spxJournalEntries = journalEntries.filter((entry) => isSpxMarket(entry.market));

  const topSetup =
    Object.entries(
      spxSessions.reduce<Record<string, number>>((acc, session) => {
        acc[session.setupType] = (acc[session.setupType] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No dominant setup yet";

  const topTimeframe =
    Object.entries(
      spxSessions.reduce<Record<string, number>>((acc, session) => {
        acc[session.timeframe] = (acc[session.timeframe] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No primary timeframe yet";

  const averageConfidence =
    spxSessions.length > 0
      ? spxSessions.reduce((sum, session) => sum + session.confidence, 0) /
        spxSessions.length
      : 0;

  return {
    totalSessions: spxSessions.length,
    resolvedSessions: resolvedSessions.length,
    winRate:
      resolvedSessions.length > 0
        ? (positiveSessions.length / resolvedSessions.length) * 100
        : 0,
    topSetup,
    topTimeframe,
    averageConfidence,
    journalCount: spxJournalEntries.length,
  };
}

export function buildTimeframeRecommendationSummary(sessions: WeightedSession[]) {
  const weightedEntryMin = weightedAverage(
    sessions.map((session) => ({
      value: session.entryMin,
      weight: getSessionWeight(session),
    })),
  );
  const weightedEntryMax = weightedAverage(
    sessions.map((session) => ({
      value: session.entryMax,
      weight: getSessionWeight(session),
    })),
  );
  const weightedStop = weightedAverage(
    sessions.map((session) => ({
      value: session.stopLoss,
      weight: getSessionWeight(session),
    })),
  );
  const weightedTarget = weightedAverage(
    sessions.map((session) => ({
      value: session.targetOne,
      weight: getSessionWeight(session),
    })),
  );
  const weightedConfidence = weightedAverage(
    sessions.map((session) => ({
      value: session.confidence,
      weight: getSessionWeight(session),
    })),
  );

  const longWeight = sessions
    .filter((session) => session.direction === "LONG")
    .reduce((sum, session) => sum + getSessionWeight(session), 0);
  const shortWeight = sessions
    .filter((session) => session.direction === "SHORT")
    .reduce((sum, session) => sum + getSessionWeight(session), 0);

  return {
    weightedEntryMin,
    weightedEntryMax,
    weightedStop,
    weightedTarget,
    weightedConfidence,
    directionBias:
      longWeight === shortWeight
        ? "Balanced"
        : longWeight > shortWeight
          ? "Long"
          : "Short",
  };
}

function getTimeframeProfile(timeframe: string) {
  const normalized = timeframe.trim().toLowerCase();

  if (normalized.includes("scalp") || normalized.includes("5m")) {
    return {
      entryBuffer: 0.0015,
      stopDistance: 0.004,
      targetOneDistance: 0.006,
      targetTwoDistance: 0.01,
      confidence: 5,
    };
  }

  if (
    normalized.includes("intraday") ||
    normalized.includes("1h") ||
    normalized.includes("4h")
  ) {
    return {
      entryBuffer: 0.0025,
      stopDistance: 0.008,
      targetOneDistance: 0.012,
      targetTwoDistance: 0.02,
      confidence: 6,
    };
  }

  if (normalized.includes("swing") || normalized.includes("daily")) {
    return {
      entryBuffer: 0.004,
      stopDistance: 0.015,
      targetOneDistance: 0.03,
      targetTwoDistance: 0.05,
      confidence: 7,
    };
  }

  return {
    entryBuffer: 0.003,
    stopDistance: 0.01,
    targetOneDistance: 0.02,
    targetTwoDistance: 0.035,
    confidence: 6,
  };
}

function getMarketProfile(market: string) {
  const normalized = market.trim().toUpperCase();

  if (
    normalized.includes("BTC") ||
    normalized.includes("ETH") ||
    normalized.includes("SOL") ||
    normalized.includes("XRP")
  ) {
    return {
      entryMultiplier: 1.2,
      stopMultiplier: 1.35,
      targetMultiplier: 1.4,
      confidenceAdjustment: -1,
    };
  }

  if (
    normalized.includes("EUR") ||
    normalized.includes("JPY") ||
    normalized.includes("GBP") ||
    normalized.includes("USD")
  ) {
    return {
      entryMultiplier: 0.75,
      stopMultiplier: 0.8,
      targetMultiplier: 0.85,
      confidenceAdjustment: 0,
    };
  }

  if (
    normalized.includes("ES") ||
    normalized.includes("NQ") ||
    normalized.includes("YM") ||
    normalized.includes("RTY")
  ) {
    return {
      entryMultiplier: 0.9,
      stopMultiplier: 1,
      targetMultiplier: 1.1,
      confidenceAdjustment: 0,
    };
  }

  return {
    entryMultiplier: 1,
    stopMultiplier: 1,
    targetMultiplier: 1,
    confidenceAdjustment: 0,
  };
}

function getSetupProfile(setupType: string) {
  const normalized = setupType.trim().toLowerCase();

  if (normalized.includes("breakout") || normalized.includes("breakdown")) {
    return {
      entryMultiplier: 0.8,
      stopMultiplier: 1.15,
      targetMultiplier: 1.35,
      confidenceAdjustment: 0,
    };
  }

  if (normalized.includes("mean reversion")) {
    return {
      entryMultiplier: 0.7,
      stopMultiplier: 0.85,
      targetMultiplier: 0.9,
      confidenceAdjustment: -1,
    };
  }

  if (normalized.includes("range")) {
    return {
      entryMultiplier: 0.65,
      stopMultiplier: 0.8,
      targetMultiplier: 0.85,
      confidenceAdjustment: 0,
    };
  }

  if (
    normalized.includes("reclaim") ||
    normalized.includes("reversal") ||
    normalized.includes("liquidity sweep") ||
    normalized.includes("failed breakout")
  ) {
    return {
      entryMultiplier: 0.75,
      stopMultiplier: 1,
      targetMultiplier: 1.1,
      confidenceAdjustment: -1,
    };
  }

  if (
    normalized.includes("trend continuation") ||
    normalized.includes("ema") ||
    normalized.includes("pullback") ||
    normalized.includes("earnings gap continuation")
  ) {
    return {
      entryMultiplier: 0.9,
      stopMultiplier: 1,
      targetMultiplier: 1.25,
      confidenceAdjustment: 1,
    };
  }

  if (normalized.includes("opening range") || normalized.includes("vwap")) {
    return {
      entryMultiplier: 0.7,
      stopMultiplier: 0.9,
      targetMultiplier: 1,
      confidenceAdjustment: 0,
    };
  }

  return {
    entryMultiplier: 1,
    stopMultiplier: 1,
    targetMultiplier: 1,
    confidenceAdjustment: 0,
  };
}

export function buildTradeAutofill({
  market,
  price,
  timeframe,
  setupType,
  direction,
}: {
  market: string;
  price: number;
  timeframe: string;
  setupType: string;
  direction: "LONG" | "SHORT";
}) {
  const timeframeProfile = getTimeframeProfile(timeframe);
  const marketProfile = getMarketProfile(market);
  const setupProfile = getSetupProfile(setupType);
  const longDirection = direction === "LONG";
  const entryBuffer =
    timeframeProfile.entryBuffer *
    marketProfile.entryMultiplier *
    setupProfile.entryMultiplier;
  const stopDistance =
    timeframeProfile.stopDistance *
    marketProfile.stopMultiplier *
    setupProfile.stopMultiplier;
  const targetOneDistance =
    timeframeProfile.targetOneDistance *
    marketProfile.targetMultiplier *
    setupProfile.targetMultiplier;
  const targetTwoDistance =
    timeframeProfile.targetTwoDistance *
    marketProfile.targetMultiplier *
    setupProfile.targetMultiplier;
  const confidence = Math.max(
    1,
    Math.min(
      10,
      timeframeProfile.confidence +
        marketProfile.confidenceAdjustment +
        setupProfile.confidenceAdjustment,
    ),
  );

  const entryMin = longDirection
    ? price * (1 - entryBuffer)
    : price * (1 - entryBuffer * 0.35);
  const entryMax = longDirection
    ? price * (1 + entryBuffer * 0.35)
    : price * (1 + entryBuffer);
  const stopLoss = longDirection
    ? price * (1 - stopDistance)
    : price * (1 + stopDistance);
  const targetOne = longDirection
    ? price * (1 + targetOneDistance)
    : price * (1 - targetOneDistance);
  const targetTwo = longDirection
    ? price * (1 + targetTwoDistance)
    : price * (1 - targetTwoDistance);

  return {
    entryMin: Number(entryMin.toFixed(2)),
    entryMax: Number(entryMax.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    targetOne: Number(targetOne.toFixed(2)),
    targetTwo: Number(targetTwo.toFixed(2)),
    confidence,
  };
}
