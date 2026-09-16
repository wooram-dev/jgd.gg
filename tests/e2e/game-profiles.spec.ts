import { expect, test } from "@playwright/test";
import { cleanApplicationData, createTestDatabase } from "../helpers/database";

test("게임 프로필 등록·수정·멤버 열람·삭제와 비멤버 접근 차단", async ({
  page,
  browser,
}, testInfo) => {
  const database = createTestDatabase();
  try {
    await cleanApplicationData(database);
    await page.route("**/_next/image?**", (route) => route.abort());
    for (const [legacy, canonical] of [
      ["/me", "/내정보"],
      ["/members", "/멤버"],
    ]) {
      const response = await page.request.get(`${legacy}?from=bookmark`, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      const destination = new URL(response.headers().location, response.url());
      expect(decodeURIComponent(destination.pathname)).toBe(canonical);
      expect(destination.searchParams.get("from")).toBe("bookmark");
      await page.goto(canonical);
      await expect(page).toHaveURL(
        (url) => url.pathname === "/login" && url.searchParams.get("returnTo") === canonical,
      );
    }
    expect((await page.request.get("/api/v1/game-profiles")).status()).toBe(401);
    await page.getByRole("button", { name: "Discord로 로그인" }).click();
    await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === "/멤버");
    await expect(page.locator('nav a[aria-current="page"]').first()).toHaveText("게임 프로필");
    await expect(page.getByText(/표시할 게임 프로필이 없습니다/)).toBeVisible();
    await page.getByRole("link", { name: "내 프로필 등록·수정" }).click();
    await expect(page).toHaveURL(
      (url) => decodeURIComponent(url.pathname) === "/내정보" && url.hash === "#game-profile",
    );
    await expect(page.locator('nav a[aria-current="page"]').first()).toHaveText("내 정보");
    const editor = page.getByRole("region", { name: "내 게임 프로필" });
    await editor.getByRole("checkbox", { name: "LoL 등록" }).check();
    await editor
      .getByRole("group", { name: "League of Legends" })
      .getByLabel("닉네임", { exact: true })
      .fill("우리서버플레이어#KR1");
    await editor
      .getByRole("group", { name: "League of Legends" })
      .getByLabel(/티어/)
      .fill("골드 IV");
    await editor.getByRole("checkbox", { name: "PUBG 등록" }).check();
    await editor
      .getByRole("group", { name: "PUBG", exact: true })
      .getByLabel("닉네임", { exact: true })
      .fill("BattlePlayer");
    await page.screenshot({ path: testInfo.outputPath("game-profile-editor.png"), fullPage: true });
    await editor.getByRole("button", { name: "프로필 저장" }).click();
    await expect(editor.getByText("게임 프로필을 저장했습니다.")).toBeVisible();
    await expect(editor.getByRole("article")).toContainText("사용자 입력");
    await expect(editor.getByRole("article")).toContainText("티어 미입력");
    await page.reload();
    await expect(editor.getByRole("article")).toContainText("우리서버플레이어#KR1");
    await editor.getByRole("button", { name: "프로필 편집" }).click();
    await editor.getByRole("checkbox", { name: "PUBG 등록" }).uncheck();
    await editor
      .getByRole("group", { name: "League of Legends" })
      .getByLabel(/티어/)
      .fill("플래티넘 IV");
    await editor.getByRole("button", { name: "프로필 저장" }).click();
    await expect(editor.getByRole("article")).toContainText("플래티넘 IV");
    expect(await database.gameProfileEntry.count()).toBe(1);
    await editor.getByRole("link", { name: "멤버 프로필 보기 →" }).click();
    await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === "/멤버");
    await expect(
      page.getByRole("heading", { name: "멤버 게임 프로필", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText("플래티넘 IV");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("game-profile-directory.png"),
      fullPage: true,
    });
    await page.getByRole("combobox", { name: "게임별 보기" }).selectOption("pubg");
    await expect(page.getByText(/표시할 게임 프로필이 없습니다/)).toBeVisible();
    const guest = await browser.newContext();
    try {
      const response = await guest.request.get(new URL("/api/v1/game-profiles", page.url()).href);
      expect(response.status()).toBe(401);
      expect(await response.text()).not.toContain("우리서버플레이어");
    } finally {
      await guest.close();
    }
    await page.goto("/me#game-profile");
    await expect(page).toHaveURL(
      (url) => decodeURIComponent(url.pathname) === "/내정보" && url.hash === "#game-profile",
    );
    await editor.getByRole("button", { name: "프로필 삭제" }).click();
    await editor.getByRole("button", { name: "삭제 확인" }).click();
    await expect(editor.getByText("게임 프로필을 삭제했습니다.")).toBeVisible();
    expect(await database.gameProfile.count()).toBe(0);
    expect(await database.gameProfileEntry.count()).toBe(0);
    await database.account.updateMany({
      where: { accountId: "175928847299117063" },
      data: { accountId: "175928847299117064" },
    });
    await page.reload();
    await expect(editor.getByRole("alert")).toContainText("대상 Discord 서버 멤버만");
    await expect(page.getByRole("heading", { name: "내 포인트" })).toBeVisible();
    expect((await page.request.get("/api/v1/game-profiles")).status()).toBe(403);
  } finally {
    await database.$disconnect();
  }
});
