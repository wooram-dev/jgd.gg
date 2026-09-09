import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { NUMBER_CLICK_RULES } from "../src/features/number-click/domain/rules";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

try {
  await database.game.upsert({
    where: { slug: "number-click" },
    create: {
      slug: "number-click",
      displayName: "숫자 순서대로 누르기",
      description: "1부터 25까지 순서대로 최대한 빠르게 누르세요.",
      status: "ACTIVE",
      scoreDirection: "ASC",
      scoreUnit: "MILLISECONDS",
      currentRulesVersion: NUMBER_CLICK_RULES.version,
      rankedRulesVersion: NUMBER_CLICK_RULES.version,
    },
    update: {
      displayName: "숫자 순서대로 누르기",
      description: "1부터 25까지 순서대로 최대한 빠르게 누르세요.",
      status: "ACTIVE",
      scoreDirection: "ASC",
      scoreUnit: "MILLISECONDS",
      currentRulesVersion: NUMBER_CLICK_RULES.version,
      rankedRulesVersion: NUMBER_CLICK_RULES.version,
    },
  });
} finally {
  await database.$disconnect();
}
