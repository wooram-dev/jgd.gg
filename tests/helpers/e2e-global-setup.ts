import { NUMBER_CLICK_RULES } from "@/features/number-click/domain/rules";

import { cleanApplicationData, createTestDatabase } from "./database";
import setupIntegrationDatabase from "./integration-global-setup";

export default async function setupE2E(): Promise<void> {
  setupIntegrationDatabase();
  const database = createTestDatabase();
  try {
    await cleanApplicationData(database);
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
        status: "ACTIVE",
        currentRulesVersion: NUMBER_CLICK_RULES.version,
        rankedRulesVersion: NUMBER_CLICK_RULES.version,
      },
    });
  } finally {
    await database.$disconnect();
  }
}
