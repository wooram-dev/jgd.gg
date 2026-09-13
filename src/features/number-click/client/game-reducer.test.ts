import { describe, expect, it } from "vitest";

import { gameReducer, initialGameState, type GameState } from "./game-reducer";

const board = Array.from({ length: 25 }, (_, index) => index + 1);

function playing(mode: "practice" | "official" = "practice"): GameState {
  const ready = gameReducer(gameReducer(initialGameState, { type: "BEGIN", mode }), {
    type: "BOARD_READY",
    board,
    sessionId: mode === "official" ? "00000000-0000-4000-8000-000000000001" : null,
  });
  return gameReducer(ready, { type: "PLAY", startedPerformanceMs: 10 });
}

describe("gameReducer", () => {
  it("READY의 board, countdown, starting 전이를 명시적으로 처리한다", () => {
    const begun = gameReducer(initialGameState, { type: "BEGIN", mode: "official" });
    const ready = gameReducer(begun, {
      type: "BOARD_READY",
      board,
      sessionId: "00000000-0000-4000-8000-000000000001",
    });
    expect(ready).toMatchObject({ status: "READY", phase: "countdown", countdown: 3 });
    expect(gameReducer(ready, { type: "COUNTDOWN", value: 2 })).toMatchObject({ countdown: 2 });
    expect(gameReducer(ready, { type: "STARTING" })).toMatchObject({ phase: "starting" });
    expect(gameReducer(initialGameState, { type: "BOARD_READY", board, sessionId: null })).toBe(
      initialGameState,
    );
    expect(gameReducer(initialGameState, { type: "COUNTDOWN", value: 1 })).toBe(initialGameState);
    expect(gameReducer(initialGameState, { type: "STARTING" })).toBe(initialGameState);
  });

  it("PLAYING 밖 click을 무시한다", () => {
    expect(gameReducer(initialGameState, { type: "CLICK", value: 1, elapsedMs: 10 })).toBe(
      initialGameState,
    );
  });

  it("잘못된 길이의 board는 PLAYING으로 전환하지 않는다", () => {
    const ready = gameReducer(gameReducer(initialGameState, { type: "BEGIN", mode: "practice" }), {
      type: "BOARD_READY",
      board: board.slice(0, 24),
      sessionId: null,
    });
    expect(gameReducer(ready, { type: "PLAY", startedPerformanceMs: 10 })).toBe(ready);
  });

  it("TICK은 PLAYING timer만 갱신한다", () => {
    expect(gameReducer(initialGameState, { type: "TICK", elapsedMs: 100 })).toBe(initialGameState);
    expect(gameReducer(playing(), { type: "TICK", elapsedMs: 100 })).toMatchObject({
      currentElapsedMs: 100,
    });
  });

  it("오클릭 뒤에도 계속하고 완료 cell을 유지한다", () => {
    let state = playing();
    state = gameReducer(state, { type: "CLICK", value: 2, elapsedMs: 100 });
    state = gameReducer(state, { type: "CLICK", value: 1, elapsedMs: 200 });
    state = gameReducer(state, { type: "CLICK", value: 1, elapsedMs: 250 });
    expect(state).toMatchObject({
      status: "PLAYING",
      nextExpected: 2,
      mistakeCount: 2,
      completedValues: [1],
    });
  });

  it("공식 마지막 click에서 completion payload를 한 번 고정한다", () => {
    let state = playing("official");
    board.forEach((value) => {
      state = gameReducer(state, { type: "CLICK", value, elapsedMs: value * 160 });
    });
    expect(state.status).toBe("SUBMITTING");
    if (state.status !== "SUBMITTING") throw new Error("Expected submitting state");
    const payload = state.completionPayload;
    expect(payload.clientElapsedMs).toBe(4_000);
    expect(payload.events).toHaveLength(25);
    expect(gameReducer(state, { type: "CLICK", value: 25, elapsedMs: 4_001 })).toBe(state);
  });

  it("연습 완료에서 실제 시간과 페널티를 확정한다", () => {
    let state = playing();
    state = gameReducer(state, { type: "CLICK", value: 2, elapsedMs: 10 });
    board.forEach((value) => {
      state = gameReducer(state, { type: "CLICK", value, elapsedMs: value * 160 });
    });
    expect(state).toMatchObject({
      status: "FINISHED",
      result: {
        kind: "practice",
        durationMs: 4_000,
        mistakeCount: 1,
        penaltyMs: 500,
        finalMs: 4_500,
      },
    });
  });

  it("100번째 입력 전에 완료하지 못하면 ERROR가 된다", () => {
    let state = playing("official");
    for (let count = 0; count < 100; count += 1) {
      state = gameReducer(state, { type: "CLICK", value: 2, elapsedMs: count });
    }
    expect(state).toMatchObject({
      status: "ERROR",
      error: { code: "RESULT_CLICK_LIMIT_EXCEEDED", retry: null },
    });
  });

  it("공식 server result를 FINISHED에 보관한다", () => {
    let state = playing("official");
    board.forEach((value) => {
      state = gameReducer(state, { type: "CLICK", value, elapsedMs: value * 160 });
    });
    const result = {
      record: {
        id: "00000000-0000-4000-8000-000000000002",
        durationMs: 4_000,
        mistakeCount: 0,
        penaltyMs: 0,
        finalMs: 4_000,
        achievedAt: "2026-09-06T00:00:05.000Z",
      },
      result: { isPersonalBest: true, previousPersonalBestMs: null },
      ranks: { today: 1, week: 1, all: 1 },
      points: {
        status: "AWARDED" as const,
        awarded: 10,
        balance: 10,
        dailyLimit: 50,
        policyVersion: "number-click-completion-v1",
      },
    };
    expect(gameReducer(state, { type: "OFFICIAL_RESULT", result })).toMatchObject({
      status: "FINISHED",
      result: { kind: "official", ...result },
    });
    expect(gameReducer(initialGameState, { type: "OFFICIAL_RESULT", result })).toBe(
      initialGameState,
    );
  });

  it("네트워크 retry가 동일 payload를 재사용한다", () => {
    let state = playing("official");
    board.forEach((value) => {
      state = gameReducer(state, { type: "CLICK", value, elapsedMs: value * 160 });
    });
    if (state.status !== "SUBMITTING") throw new Error("Expected submitting state");
    const payload = state.completionPayload;
    state = gameReducer(state, {
      type: "FAIL",
      preserveCompletion: true,
      error: { code: "NETWORK_ERROR", title: "오류", message: "재시도", retry: "complete" },
    });
    state = gameReducer(state, { type: "RETRY_COMPLETION" });
    expect(state.status).toBe("SUBMITTING");
    if (state.status === "SUBMITTING") expect(state.completionPayload).toBe(payload);
  });

  it("RESET이 board, events, timer를 초기화한다", () => {
    expect(gameReducer(playing(), { type: "RESET" })).toEqual({ status: "IDLE" });
  });

  it("start 오류 상태만 READY starting으로 복구한다", () => {
    const ready = gameReducer(initialGameState, { type: "BEGIN", mode: "official" });
    const withBoard = gameReducer(ready, {
      type: "BOARD_READY",
      board,
      sessionId: "00000000-0000-4000-8000-000000000001",
    });
    const failed = gameReducer(withBoard, {
      type: "FAIL",
      error: { code: "NETWORK_ERROR", title: "오류", message: "재시도", retry: "start" },
    });
    expect(gameReducer(failed, { type: "RESUME_START" })).toMatchObject({
      status: "READY",
      phase: "starting",
      board,
    });
    expect(gameReducer(initialGameState, { type: "RESUME_START" })).toBe(initialGameState);
  });

  it("완료 snapshot이 없는 오류는 completion retry를 무시한다", () => {
    const failed = gameReducer(initialGameState, {
      type: "FAIL",
      error: { code: "NETWORK_ERROR", title: "오류", message: "재시도", retry: "create" },
    });
    expect(gameReducer(failed, { type: "RETRY_COMPLETION" })).toBe(failed);
  });
});
