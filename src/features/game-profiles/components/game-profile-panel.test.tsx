// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProfilePanel } from "./game-profile-panel";

const profile = {
  id: "1b4ef645-0441-4a8d-b471-876428546d89",
  displayName: "Player",
  avatarUrl: null,
  isViewer: true,
  source: "SELF_REPORTED",
  games: [{ game: "lol", nickname: "Player#KR1", tier: "골드 IV" }],
  updatedAt: "2026-09-16T00:00:00.000Z",
};
function response(value: typeof profile | null) {
  return Response.json({ data: { profile: value }, meta: { requestId: "test" } });
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("game profile editor", () => {
  it("keeps input after a failed save and retries before showing the saved card", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(null))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response(profile));
    vi.stubGlobal("fetch", fetchMock);
    render(<GameProfilePanel />);
    await user.click(await screen.findByRole("checkbox", { name: "LoL 등록" }));
    await user.type(screen.getByLabelText("닉네임"), "Player#KR1");
    await user.type(screen.getByLabelText(/티어.*선택/), "골드 IV");
    await user.click(screen.getByRole("button", { name: "프로필 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("다시 시도");
    expect(screen.getByLabelText("닉네임")).toHaveValue("Player#KR1");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "프로필 저장" }));
    expect(await screen.findByRole("article")).toHaveTextContent("사용자 입력");
    expect(screen.getByRole("article")).toHaveTextContent("공식 티어는 확인하지 않았습니다");
    expect(screen.getByRole("heading", { name: "내 게임 프로필" })).toHaveFocus();
    const firstBody = fetchMock.mock.calls[1][1]?.body;
    expect(firstBody).toBe(fetchMock.mock.calls[2][1]?.body);
    expect(JSON.parse(String(firstBody))).toEqual({ games: profile.games });
  });
  it("supports editing, canceling and explicitly confirming deletion", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(profile))
      .mockResolvedValueOnce(response(null));
    vi.stubGlobal("fetch", fetchMock);
    render(<GameProfilePanel />);
    await user.click(await screen.findByRole("button", { name: "프로필 편집" }));
    await user.clear(screen.getByLabelText("닉네임"));
    await user.type(screen.getByLabelText("닉네임"), "Unsaved");
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("article")).toHaveTextContent("Player#KR1");
    await user.click(screen.getByRole("button", { name: "프로필 삭제" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "삭제 확인" }));
    expect(await screen.findByText("게임 프로필을 삭제했습니다.")).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE", body: "{}" });
  });
  it("blocks duplicate submissions while the response is pending", async () => {
    const user = userEvent.setup();
    let resolveSave: (response: Response) => void = () => {};
    const saving = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(profile))
      .mockReturnValueOnce(saving);
    vi.stubGlobal("fetch", fetchMock);
    render(<GameProfilePanel />);
    await user.click(await screen.findByRole("button", { name: "프로필 편집" }));
    await user.dblClick(screen.getByRole("button", { name: "프로필 저장" }));
    expect(screen.getByRole("button", { name: "처리 중…" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveSave(response(profile));
    await screen.findByText("게임 프로필을 저장했습니다.");
  });
  it("removes protected fields when membership is lost and recovers through a fresh check", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(profile))
      .mockResolvedValueOnce(
        Response.json({ error: { code: "GUILD_MEMBER_REQUIRED" } }, { status: 403 }),
      )
      .mockResolvedValueOnce(response(profile));
    vi.stubGlobal("fetch", fetchMock);
    render(<GameProfilePanel />);
    await user.click(await screen.findByRole("button", { name: "프로필 편집" }));
    await user.click(screen.getByRole("button", { name: "프로필 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("대상 Discord 서버 멤버만");
    expect(screen.queryByLabelText("닉네임")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 확인하기" }));
    await waitFor(() => expect(screen.getByRole("article")).toHaveTextContent("Player#KR1"));
  });
});
