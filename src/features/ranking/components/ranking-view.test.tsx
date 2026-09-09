// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RankingData } from "../schemas/response";
import { RankingView } from "./ranking-view";

const initialData: RankingData = {
  gameSlug: "number-click",
  period: {
    key: "today",
    timeZone: "Asia/Seoul",
    startsAt: "2026-09-06T15:00:00.000Z",
    endsAt: "2026-09-07T15:00:00.000Z",
  },
  items: [
    {
      rank: 1,
      displayName: "아주 긴 플레이어 이름이 화면에서 잘려도 접근 가능한 이름",
      avatarUrl: null,
      finalMs: 9_830,
      mistakeCount: 0,
      achievedAt: "2026-09-07T01:00:00.000Z",
      isViewer: false,
    },
  ],
  viewer: {
    rank: 152,
    displayName: "나",
    avatarUrl: null,
    finalMs: 18_020,
    mistakeCount: 1,
    achievedAt: "2026-09-07T02:00:00.000Z",
    isViewer: true,
  },
  pagination: { limit: 100, offset: 0, returned: 1, hasMore: false },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RankingView", () => {
  it("KST label, 긴 이름, top 100 밖 viewer card를 표시한다", () => {
    render(<RankingView initialData={initialData} />);

    expect(screen.getByText("Asia/Seoul 기준 · 사용자별 최고 기록")).toBeVisible();
    expect(
      screen.getByTitle("아주 긴 플레이어 이름이 화면에서 잘려도 접근 가능한 이름"),
    ).toBeVisible();
    expect(screen.getByText("152위")).toBeVisible();
  });

  it("화살표 키로 기간 tab을 이동하고 API 결과를 반영한다", async () => {
    const weekData: RankingData = {
      ...initialData,
      period: { ...initialData.period, key: "week" },
      items: [],
      viewer: null,
      pagination: { limit: 100, offset: 0, returned: 0, hasMore: false },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: weekData, meta: { requestId: "request-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    render(<RankingView initialData={initialData} />);

    const todayTab = screen.getByRole("tab", { name: "오늘" });
    todayTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(await screen.findByRole("tab", { name: "이번 주", selected: true })).toHaveFocus();
    expect(
      screen.getByText("아직 이 기간의 기록이 없습니다. 첫 기록에 도전해 보세요."),
    ).toBeVisible();
    expect(window.location.search).toBe("?period=week");
  });

  it("응답 오류를 안전한 문구로 표시하고 기존 목록을 유지한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<RankingView initialData={initialData} />);

    await user.click(screen.getByRole("tab", { name: "전체" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "랭킹을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    );
    expect(screen.getByText("9.83초")).toBeVisible();
  });
});
