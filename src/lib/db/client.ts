import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env/server";

const globalDatabase = globalThis as typeof globalThis & {
  jgdDatabase?: PrismaClient;
};

export function getDatabase(): PrismaClient {
  if (globalDatabase.jgdDatabase) {
    return globalDatabase.jgdDatabase;
  }

  const adapter = new PrismaPg({
    connectionString: getServerEnv().DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  });
  const database = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalDatabase.jgdDatabase = database;
  }

  return database;
}
