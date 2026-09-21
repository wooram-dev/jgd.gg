import { expect, test } from "@playwright/test";

test("게임 성향을 알아보고 친구와 비교하며 답변을 저장하지 않는다", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedResult = text;
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("link", { name: /파티 속 나는 어떤 캐릭터/ }).click();
  await expect(page).toHaveURL(new RegExp(encodeURI("/게임궁합") + "$"));
  await expect(page.getByRole("heading", { name: "게임 궁합", exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const menu = page.getByLabel("메뉴 열기");
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  const navigation = page.getByRole("navigation", { name: mobile ? "모바일 메뉴" : "주요 메뉴" });
  await expect(navigation.getByRole("link", { name: "게임 궁합" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await navigation.getByRole("link", { name: "게임 궁합" }).click();
  if (mobile) await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open");
  await page.screenshot({ path: testInfo.outputPath("compatibility-intro.png"), fullPage: true });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
  const storageBefore = await page.evaluate(() => [
    JSON.stringify(localStorage),
    JSON.stringify(sessionStorage),
  ]);
  await page.getByRole("button", { name: "내 게임 성향 알아보기" }).click();
  await expect(page.getByRole("button", { name: "다음 질문" })).toBeDisabled();
  for (let index = 0; index < 12; index++) {
    await page.getByRole("radio").nth(0).check();
    if (index === 0) {
      await page.getByRole("button", { name: "다음 질문" }).click();
      await page.getByRole("button", { name: "이전 질문" }).click();
      await expect(page.getByRole("radio").nth(0)).toBeChecked();
    }
    await page.getByRole("button", { name: index === 11 ? "내 유형 보기" : "다음 질문" }).click();
  }
  await expect(page.getByRole("heading", { name: "작전 짜는 파티장" })).toBeFocused();
  await page.getByLabel("친구의 게임 성향").selectOption("FISQ");
  await expect(page.getByText("네 가지 중 0가지 성향이 같아요.")).toBeVisible();
  await page.getByRole("button", { name: "결과 복사하기" }).click();
  await expect(page.getByRole("button", { name: "복사했어요" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.copiedResult)).toContain(
    "같은 성향 0/4개",
  );
  expect(
    await page.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]),
  ).toEqual(storageBefore);
  expect(requests.filter((request) => /^(POST|PUT|PATCH|DELETE) /.test(request))).toEqual([]);
  expect(requests.filter((request) => /RPTV|FISQ|answers=|friend=/.test(request))).toEqual([]);
  await expect(page).toHaveURL(new RegExp(encodeURI("/게임궁합") + "$"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({ path: testInfo.outputPath("compatibility-result.png"), fullPage: true });
  await page.getByRole("button", { name: "답변 수정하기" }).click();
  await expect(page.getByRole("radio").nth(0)).toBeChecked();
  await page.reload();
  await expect(page.getByRole("button", { name: "내 게임 성향 알아보기" })).toBeVisible();
  await page.getByRole("button", { name: "내 게임 성향 알아보기" }).click();
  await expect(page.getByRole("button", { name: "다음 질문" })).toBeDisabled();
});
