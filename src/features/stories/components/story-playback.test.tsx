// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoryPlayback } from "./story-playback";

const story = {
  id: "665f6b69-df22-4b09-b30e-c136bd31da50",
  displayName: "친구",
  avatarUrl: null,
  isViewer: false,
  createdAt: "2026-09-15T00:00:00.000Z",
  expiresAt: "2026-09-16T00:00:00.000Z",
};
const props = () => ({
  story,
  position: 0,
  total: 2,
  hasPrevious: true,
  onPrevious: vi.fn(),
  onNext: vi.fn(),
});
async function loadPhoto() {
  await act(async () => {
    fireEvent.load(screen.getByRole("img"));
  });
}
const advance = async (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("story playback", () => {
  it("사진 로드 후 정확히 5초에 한 번 넘기고 부모 갱신에도 경과 시간을 유지한다", async () => {
    const input = props();
    const view = render(<StoryPlayback {...input} />);
    await advance(7000);
    expect(input.onNext).not.toHaveBeenCalled();
    await loadPhoto();
    await advance(2000);
    view.rerender(<StoryPlayback {...input} onNext={() => input.onNext()} />);
    await advance(2999);
    expect(input.onNext).not.toHaveBeenCalled();
    await advance(1);
    expect(input.onNext).toHaveBeenCalledTimes(1);
    await advance(5000);
    expect(input.onNext).toHaveBeenCalledTimes(1);
  });
  it("일시정지와 숨겨진 탭에서는 시간을 멈추고 복귀하면 남은 시간만 재생한다", async () => {
    const input = props();
    render(<StoryPlayback {...input} />);
    await loadPhoto();
    await advance(2000);
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    await advance(10000);
    fireEvent.click(screen.getByRole("button", { name: "재생" }));
    await advance(1000);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    await advance(10000);
    expect(input.onNext).not.toHaveBeenCalled();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await advance(1999);
    expect(input.onNext).not.toHaveBeenCalled();
    await advance(1);
    expect(input.onNext).toHaveBeenCalledOnce();
  });
  it("좌우 영역과 방향키로 이동하며 오류 사진은 자동으로 넘기지 않는다", async () => {
    const input = props();
    const view = render(<StoryPlayback {...input} />);
    fireEvent.error(screen.getByRole("img"));
    await advance(10000);
    expect(input.onNext).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("사진을 열 수 없습니다");
    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(input.onPrevious).toHaveBeenCalledTimes(2);
    expect(input.onNext).toHaveBeenCalledTimes(2);
    view.unmount();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(input.onNext).toHaveBeenCalledTimes(2);
  });
});
