/**
 * Prisma client singleton for use across the app.
 * Prevents multiple instances in development (hot reload).
 * Prisma 7 requires an adapter; we use @prisma/adapter-pg for PostgreSQL.
 *
 * Prisma Postgres (prisma+postgres://) embeds the real postgres URL in api_key;
 * adapter-pg needs a standard postgresql:// URL, so we resolve it here.
 *
 * Uses explicit pg.Pool for Turbopack compatibility (avoids module resolution
 * issues with Prisma v7 + Next.js 16).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function resolveConnectionString(raw: string): string {
  if (!raw.startsWith("prisma+postgres://")) {
    return raw;
  }
  try {
    const url = new URL(raw);
    const apiKey = url.searchParams.get("api_key");
    if (!apiKey) {
      throw new Error("prisma+postgres URL missing api_key");
    }
    const decoded = JSON.parse(Buffer.from(apiKey, "base64").toString("utf-8"));
    const direct = (decoded as { databaseUrl?: string }).databaseUrl;
    if (!direct || typeof direct !== "string") {
      throw new Error("prisma+postgres api_key missing databaseUrl");
    }
    return direct;
  } catch (err) {
    console.error("[db] Failed to resolve prisma+postgres URL:", err);
    throw err;
  }
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("DATABASE_URL is required for Prisma client.");
}
const connectionString = resolveConnectionString(rawUrl);

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;

const adapter = new PrismaPg(pool, { disposeExternalPool: false });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
