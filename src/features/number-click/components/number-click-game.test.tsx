// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NumberClickGame } from "./number-click-game";

vi.mock("../client/practice-board", () => ({
  createPracticeBoard: () => Array.from({ length: 25 }, (_, index) => index + 1),
}));

beforeEach(() => {
  vi.useFakeTimers();
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
});
