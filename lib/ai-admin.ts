import { prisma } from "@/lib/prisma";

export type AiCapacityTier = "low" | "medium" | "high";
export type AiProvider = "openai" | "gemini";

const DEFAULT_AI_CAPACITY_TIER: AiCapacityTier = "low";
const DEFAULT_AI_PROVIDER: AiProvider = "gemini";

let ensureSettingsTablePromise: Promise<void> | null = null;

async function ensureAiAdminSettingsTable() {
  if (!ensureSettingsTablePromise) {
    ensureSettingsTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ai_admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => undefined).finally(() => {
      ensureSettingsTablePromise = null;
    });
  }

  return ensureSettingsTablePromise;
}

export async function getAiCapacityTier(): Promise<AiCapacityTier> {
  await ensureAiAdminSettingsTable();

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT value FROM ai_admin_settings WHERE key = ? LIMIT 1`,
    "capacity_tier",
  )) as Array<{ value: string }>;

  const value = rows[0]?.value;

  if (value === "medium" || value === "high" || value === "low") {
    return value;
  }

  return DEFAULT_AI_CAPACITY_TIER;
}

export async function getAiProvider(): Promise<AiProvider> {
  await ensureAiAdminSettingsTable();

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT value FROM ai_admin_settings WHERE key = ? LIMIT 1`,
    "provider",
  )) as Array<{ value: string }>;

  const value = rows[0]?.value;

  if (value === "openai" || value === "gemini") {
    return value;
  }

  return DEFAULT_AI_PROVIDER;
}

export async function setAiCapacityTier(tier: AiCapacityTier) {
  await ensureAiAdminSettingsTable();

  await prisma.$executeRawUnsafe(
    `INSERT INTO ai_admin_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    "capacity_tier",
    tier,
  );
}

export async function setAiProvider(provider: AiProvider) {
  await ensureAiAdminSettingsTable();

  await prisma.$executeRawUnsafe(
    `INSERT INTO ai_admin_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    "provider",
    provider,
  );
}

export function getModelForTier(tier: AiCapacityTier, provider: AiProvider) {
  if (provider === "gemini") {
    switch (tier) {
      case "high":
        return "gemini-2.5-flash";
      case "medium":
        return "gemini-2.5-flash";
      case "low":
      default:
        return "gemini-2.5-flash-lite";
    }
  }

  switch (tier) {
    case "high":
      return "gpt-5";
    case "medium":
      return "gpt-5-mini";
    case "low":
    default:
      return "gpt-5-nano";
  }
}

export function getTierLabel(tier: AiCapacityTier) {
  switch (tier) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
    default:
      return "Low";
  }
}

export function getProviderLabel(provider: AiProvider) {
  return provider === "gemini" ? "Google Gemini" : "OpenAI";
}

export async function isAiProviderConfigured() {
  const provider = await getAiProvider();

  if (provider === "gemini") {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  return Boolean(process.env.OPENAI_API_KEY);
}
