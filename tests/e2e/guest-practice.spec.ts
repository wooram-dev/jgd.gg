import { expect, test } from "@playwright/test";

test("비로그인 연습 완료와 저장되지 않음 안내", async ({ page }) => {
  await page.goto("/games/number-click");
  await page.getByRole("button", { name: "연습 시작" }).click();
  await expect(page.getByText("다음 숫자")).toBeVisible({ timeout: 5_000 });

  for (let value = 1; value <= 25; value += 1) {
    await page.getByRole("button", { name: `숫자 ${value}`, exact: true }).click();
  }

  await expect(page.getByText("연습 기록", { exact: true })).toBeVisible();
  await expect(page.getByText("이 기록은 저장되지 않았습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Discord로 로그인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "랭킹 보기", exact: true })).toBeVisible();
});

test("게임 보드는 지원 viewport에서 가로로 넘치지 않는다", async ({ page }) => {
  await page.goto("/games/number-click");
  const board = page.getByLabel("1부터 25까지 숫자 보드");
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );

  const cell = await page.locator(".number-cell").first().boundingBox();
  expect(cell).not.toBeNull();
  expect(cell?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(cell?.height ?? 0).toBeGreaterThanOrEqual(44);
});
