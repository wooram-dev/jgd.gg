import { expect, test } from "@playwright/test";
import { cleanApplicationData, createTestDatabase } from "../helpers/database";
import { fundTitleTestUser } from "../helpers/title-points";

test("칭호 구매·응답 유실 복구·무료 교체·해제·소장 유지", async ({ page }, testInfo) => {
  const database = createTestDatabase();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await cleanApplicationData(database);
    await page.route("**/_next/image?**", (route) => route.abort());
    await page.goto("/상점");
    await expect(page).toHaveURL(
      (url) => url.pathname === "/login" && url.searchParams.get("returnTo") === "/상점",
    );
    expect((await page.request.get("/api/v1/me/titles")).status()).toBe(401);
    await page.getByRole("button", { name: "Discord로 로그인" }).click();
    await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === "/상점");
    await expect(page.getByRole("button", { name: "포인트 부족" })).toHaveCount(6);
    const account = await database.account.findFirstOrThrow({
      where: { accountId: "175928847299117063" },
    });
    await fundTitleTestUser(database, account.userId, 1000);
    await page.reload();
    await expect(page.getByText("보유 1,000 P")).toBeVisible();
    await expect(page.locator('nav a[aria-current="page"]').first()).toHaveText("칭호 상점");
    let dropped = false;
    await page.route("**/api/v1/me/titles/purchase", async (route) => {
      if (dropped) return route.continue();
      dropped = true;
      const result = await route.fetch();
      expect(result.status()).toBe(200);
      await route.abort("failed");
    });
    const first = page.getByRole("article", { name: "피자스시 장인" });
    await first.getByRole("button", { name: "500 P로 구매" }).click();
    const dialog = page.getByRole("dialog", { name: "칭호 구매 확인" });
    await expect(dialog).toContainText("환불은 불가");
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(first.getByRole("button", { name: "500 P로 구매" })).toBeFocused();
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: "구매 확정" }).click();
    await expect(
      page.getByRole("region", { name: "게임 속 한마디, 나의 칭호" }).getByRole("alert"),
    ).toContainText("처리 결과를 확인하지 못했습니다");
    await page.getByRole("button", { name: "같은 요청 다시 시도" }).click();
    await expect(first).toContainText("장착 중");
    await expect(page.getByText("보유 500 P")).toBeVisible();
    await expect(page.getByRole("link", { name: "보유 포인트 500 P", exact: true })).toBeVisible();
    expect(await database.pointTransaction.count({ where: { type: "SPEND" } })).toBe(1);
    const second = page.getByRole("article", { name: "뭔헤드야" });
    await second.getByRole("button", { name: "500 P로 구매" }).click();
    await dialog.getByRole("button", { name: "구매 확정" }).click();
    await expect(second).toContainText("장착 중");
    await expect(first).toContainText("소장 중");
    await expect(page.getByRole("link", { name: "보유 포인트 0 P", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("title-shop.png"), fullPage: true });
    await page.goto("/내정보#titles");
    const collection = page.getByRole("region", { name: "내 칭호" });
    await expect(collection.getByRole("article")).toHaveCount(2);
    await collection
      .getByRole("article", { name: "피자스시 장인" })
      .getByRole("button", { name: "장착하기" })
      .click();
    await expect(collection.getByRole("article", { name: "피자스시 장인" })).toContainText(
      "장착 중",
    );
    await collection.getByRole("button", { name: "장착 해제" }).click();
    await expect(collection.getByRole("strong").filter({ hasText: /^없음$/ })).toBeVisible();
    await page.reload();
    await expect(collection.getByRole("article")).toHaveCount(2);
    expect(await database.titlePurchase.count()).toBe(2);
    expect(await database.pointTransaction.count({ where: { type: "SPEND" } })).toBe(2);
    await expect(
      page.getByRole("region", { name: "내 포인트" }).getByText("칭호 구매"),
    ).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("title-collection.png"), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await database.$disconnect();
  }
});
