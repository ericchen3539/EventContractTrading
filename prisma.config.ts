/**
 * Prisma 7 config: datasource URL moved here from schema.prisma.
 * Used by migrate, studio, and generate.
 * Fallback dummy URL for prisma generate when DATABASE_URL is unset (e.g. postinstall).
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/dummy",
  },
});
