import { expect, test, type Page, type Route } from "@playwright/test";

import { cleanApplicationData, createTestDatabase } from "../helpers/database";

const E2E_PLAYER_ID = "175928847299117063";

async function resetOfficialFixtures(): Promise<void> {
  const database = createTestDatabase();
  try {
    await cleanApplicationData(database);
  } finally {
    await database.$disconnect();
  }
}

async function loginWithMockDiscord(page: Page): Promise<void> {
  await page.route("**/_next/image?**", async (route) => {
    await route.abort();
  });
  await page.goto("/login?returnTo=%2Fgames%2Fnumber-click");
  await page.getByRole("button", { name: "Discord로 로그인" }).click();
  await expect(page).toHaveURL(/\/games\/number-click$/);
  await expect(page.getByRole("button", { name: "게임 시작" })).toBeVisible();
}

async function installOfficialClock(
  page: Page,
  options: { dropFirstComplete?: boolean } = {},
): Promise<string[]> {
  const submittedBodies: string[] = [];
  let dropFirstComplete = options.dropFirstComplete ?? false;
  let startedAt: Date | null = null;
  let completedAt: Date | null = null;

  await page.route("**/api/v1/game-sessions/*/start", async (route) => {
    startedAt = new Date(Date.now() + 1_000);
    completedAt = new Date(startedAt.getTime() + 4_000);
    await continueWithNow(route, startedAt);
  });
  await page.route("**/api/v1/game-sessions/*/complete", async (route) => {
    if (!completedAt) throw new Error("Official completion was requested before session start.");
    const original = route.request().postDataJSON() as {
      clientElapsedMs: number;
      events: Array<{ value: number; elapsedMs: number }>;
    };
    submittedBodies.push(JSON.stringify(original));
    const lastIndex = original.events.length - 1;
    const events = original.events.map((event, index) => ({
      value: event.value,
      elapsedMs: lastIndex === 0 ? 4_000 : Math.round((index / lastIndex) * 4_000),
    }));
    const response = await route.fetch({
      headers: { ...route.request().headers(), "x-jgd-e2e-now": completedAt.toISOString() },
      postData: JSON.stringify({ clientElapsedMs: 4_000, events }),
    });
    if (dropFirstComplete) {
      dropFirstComplete = false;
      await route.abort("failed");
      return;
    }
    await route.fulfill({ response });
  });
  return submittedBodies;
}

async function continueWithNow(route: Route, now: Date): Promise<void> {
  await route.continue({
    headers: { ...route.request().headers(), "x-jgd-e2e-now": now.toISOString() },
  });
}

async function completeBoard(page: Page, mistake = false): Promise<void> {
  await page.getByRole("button", { name: "게임 시작" }).click();
  await expect(page.getByText("다음 숫자")).toBeVisible({ timeout: 5_000 });
  if (mistake) {
    await page.getByRole("button", { name: "숫자 2", exact: true }).click();
    await expect(page.getByText("오클릭 1회")).toBeVisible();
  }
  for (let value = 1; value <= 25; value += 1) {
    await page.getByRole("button", { name: `숫자 ${value}`, exact: true }).click();
  }
}

test("mock Discord 로그인과 desktop 공식 완료·페널티·재도전·랭킹 반영", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await resetOfficialFixtures();
  await installOfficialClock(page);
  await loginWithMockDiscord(page);

  const database = createTestDatabase();
  try {
    const user = await database.user.findUniqueOrThrow({
      where: { email: `${E2E_PLAYER_ID}@discord.placeholder.invalid` },
      include: { accounts: true, sessions: true },
    });
    expect(user.name).toBe("E2E Player");
    expect(user.emailVerified).toBe(false);
    expect(user.email).not.toContain("example.test");
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({
      providerId: "discord",
      accountId: E2E_PLAYER_ID,
      issuer: "local:oauth:discord",
      scope: "identify",
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    });
    expect(user.sessions).toHaveLength(1);
    expect(user.sessions[0]).toMatchObject({ ipAddress: null, userAgent: null });
  } finally {
    await database.$disconnect();
  }
  const sessionCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.includes("session_token"),
  );
  expect(sessionCookie).toMatchObject({ httpOnly: true, secure: false, sameSite: "Lax" });

  await completeBoard(page, true);
  await expect(page.getByRole("heading", { name: "4.50초" })).toBeFocused();
  await expect(page.getByText("새 개인 최고!", { exact: true })).toBeVisible();
  await expect(page.getByText(/실제 4\.00초 \+ 오클릭 1회/)).toBeVisible();
  await expect(page.getByText("오늘 1위")).toBeVisible();

  const firstSessionId = await readOnlySessionId();
  await page.getByRole("button", { name: "다시 하기" }).click();
  await expect(page.getByText("다음 숫자")).toBeVisible({ timeout: 5_000 });
  const secondSessionId = await readOnlySessionId();
  expect(secondSessionId).not.toBe(firstSessionId);

  await page.goto("/rankings/number-click?period=today");
  const viewerRow = page.locator("tr.viewer-row");
  await expect(viewerRow).toContainText("E2E Player");
  await expect(viewerRow).toContainText("4.50초");
  await expect(viewerRow.getByText("내 기록", { exact: true })).toBeVisible();
});

test("390px mobile에서 공식 완료와 결과 action을 사용할 수 있다", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await resetOfficialFixtures();
  await installOfficialClock(page);
  await loginWithMockDiscord(page);

  const board = page.getByLabel("1부터 25까지 숫자 보드");
  const boardBox = await board.boundingBox();
  expect(boardBox).not.toBeNull();
  expect((boardBox?.x ?? 0) + (boardBox?.width ?? 0)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  const cellBox = await page.locator(".number-cell").first().boundingBox();
  expect(cellBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(cellBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await completeBoard(page);
  await expect(page.getByRole("heading", { name: "4.00초" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 하기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "랭킹 보기", exact: true })).toBeVisible();
});

test("완료 response 유실 뒤 같은 payload 재전송은 record 한 건만 만든다", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await resetOfficialFixtures();
  const submittedBodies = await installOfficialClock(page, { dropFirstComplete: true });
  await loginWithMockDiscord(page);
  await completeBoard(page);

  await expect(page.getByRole("button", { name: "기록 다시 전송" })).toBeVisible();
  await page.getByRole("button", { name: "기록 다시 전송" }).click();
  await expect(page.getByRole("heading", { name: "4.00초" })).toBeVisible();
  expect(submittedBodies).toHaveLength(2);
  expect(submittedBodies[1]).toBe(submittedBodies[0]);

  const database = createTestDatabase();
  try {
    expect(await database.gameRecord.count()).toBe(1);
  } finally {
    await database.$disconnect();
  }
});

async function readOnlySessionId(): Promise<string> {
  const database = createTestDatabase();
  try {
    const session = await database.gameSession.findFirstOrThrow({
      where: { user: { email: `${E2E_PLAYER_ID}@discord.placeholder.invalid` } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return session.id;
  } finally {
    await database.$disconnect();
  }
}
