// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GameProfileDirectory } from "./game-profile-directory";

const profile = {
  id: "1b4ef645-0441-4a8d-b471-876428546d89",
  displayName: "Member",
  avatarUrl: null,
  isViewer: false,
  source: "SELF_REPORTED",
  games: [{ game: "pubg", nickname: "MemberGame", tier: null }],
  updatedAt: "2026-09-16T00:00:00.000Z",
};
function result(items: Array<typeof profile>, nextCursor: string | null = null) {
  return Response.json({ data: { items, nextCursor }, meta: { requestId: "test" } });
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("filters games and pages with a cursor, clearing cards on access errors", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(result([profile], profile.id))
    .mockResolvedValueOnce(result([]))
    .mockResolvedValueOnce(
      Response.json({ error: { code: "GUILD_MEMBER_REQUIRED" } }, { status: 403 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<GameProfileDirectory />);
  expect(await screen.findByRole("article")).toHaveTextContent("티어 미입력");
  await user.click(screen.getByRole("button", { name: "다음 멤버 보기" }));
  expect(await screen.findByText(/표시할 게임 프로필이 없습니다/)).toBeVisible();
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/game-profiles?cursor=${profile.id}`);
  await user.selectOptions(screen.getByRole("combobox", { name: "게임별 보기" }), "pubg");
  expect(await screen.findByRole("alert")).toHaveTextContent("대상 Discord 서버 멤버만");
  expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/game-profiles?game=pubg");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
it("distinguishes malformed responses from an empty directory and supports retry", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ data: { items: [profile] } }))
    .mockResolvedValueOnce(result([]));
  vi.stubGlobal("fetch", fetchMock);
  render(<GameProfileDirectory />);
  await screen.findByRole("alert");
  expect(screen.queryByText(/표시할 게임 프로필이 없습니다/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "다시 불러오기" }));
  await waitFor(() => expect(screen.getByText(/표시할 게임 프로필이 없습니다/)).toBeVisible());
});
