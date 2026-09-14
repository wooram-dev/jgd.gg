// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoryStrip } from "./story-strip";

const viewer = { displayName: "나", status: "ACTIVE" as const };
const story = {
  id: "665f6b69-df22-4b09-b30e-c136bd31da50",
  displayName: "친구",
  avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
  isViewer: false,
  createdAt: "2026-09-13T00:00:00.000Z",
  expiresAt: "2026-09-14T00:00:00.000Z",
};
const feed = (items = [story], serverNow = "2026-09-13T01:00:00.000Z") =>
  Response.json({
    data: {
      items: items.map((item) => ({ ...item, stories: [item] })),
      serverNow,
      nextCursor: null,
    },
  });
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => feed()),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("story strip", () => {
  it("작성자당 프로필 하나에서 시간순 자동 재생·좌우 이동·마지막 닫기를 제공한다", async () => {
    const second = {
      ...story,
      id: "665f6b69-df22-4b09-b30e-c136bd31da51",
      createdAt: "2026-09-13T00:01:00.000Z",
    };
    const other = {
      ...story,
      id: "665f6b69-df22-4b09-b30e-c136bd31da52",
      displayName: "다른 친구",
    };
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        data: {
          items: [
            { ...second, stories: [story, second] },
            { ...other, stories: [other] },
          ],
          serverNow: "2026-09-13T01:00:00.000Z",
          nextCursor: null,
        },
      }),
    );
    render(<StoryStrip viewer={viewer} />);
    const trigger = await screen.findByRole("button", {
      name: "친구님의 스토리 보기",
    });
    expect(screen.getAllByRole("button", { name: /님의 스토리 보기/ })).toHaveLength(2);
    await userEvent.click(trigger);
    vi.useFakeTimers();
    const photo = () => screen.getByRole("img", { name: /님의 스토리 사진/ });
    const load = async () =>
      act(async () => {
        fireEvent.load(photo());
      });
    expect(photo().getAttribute("src")).toContain(story.id);
    expect(screen.getByRole("button", { name: "이전 사진" })).toBeDisabled();
    await load();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(photo().getAttribute("src")).toContain(second.id);
    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));
    expect(photo().getAttribute("src")).toContain(story.id);
    await load();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(photo().getAttribute("src")).toContain(story.id);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(photo().getAttribute("src")).toContain(second.id);
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(photo().getAttribute("src")).toContain(other.id);
    await load();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("비로그인도 프로필 목록을 보고 클릭하면 로그인 팝업과 focus 복구를 제공한다", async () => {
    render(<StoryStrip viewer={null} />);
    const trigger = await screen.findByRole("button", { name: "친구님의 스토리 보기" });
    expect(trigger.querySelector("img")?.getAttribute("src")).toContain(
      encodeURIComponent(story.avatarUrl),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "로그인이 필요해요" })).toBeVisible();
    expect(screen.getByRole("link", { name: "로그인하기" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2F",
    );
    expect(screen.queryByRole("img", { name: "친구님의 스토리 사진" })).not.toBeInTheDocument();
    expect(trigger).not.toHaveAccessibleName(/확인함/);
    act(() => {
      screen.getByRole("dialog").dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: /내 스토리/ }));
    expect(screen.getByRole("dialog", { name: "로그인이 필요해요" })).toBeVisible();
    expect(screen.queryByLabelText(/사진 선택/)).not.toBeInTheDocument();
  });
  it("로그인 목록도 작성자 아바타를 쓰고 프로필 로드 실패 시 이름으로 대체한다", async () => {
    render(<StoryStrip viewer={viewer} />);
    const trigger = await screen.findByRole("button", { name: "친구님의 스토리 보기" });
    const avatar = trigger.querySelector("img")!;
    expect(avatar.getAttribute("src")).toContain(encodeURIComponent(story.avatarUrl));
    expect(document.querySelector('img[src*="/api/v1/stories/"]')).toBeNull();
    fireEvent.error(avatar);
    expect(trigger.querySelector(".avatar-fallback")).toHaveTextContent("친");
    await userEvent.click(trigger);
    expect(screen.getByRole("img", { name: "친구님의 스토리 사진" })).toHaveAttribute(
      "src",
      new URL(`/api/v1/stories/${story.id}/image`, window.location.origin).href,
    );
  });
  it("조회 실패와 실제 빈 목록을 구분하며 재시도한다", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(feed([]));
    render(<StoryStrip viewer={viewer} />);
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    expect(await screen.findByText("오늘의 첫 이야기를 기다려요.")).toBeVisible();
  });
  it("서버 시각으로 열린 사진도 24시간 경계에서 제거하고 닫은 뒤 focus를 복구한다", async () => {
    vi.mocked(fetch).mockResolvedValue(feed([story], "2026-09-13T23:59:59.000Z"));
    render(<StoryStrip viewer={viewer} />);
    const button = await screen.findByRole("button", { name: "친구님의 스토리 보기" });
    await userEvent.click(button);
    expect(screen.getByRole("img", { name: "친구님의 스토리 사진" })).toBeVisible();
    await waitFor(() => expect(button).toHaveAccessibleName(/확인함/));
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    await waitFor(() =>
      expect(screen.queryByRole("img", { name: "친구님의 스토리 사진" })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("24시간이 지나 이 사진은 더 이상 열람할 수 없습니다.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "스토리 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("미리보기, 원본 보관 안내, 실패 재전송의 같은 key와 성공 후 갱신", async () => {
    const keys: string[] = [];
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      if (options?.method === "POST") {
        keys.push(new Headers(options.headers).get("Idempotency-Key")!);
        if (++attempts === 1) throw new Error("전송 실패");
        return Response.json({ data: { story } });
      }
      return feed([]);
    });
    render(<StoryStrip viewer={viewer} />);
    await screen.findByText("오늘의 첫 이야기를 기다려요.");
    const trigger = screen.getByRole("button", { name: /내 스토리/ });
    await userEvent.click(trigger);
    expect(screen.getByText(/이후에는 숨겨지며 사진 원본은 서버에 보관/)).toBeVisible();
    await userEvent.upload(
      screen.getByLabelText(/사진 선택/),
      new File(["png"], "photo.png", { type: "image/png" }),
    );
    expect(screen.getByRole("img", { name: "게시할 사진 미리보기" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "24시간 공개하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("사진을 게시하지 못했습니다");
    await userEvent.click(screen.getByRole("button", { name: "24시간 공개하기" }));
    expect(await screen.findByText(/사진을 게시했습니다/)).toBeVisible();
    expect(keys[0]).toBe(keys[1]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(trigger).toHaveFocus();
  });
  it("과대 파일과 차단 계정 게시를 막고 Escape로 닫는다", async () => {
    const view = render(<StoryStrip viewer={viewer} />);
    await userEvent.click(screen.getByRole("button", { name: /내 스토리/ }));
    fireEvent.change(screen.getByLabelText(/사진 선택/), {
      target: {
        files: [
          new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
        ],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("5MB 이하");
    expect(screen.getByRole("button", { name: "24시간 공개하기" })).toBeDisabled();
    act(() => {
      screen.getByRole("dialog").dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.rerender(<StoryStrip viewer={{ ...viewer, status: "BANNED" }} />);
    expect(screen.getByRole("button", { name: /내 스토리/ })).toBeDisabled();
  });
});
