import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForDb = globalThis as unknown as {
  db?: PrismaClient;
};

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://freqle:freqle@localhost:5432/freqle?schema=public";

const adapter = new PrismaPg({ connectionString });

export const db =
  globalForDb.db ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
