import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { cleanApplicationData, createTestDatabase } from "../helpers/database";

test("프로필 스토리 목록·비로그인 팝업·게시·열람·만료·원본 보관", async ({
  page,
  browser,
}, testInfo) => {
  const database = createTestDatabase();
  try {
    const avatar = await sharp({
      create: { width: 80, height: 80, channels: 3, background: "#32aa97" },
    })
      .png()
      .toBuffer();
    // A local avatar fixture avoids contacting Discord; story photos use the real API.
    await page.route("**/_next/image?**", async (route) =>
      route.fulfill({ contentType: "image/png", body: avatar }),
    );
    await cleanApplicationData(database);
    await page.goto("/");
    await expect(page.getByRole("button", { name: /내 스토리/ })).toBeVisible();
    const guest = await page.request.get("/api/v1/stories");
    expect(guest.status()).toBe(200);
    await page.getByRole("button", { name: /내 스토리/ }).click();
    await expect(page.getByRole("dialog", { name: "로그인이 필요해요" })).toBeVisible();
    await page.getByRole("link", { name: "로그인하기", exact: true }).click();
    await page.getByRole("button", { name: "Discord로 로그인" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("오늘의 첫 이야기를 기다려요.")).toBeVisible();
    const uploadButton = page.getByRole("button", { name: /내 스토리/ });
    await uploadButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const dialog = await page.getByRole("dialog").boundingBox();
    expect(dialog).not.toBeNull();
    expect(dialog!.x).toBeGreaterThan(0);
    const original = await sharp({
      create: { width: 600, height: 900, channels: 3, background: "#665ccf" },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel(/사진 선택/)
      .setInputFiles({ name: "story.png", mimeType: "image/png", buffer: original });
    await expect(page.getByAltText("게시할 사진 미리보기")).toBeVisible();
    await page.getByRole("button", { name: "24시간 공개하기" }).click();
    await expect(page.getByText(/사진을 게시했습니다/)).toBeVisible();
    await expect(uploadButton).toBeFocused();
    await uploadButton.click();
    await page
      .getByLabel(/사진 선택/)
      .setInputFiles({ name: "second.png", mimeType: "image/png", buffer: original });
    await page.getByRole("button", { name: "24시간 공개하기" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const stored = await database.story.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(stored).toHaveLength(2);
    const row = stored[0];
    const storyButton = page.getByRole("button", { name: "E2E Player님의 스토리 보기" });
    await expect(storyButton).toHaveCount(1);
    await expect(storyButton.locator("img")).toHaveAttribute("src", /cdn\.discordapp\.com/);
    await page.getByRole("button", { name: "E2E Player님의 스토리 보기" }).click();
    const photo = page.getByAltText("E2E Player님의 스토리 사진");
    await expect(photo).toBeVisible();
    await expect(page.getByLabel("현재 스토리")).toHaveText("1 / 2");
    await expect(photo).toHaveAttribute("src", new RegExp(stored[0].id));
    await expect
      .poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(photo).toHaveAttribute("src", new RegExp(stored[1].id), { timeout: 8000 });
    await expect(page.getByLabel("현재 스토리")).toHaveText("2 / 2");
    await page.getByRole("button", { name: "이전 사진" }).click({ position: { x: 15, y: 100 } });
    await expect(photo).toHaveAttribute("src", new RegExp(stored[0].id));
    await page.getByRole("button", { name: "다음 사진" }).click({ position: { x: 50, y: 100 } });
    await expect(photo).toHaveAttribute("src", new RegExp(stored[1].id));
    await page.getByRole("button", { name: "일시정지" }).click();
    await page.screenshot({ path: testInfo.outputPath("story-viewer.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("story-strip.png"), fullPage: true });
    const guestContext = await browser.newContext({ viewport: page.viewportSize()! });
    try {
      const guestPage = await guestContext.newPage();
      const photoRequests: string[] = [];
      guestPage.on("request", (request) => {
        if (/\/api\/v1\/stories\/.+\/image/.test(request.url())) photoRequests.push(request.url());
      });
      await guestPage.route("**/_next/image?**", async (route) =>
        route.fulfill({ contentType: "image/png", body: avatar }),
      );
      await guestPage.goto(new URL("/", page.url()).href);
      const guestStory = guestPage.getByRole("button", { name: "E2E Player님의 스토리 보기" });
      await expect(guestStory).toHaveCount(1);
      await expect(guestStory.locator("img")).toHaveAttribute(
        "src",
        (await storyButton.locator("img").getAttribute("src")) ?? "",
      );
      await expect(guestPage.getByRole("dialog")).not.toBeVisible();
      await guestPage.screenshot({
        path: testInfo.outputPath("story-guest-strip.png"),
        fullPage: true,
      });
      await guestStory.click();
      await expect(guestPage.getByRole("dialog", { name: "로그인이 필요해요" })).toBeVisible();
      await expect(guestPage.getByAltText("E2E Player님의 스토리 사진")).not.toBeVisible();
      expect(photoRequests).toEqual([]);
      await guestPage.screenshot({
        path: testInfo.outputPath("story-login-dialog.png"),
        fullPage: true,
      });
      await guestPage.keyboard.press("Escape");
      await expect(guestStory).toBeFocused();
      expect(
        (
          await guestContext.request.get(
            new URL(`/api/v1/stories/${row.id}/image`, page.url()).href,
          )
        ).status(),
      ).toBe(401);
      expect(
        await guestPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    } finally {
      await guestContext.close();
    }
    const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await database.story.updateMany({
      where: { userId: row.userId },
      data: { createdAt, expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) },
    });
    const expiredImage = await page.request.get(`/api/v1/stories/${row.id}/image`);
    expect(expiredImage.status()).toBe(404);
    await page.reload();
    await expect(page.getByText("오늘의 첫 이야기를 기다려요.")).toBeVisible();
    expect(
      Buffer.from((await database.story.findUniqueOrThrow({ where: { id: row.id } })).original),
    ).toEqual(original);
  } finally {
    await database.$disconnect();
  }
});
