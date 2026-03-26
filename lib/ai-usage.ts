import { prisma } from "@/lib/prisma";

type OpenAIUsageStats = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type Pricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
};

type AiUsageSummaryRow = {
  feature: string;
  model: string;
  requests: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

const PRICING_BY_MODEL: Record<string, Pricing> = {
  "gpt-5": { inputPerMillion: 1.25, cachedInputPerMillion: 0.125, outputPerMillion: 10 },
  "gpt-5-mini": {
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    outputPerMillion: 2,
  },
  "gpt-5-nano": {
    inputPerMillion: 0.05,
    cachedInputPerMillion: 0.005,
    outputPerMillion: 0.4,
  },
  "gemini-2.5-flash": {
    inputPerMillion: 0.3,
    cachedInputPerMillion: 0.03,
    outputPerMillion: 2.5,
  },
  "gemini-2.5-flash-lite": {
    inputPerMillion: 0.1,
    cachedInputPerMillion: 0.01,
    outputPerMillion: 0.4,
  },
};

let ensureTablePromise: Promise<void> | null = null;

function normalizeModelName(model: string) {
  return model.trim().toLowerCase();
}

async function ensureAiUsageTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ai_usage_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        feature TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        cached_input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        reasoning_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => undefined).finally(() => {
      ensureTablePromise = null;
    });
  }

  return ensureTablePromise;
}

export function parseOpenAIUsage(payload: unknown): OpenAIUsageStats {
  const usage =
    payload && typeof payload === "object" && "usage" in payload
      ? (payload as {
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
            input_tokens_details?: {
              cached_tokens?: number;
            };
            output_tokens_details?: {
              reasoning_tokens?: number;
            };
          };
        }).usage
      : undefined;

  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

export function parseGeminiUsage(payload: unknown): OpenAIUsageStats {
  const usageMetadata =
    payload && typeof payload === "object" && "usageMetadata" in payload
      ? (payload as {
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        }).usageMetadata
      : undefined;

  return {
    inputTokens: usageMetadata?.promptTokenCount ?? 0,
    outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    totalTokens: usageMetadata?.totalTokenCount ?? 0,
  };
}

export function estimateOpenAICostUsd(model: string, usage: OpenAIUsageStats) {
  const pricing = PRICING_BY_MODEL[normalizeModelName(model)];

  if (!pricing) {
    return 0;
  }

  const uncachedInputTokens = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  const inputCost = (uncachedInputTokens / 1_000_000) * pricing.inputPerMillion;
  const cachedInputCost =
    pricing.cachedInputPerMillion !== undefined
      ? (usage.cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion
      : 0;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;

  return inputCost + cachedInputCost + outputCost;
}

export async function recordAiUsageEvent({
  userId,
  feature,
  model,
  usage,
}: {
  userId: number | null;
  feature: string;
  model: string;
  usage: OpenAIUsageStats;
}) {
  await ensureAiUsageTable();

  const estimatedCostUsd = estimateOpenAICostUsd(model, usage);

  await prisma.$executeRawUnsafe(
    `INSERT INTO ai_usage_events (
      user_id,
      feature,
      model,
      input_tokens,
      cached_input_tokens,
      output_tokens,
      reasoning_tokens,
      total_tokens,
      estimated_cost_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    feature,
    model,
    usage.inputTokens,
    usage.cachedInputTokens,
    usage.outputTokens,
    usage.reasoningTokens,
    usage.totalTokens,
    estimatedCostUsd,
  );
}

export async function getAiUsageSummary() {
  await ensureAiUsageTable();
  return getAiUsageSummaryForRange("30d");
}

export async function getAiUsageSummaryForRange(range: "today" | "7d" | "30d") {
  await ensureAiUsageTable();

  const whereClause =
    range === "today"
      ? `WHERE datetime(created_at) >= datetime('now', 'start of day')`
      : range === "7d"
        ? `WHERE datetime(created_at) >= datetime('now', '-7 days')`
        : `WHERE datetime(created_at) >= datetime('now', '-30 days')`;

  const summaryRows = (await prisma.$queryRawUnsafe(`
    SELECT
      feature as feature,
      model as model,
      COUNT(*) as requests,
      COALESCE(SUM(input_tokens), 0) as inputTokens,
      COALESCE(SUM(cached_input_tokens), 0) as cachedInputTokens,
      COALESCE(SUM(output_tokens), 0) as outputTokens,
      COALESCE(SUM(reasoning_tokens), 0) as reasoningTokens,
      COALESCE(SUM(total_tokens), 0) as totalTokens,
      COALESCE(SUM(estimated_cost_usd), 0) as estimatedCostUsd
    FROM ai_usage_events
    ${whereClause}
    GROUP BY feature, model
    ORDER BY estimatedCostUsd DESC, requests DESC
  `)) as AiUsageSummaryRow[];

  const totals = summaryRows.reduce(
    (acc, row) => ({
      requests: acc.requests + Number(row.requests),
      inputTokens: acc.inputTokens + Number(row.inputTokens),
      cachedInputTokens: acc.cachedInputTokens + Number(row.cachedInputTokens),
      outputTokens: acc.outputTokens + Number(row.outputTokens),
      reasoningTokens: acc.reasoningTokens + Number(row.reasoningTokens),
      totalTokens: acc.totalTokens + Number(row.totalTokens),
      estimatedCostUsd: acc.estimatedCostUsd + Number(row.estimatedCostUsd),
    }),
    {
      requests: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    },
  );

  const recentEvents = (await prisma.$queryRawUnsafe(`
    SELECT
      feature as feature,
      model as model,
      input_tokens as inputTokens,
      output_tokens as outputTokens,
      total_tokens as totalTokens,
      estimated_cost_usd as estimatedCostUsd,
      created_at as createdAt
    FROM ai_usage_events
    ${whereClause}
    ORDER BY id DESC
    LIMIT 12
  `)) as Array<{
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    createdAt: string;
  }>;

  return {
    range,
    rows: summaryRows.map((row) => ({
      ...row,
      requests: Number(row.requests),
      inputTokens: Number(row.inputTokens),
      cachedInputTokens: Number(row.cachedInputTokens),
      outputTokens: Number(row.outputTokens),
      reasoningTokens: Number(row.reasoningTokens),
      totalTokens: Number(row.totalTokens),
      estimatedCostUsd: Number(row.estimatedCostUsd),
    })),
    totals,
    recentEvents: recentEvents.map((row) => ({
      ...row,
      inputTokens: Number(row.inputTokens),
      outputTokens: Number(row.outputTokens),
      totalTokens: Number(row.totalTokens),
      estimatedCostUsd: Number(row.estimatedCostUsd),
    })),
  };
}
