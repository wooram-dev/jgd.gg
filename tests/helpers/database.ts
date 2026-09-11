import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type UserStatus } from "@/generated/prisma/client";

export function createTestDatabase(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!databaseUrl) throw new Error("DATABASE_URL_TEST is required.");
  if (process.env.ALLOW_TEST_DATABASE_RESET !== "true") {
    throw new Error("ALLOW_TEST_DATABASE_RESET=true is required for integration tests.");
  }
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!/_test(?:_worker_\d+)?$/.test(databaseName) || databaseUrl === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST must identify a separate database ending in _test.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 8 }) });
}

export async function cleanApplicationData(database: PrismaClient): Promise<void> {
  await database.gameRecord.deleteMany();
  await database.gameSession.deleteMany();
  await database.session.deleteMany();
  await database.account.deleteMany();
  await database.user.deleteMany();
  await database.verification.deleteMany();
}

export async function createTestUser(
  database: PrismaClient,
  id: string,
  options: { displayName?: string; image?: string | null; status?: UserStatus } = {},
) {
  const displayName = options.displayName ?? `사용자 ${id.slice(0, 4)}`;
  return database.user.create({
    data: {
      id,
      name: displayName,
      email: `${id}@discord.placeholder.invalid`,
      emailVerified: false,
      image: options.image,
      discordUsername: `user-${id.slice(0, 8)}`,
      discordDisplayName: displayName,
      status: options.status,
      profileUpdatedAt: new Date("2026-09-06T00:00:00.000Z"),
    },
  });
}
