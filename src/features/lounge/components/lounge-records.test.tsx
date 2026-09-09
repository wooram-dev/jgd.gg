// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RankingData } from "@/features/ranking/schemas/response";
import { LoungeRecords } from "./lounge-records";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const data: RankingData = {
  gameSlug: "number-click",
  period: { key: "today", timeZone: "Asia/Seoul", startsAt: null, endsAt: null },
  items: [],
  viewer: null,
  pagination: { limit: 5, offset: 0, returned: 0, hasMore: false },
};

describe("라운지의 커뮤니티 기록", () => {
  it("빈 기록과 연결 불가를 구분한다", () => {
    const { rerender } = render(<LoungeRecords initialData={data} initialState="ready" />);
    expect(screen.getByText("오늘의 첫 기록은 누구일까요?")).toBeVisible();
    rerender(<LoungeRecords key="unavailable" initialData={null} initialState="unavailable" />);
    expect(screen.queryByText("오늘의 첫 기록은 누구일까요?")).not.toBeInTheDocument();
    expect(screen.getByText("커뮤니티 기록을 연결하고 있어요")).toBeVisible();
  });

  it("오류 후 재시도로 실제 응답의 기록과 내 표시를 복구한다", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ...data,
          items: [
            {
              rank: 1,
              displayName: "테스트 멤버",
              avatarUrl: null,
              finalMs: 14370,
              mistakeCount: 1,
              achievedAt: "2026-09-10T01:00:00Z",
              isViewer: true,
            },
          ],
        },
        meta: { requestId: "test-request" },
      }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<LoungeRecords initialData={null} initialState="error" />);
    await user.click(screen.getByRole("button", { name: "다시 불러오기" }));
    expect(await screen.findByText("테스트 멤버 · 나")).toBeVisible();
    expect(screen.getByText("14.37초")).toBeVisible();
    expect(screen.queryByText("기록을 잠시 불러오지 못했어요")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("limit=5"), { cache: "no-store" });
  });

  it("잘못된 응답을 빈 기록이나 성공으로 표시하지 않는다", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }),
    );
    render(<LoungeRecords initialData={null} initialState="error" />);
    await user.click(screen.getByRole("button", { name: "다시 불러오기" }));
    expect(screen.getByText("기록을 잠시 불러오지 못했어요")).toBeVisible();
    expect(screen.queryByText("오늘의 첫 기록은 누구일까요?")).not.toBeInTheDocument();
  });
});
