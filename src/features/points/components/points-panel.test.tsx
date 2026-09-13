// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PointsPanel } from "./points-panel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function response(data: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);
}

describe("PointsPanel", () => {
  it("loading 뒤 확정 잔액과 빈 내역을 구분한다", async () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      response({
        data: { balance: 0, unit: "P", transactions: [] },
        meta: { requestId: "request-1" },
      }),
    );
    render(<PointsPanel />);

    expect(screen.getByRole("status")).toHaveTextContent("포인트를 불러오는 중");
    expect(await screen.findByText("0 P")).toBeVisible();
    expect(screen.getByText("아직 포인트 변동 내역이 없습니다.")).toBeVisible();
  });

  it("적립과 회수를 부호·사유·시각으로 표시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      response({
        data: {
          balance: 0,
          unit: "P",
          transactions: [
            {
              id: "00000000-0000-4000-8000-000000000002",
              type: "REVERSAL",
              reason: "GAME_RECORD_INVALIDATION",
              amount: -10,
              balanceAfter: 0,
              policyVersion: "number-click-completion-v1",
              createdAt: "2026-09-12T01:00:00.000Z",
            },
            {
              id: "00000000-0000-4000-8000-000000000001",
              type: "EARN",
              reason: "NUMBER_CLICK_COMPLETION",
              amount: 10,
              balanceAfter: 10,
              policyVersion: "number-click-completion-v1",
              createdAt: "2026-09-12T00:00:00.000Z",
            },
          ],
        },
        meta: { requestId: "request-1" },
      }),
    );
    render(<PointsPanel />);

    expect(await screen.findByText("+10 P")).toBeVisible();
    expect(screen.getByText("-10 P")).toBeVisible();
    expect(screen.getByText("공식 기록 무효화 회수")).toBeVisible();
    expect(screen.getAllByRole("time")).toHaveLength(2);
  });

  it("조회 실패와 재시도 후 복구를 제공한다", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(response({}, false))
      .mockReturnValueOnce(
        response({
          data: { balance: 10, unit: "P", transactions: [] },
          meta: { requestId: "request-2" },
        }),
      );
    render(<PointsPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent("포인트를 불러오지 못했습니다");
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    expect(await screen.findByText("10 P")).toBeVisible();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
