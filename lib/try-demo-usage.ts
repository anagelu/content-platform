import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Lightweight abuse/cost guard for the public, no-login "try it" demo
// (/try, backed by /api/ai/try-demo). Anyone can hit that endpoint, so it
// gets its own per-IP and site-wide daily caps, tracked in a tiny raw-SQL
// table (same ensure-table-on-first-use pattern as ai_usage_events and
// ai_admin_settings) rather than a Prisma migration.
export const TRY_DEMO_PER_IP_DAILY_LIMIT = 3;
export const TRY_DEMO_GLOBAL_DAILY_LIMIT = 150;
const PRUNE_AFTER_HOURS = 48;

let ensureTablePromise: Promise<void> | null = null;

async function ensureTryDemoUsageTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS try_demo_usage (
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

export async function checkTryDemoRateLimit(ipHash: string): Promise<{
  allowed: boolean;
  reason?: "per_ip" | "global";
}> {
  await ensureTryDemoUsageTable();

  // Compare entirely in SQLite's own datetime() output (always
  // "YYYY-MM-DD HH:MM:SS", UTC) rather than mixing it with a JS-generated
  // ISO string ("...T...Z") — those two formats don't sort consistently
  // against each other as plain strings, which would silently undercount
  // same-calendar-day rows.
  const [perIpRows, globalRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM try_demo_usage WHERE ip_hash = ? AND created_at > datetime('now', '-24 hours')`,
      ipHash,
    ) as Promise<Array<{ count: number }>>,
    prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM try_demo_usage WHERE created_at > datetime('now', '-24 hours')`,
    ) as Promise<Array<{ count: number }>>,
  ]);

  const perIpCount = Number(perIpRows[0]?.count ?? 0);
  const globalCount = Number(globalRows[0]?.count ?? 0);

  if (perIpCount >= TRY_DEMO_PER_IP_DAILY_LIMIT) {
    return { allowed: false, reason: "per_ip" };
  }

  if (globalCount >= TRY_DEMO_GLOBAL_DAILY_LIMIT) {
    return { allowed: false, reason: "global" };
  }

  return { allowed: true };
}

export async function recordTryDemoUsage(ipHash: string) {
  await ensureTryDemoUsageTable();

  await prisma.$executeRawUnsafe(
    `INSERT INTO try_demo_usage (ip_hash, created_at) VALUES (?, CURRENT_TIMESTAMP)`,
    ipHash,
  );

  // Keep the table small; we only ever look back 24h for rate-limit checks.
  await prisma.$executeRawUnsafe(
    `DELETE FROM try_demo_usage WHERE created_at < datetime('now', ?)`,
    `-${PRUNE_AFTER_HOURS} hours`,
  );
}
