// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as apiClient from "../client/api-client";
import { NumberClickGame } from "./number-click-game";

const { refreshRouter } = vi.hoisted(() => ({ refreshRouter: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshRouter }) }));

vi.mock("../client/practice-board", () => ({
  createPracticeBoard: () => Array.from({ length: 25 }, (_, index) => index + 1),
}));

beforeEach(() => {
  vi.useFakeTimers();
  refreshRouter.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("NumberClickGame", () => {
  it("countdown 동안 board를 잠그고 취소하면 IDLE로 돌아간다", () => {
    render(
      <NumberClickGame
        authenticated={false}
        officialEligible={false}
        personalBest={null}
        todayBest={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "연습 시작" }));
    expect(screen.getByRole("button", { name: "숫자 1" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("button", { name: "연습 시작" })).toBeVisible();
  });

  it("오클릭과 완료 cell을 유지하고 연습 결과 heading에 focus한다", async () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    render(
      <NumberClickGame
        authenticated={false}
        officialEligible={false}
        personalBest={null}
        todayBest={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "연습 시작" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(screen.getByText("다음 숫자")).toBeVisible();

    now = 1_100;
    fireEvent.click(screen.getByRole("button", { name: "숫자 2" }));
    expect(screen.getByText("오클릭 1회")).toBeVisible();

    for (let value = 1; value <= 25; value += 1) {
      now = 1_000 + value * 160;
      fireEvent.click(screen.getByRole("button", { name: `숫자 ${value}` }));
      if (value === 1) {
        expect(screen.getByRole("button", { name: "숫자 1, 완료됨" })).toBeVisible();
      }
    }

    const resultHeading = screen.getByRole("heading", { level: 2, name: "4.50초" });
    expect(resultHeading).toHaveFocus();
    expect(screen.getByText("연습 기록", { exact: true })).toBeVisible();
    expect(screen.getByText("이 기록은 저장되지 않았습니다.")).toBeVisible();
  });

  it("공식 완료 성공 뒤 서버 컴포넌트를 새로고침한다", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(apiClient, "createOfficialSession").mockResolvedValue({
      data: {
        session: { id: sessionId, status: "READY" },
        board: Array.from({ length: 25 }, (_, index) => index + 1),
      },
      meta: { requestId: "request-create", idempotentReplay: false },
    });
    vi.spyOn(apiClient, "startOfficialSession").mockResolvedValue({
      data: {
        session: {
          id: sessionId,
          status: "PLAYING",
          startedAt: "2026-09-13T12:00:00.000Z",
          expiresAt: "2026-09-13T12:05:00.000Z",
        },
      },
      meta: { requestId: "request-start", idempotentReplay: false },
    });
    vi.spyOn(apiClient, "completeOfficialSession").mockResolvedValue({
      record: {
        id: "22222222-2222-4222-8222-222222222222",
        durationMs: 4_000,
        mistakeCount: 0,
        penaltyMs: 0,
        finalMs: 4_000,
        achievedAt: "2026-09-13T12:00:04.000Z",
      },
      result: { isPersonalBest: true, previousPersonalBestMs: null },
      ranks: { today: 1, week: 1, all: 1 },
      points: {
        status: "AWARDED",
        awarded: 10,
        balance: 20,
        dailyLimit: 50,
        policyVersion: "number-click-completion-v1",
      },
    });

    render(<NumberClickGame authenticated officialEligible personalBest={null} todayBest={null} />);

    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(screen.getByText("다음 숫자")).toBeVisible();

    for (let value = 1; value <= 25; value += 1) {
      now = 1_000 + value * 160;
      fireEvent.click(screen.getByRole("button", { name: `숫자 ${value}` }));
    }
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("+10 P 적립 · 보유 20 P", { exact: true })).toBeVisible();
    expect(refreshRouter).toHaveBeenCalledOnce();
  });
});
