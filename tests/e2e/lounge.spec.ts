import { expect, test } from "@playwright/test";

test("라운지에서 대화 주제를 복사하고 주간 랭킹으로 이동한다", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedTopic = text;
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "우리들의 라운지." })).toBeVisible();
  await page.getByRole("link", { name: "오늘의 이야기 만나기" }).click();
  await page.getByRole("button", { name: "게임 이야기", exact: true }).click();
  const topic = await page.locator(".topic-question h3").innerText();
  await page.getByRole("button", { name: "주제 복사하기" }).click();
  await expect(page.getByRole("button", { name: "복사했어요" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.copiedTopic)).toBe(
    `[JGD.GG 오늘의 대화] ${topic}`,
  );
  await page.getByRole("link", { name: "주간 랭킹 구경하기" }).click();
  await expect(page).toHaveURL(/\/rankings\/number-click\?period=week/);
  await expect(page.getByRole("tab", { name: "이번 주", selected: true })).toBeVisible();
});

test("작은 화면에서도 메뉴를 이동하면 닫히고 연습에 도달한다", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByLabel("메뉴 열기");
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole("navigation", { name: "모바일 메뉴" })
      .getByRole("link", { name: "미니게임" })
      .click();
    await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open");
  } else {
    await page
      .getByRole("navigation", { name: "주요 메뉴" })
      .getByRole("link", { name: "미니게임" })
      .click();
  }
  await expect(page.getByRole("button", { name: "연습 시작" })).toBeVisible();
});

test("라운지의 너비와 가이드, 키보드 접근성을 확인한다", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByText("연습과 공식 기록은 달라요?", { exact: true }).click();
  await expect(page.getByText(/연습 기록은 소급 등록되지 않아요/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  await page.getByText("연습과 공식 기록은 달라요?", { exact: true }).click();
  if ((page.viewportSize()?.width ?? 0) >= 1100) {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Desktop viewport is required for the zoom layout check.");

    await page.setViewportSize({ width: Math.floor(viewport.width / 2), height: viewport.height });
    await page.reload();
    const feed = await page.locator(".lounge-feed").boundingBox();
    const aside = await page.locator(".lounge-aside").boundingBox();
    expect(feed).not.toBeNull();
    expect(aside).not.toBeNull();
    expect(aside!.y).toBeGreaterThanOrEqual(feed!.y + feed!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );
  }
  await page.screenshot({ path: testInfo.outputPath("lounge.png"), fullPage: true });
});
