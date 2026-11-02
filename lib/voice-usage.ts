import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Abuse/cost guard for the public, no-login voice-input endpoint
// (/api/ai/voice-transcribe, used by the homepage idea field and the /try
// demo). Same ensure-table-on-first-use pattern as try-demo-usage.ts, kept
// as its own table since voice transcription has its own cost profile and
// is meant to allow more attempts per visitor (people re-record) than a
// full draft generation.
export const VOICE_PER_IP_DAILY_LIMIT = 12;
export const VOICE_GLOBAL_DAILY_LIMIT = 400;
const PRUNE_AFTER_HOURS = 48;

let ensureTablePromise: Promise<void> | null = null;

async function ensureVoiceUsageTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS voice_transcribe_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => undefined).finally(() => {
      ensureTablePromise = null;
    });
  }

  return ensureTablePromise;
}

// Never store raw IPs, just enough to rate-limit by. Not a security
// boundary (X-Forwarded-For can be spoofed outside the proxy), only an
// abuse-cost speed bump for anonymous traffic.
export function hashIp(ip: string) {
  return createHash("sha256").update(ip).digest("hex");
}

export function getRequestIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();

  return firstForwarded || "unknown";
}

export async function checkVoiceRateLimit(ipHash: string): Promise<{
  allowed: boolean;
  reason?: "per_ip" | "global";
}> {
  await ensureVoiceUsageTable();

  // Compare entirely in SQLite's own datetime() output (always
  // "YYYY-MM-DD HH:MM:SS", UTC) rather than mixing it with a JS-generated
  // ISO string ("...T...Z") — those two formats don't sort consistently
  // against each other as plain strings, which would silently undercount
  // same-calendar-day rows.
  const [perIpRows, globalRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM voice_transcribe_usage WHERE ip_hash = ? AND created_at > datetime('now', '-24 hours')`,
      ipHash,
    ) as Promise<Array<{ count: number }>>,
    prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM voice_transcribe_usage WHERE created_at > datetime('now', '-24 hours')`,
    ) as Promise<Array<{ count: number }>>,
  ]);

  const perIpCount = Number(perIpRows[0]?.count ?? 0);
  const globalCount = Number(globalRows[0]?.count ?? 0);

  if (perIpCount >= VOICE_PER_IP_DAILY_LIMIT) {
    return { allowed: false, reason: "per_ip" };
  }

  if (globalCount >= VOICE_GLOBAL_DAILY_LIMIT) {
    return { allowed: false, reason: "global" };
  }

  return { allowed: true };
}

export async function recordVoiceUsage(ipHash: string) {
  await ensureVoiceUsageTable();

  await prisma.$executeRawUnsafe(
    `INSERT INTO voice_transcribe_usage (ip_hash, created_at) VALUES (?, CURRENT_TIMESTAMP)`,
    ipHash,
  );

  // Keep the table small; we only ever look back 24h for rate-limit checks.
  await prisma.$executeRawUnsafe(
    `DELETE FROM voice_transcribe_usage WHERE created_at < datetime('now', ?)`,
    `-${PRUNE_AFTER_HOURS} hours`,
  );
}
