import { describe, expect, it } from "vitest";

import { NUMBER_CLICK_RULES_SNAPSHOT } from "./rules";
import { calculateFinalMs, calculatePenaltyMs, replayNumberClick, type ClickEvent } from "./replay";

const board = Array.from({ length: 25 }, (_, index) => index + 1);

function eventsEndingAt(durationMs: number): ClickEvent[] {
  return board.map((value, index) => ({
    value,
    elapsedMs: Math.round(((index + 1) / 25) * durationMs),
  }));
}

describe("score calculations", () => {
  it("오클릭당 500ms와 최종 기록을 계산한다", () => {
    expect(calculatePenaltyMs(2, 500)).toBe(1_000);
    expect(calculateFinalMs(14_200, 1_000)).toBe(15_200);
  });

  it.each([
    [-1, 500],
    [1.5, 500],
    [1, -1],
    [1, 0.5],
  ])("잘못된 penalty 입력 %s, %s를 거부한다", (mistakes, penalty) => {
    expect(() => calculatePenaltyMs(mistakes, penalty)).toThrow(RangeError);
  });

  it("safe integer를 넘는 penalty를 거부한다", () => {
    expect(() => calculatePenaltyMs(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });

  it.each([
    [-1, 0],
    [0.5, 0],
    [1, -1],
    [1, 0.5],
  ])("잘못된 final 입력 %s, %s를 거부한다", (duration, penalty) => {
    expect(() => calculateFinalMs(duration, penalty)).toThrow(RangeError);
  });

  it("safe integer를 넘는 final score를 거부한다", () => {
    expect(() => calculateFinalMs(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});

describe("replayNumberClick", () => {
  it("1부터 25까지 정상 기록을 재생한다", () => {
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: eventsEndingAt(4_000),
      }),
    ).toEqual({
      ok: true,
      durationMs: 4_000,
      mistakeCount: 0,
      penaltyMs: 0,
      finalMs: 4_000,
      clickCount: 25,
    });
  });

  it("오클릭과 완료 cell 재클릭에 각각 500ms를 더한다", () => {
    const events = eventsEndingAt(4_000);
    events.splice(1, 0, { value: 1, elapsedMs: 200 }, { value: 9, elapsedMs: 220 });
    const result = replayNumberClick({
      board,
      rules: NUMBER_CLICK_RULES_SNAPSHOT,
      clientElapsedMs: 4_000,
      events,
    });
    expect(result).toMatchObject({ ok: true, mistakeCount: 2, penaltyMs: 1_000, finalMs: 5_000 });
  });

  it.each([
    [2_999, "RESULT_TOO_FAST"],
    [300_001, "RESULT_TOO_LONG"],
  ] as const)("duration %i를 %s로 거부한다", (duration, code) => {
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: duration,
        events: eventsEndingAt(duration),
      }),
    ).toEqual({ ok: false, code });
  });

  it.each([3_000, 300_000])("경계 duration %i를 허용한다", (duration) => {
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: duration,
        events: eventsEndingAt(duration),
      }).ok,
    ).toBe(true);
  });

  it("25 미완료를 거부한다", () => {
    const events = eventsEndingAt(4_000).slice(0, 24);
    events.push({ value: 24, elapsedMs: 4_000 });
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events,
      }),
    ).toEqual({ ok: false, code: "RESULT_INCOMPLETE" });
  });

  it("25개보다 적은 event를 거부한다", () => {
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: eventsEndingAt(4_000).slice(0, 24),
      }),
    ).toEqual({ ok: false, code: "RESULT_INCOMPLETE" });
  });

  it("마지막 event가 correct 25가 아니면 거부한다", () => {
    const events = [...eventsEndingAt(4_000), { value: 1, elapsedMs: 4_000 }];
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events,
      }),
    ).toEqual({ ok: false, code: "RESULT_EVENT_ORDER_INVALID" });
  });

  it("elapsed 역행과 마지막 elapsed 불일치를 거부한다", () => {
    const reversed = eventsEndingAt(4_000);
    reversed[10] = { value: 11, elapsedMs: 1 };
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: reversed,
      }),
    ).toEqual({ ok: false, code: "RESULT_EVENT_ORDER_INVALID" });

    const mismatch = eventsEndingAt(4_000);
    mismatch[24] = { value: 25, elapsedMs: 3_999 };
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: mismatch,
      }),
    ).toEqual({ ok: false, code: "RESULT_EVENT_ORDER_INVALID" });
  });

  it("100번째 입력의 25 완료를 허용하고 100회 미완료는 거부한다", () => {
    const mistakes = Array.from({ length: 75 }, (_, index) => ({
      value: 25,
      elapsedMs: index + 1,
    }));
    const completedAtHundred = [...mistakes, ...eventsEndingAt(4_000)];
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: completedAtHundred,
      }),
    ).toMatchObject({ ok: true, clickCount: 100, mistakeCount: 75 });

    const incomplete = Array.from({ length: 100 }, (_, index) => ({
      value: 1,
      elapsedMs: index * 40,
    }));
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: incomplete,
      }),
    ).toEqual({ ok: false, code: "RESULT_INCOMPLETE" });
  });

  it.each([0, 26, 1.5])("board 밖 value %s를 거부한다", (invalidValue) => {
    const events = eventsEndingAt(4_000);
    events[0] = { value: invalidValue, elapsedMs: 100 };
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events,
      }),
    ).toEqual({ ok: false, code: "RESULT_EVENT_ORDER_INVALID" });
  });

  it.each([
    { version: 2 },
    { boardSize: 4 },
    { maxNumber: 24 },
    { penaltyPerMistakeMs: 501 },
    { minimumDurationMs: 2_999 },
    { maximumDurationMs: 300_001 },
    { maximumClickCount: 99 },
  ])("지원하지 않는 rules snapshot을 거부한다", (override) => {
    expect(
      replayNumberClick({
        board,
        rules: { ...NUMBER_CLICK_RULES_SNAPSHOT, ...override },
        clientElapsedMs: 4_000,
        events: eventsEndingAt(4_000),
      }),
    ).toEqual({ ok: false, code: "RESULT_RULES_UNSUPPORTED" });
  });

  it.each([
    [board.slice(0, 24)],
    [[...board.slice(0, 24), 24]],
    [[...board.slice(0, 24), 25.5]],
    [[...board.slice(0, 24), 26]],
  ])("유효하지 않은 board를 거부한다", (invalidBoard) => {
    expect(
      replayNumberClick({
        board: invalidBoard,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: eventsEndingAt(4_000),
      }),
    ).toEqual({ ok: false, code: "RESULT_BOARD_INVALID" });
  });

  it.each([-1, 0.5, 600_001, Number.MAX_SAFE_INTEGER + 1])(
    "잘못된 clientElapsedMs %s를 거부한다",
    (clientElapsedMs) => {
      expect(
        replayNumberClick({
          board,
          rules: NUMBER_CLICK_RULES_SNAPSHOT,
          clientElapsedMs,
          events: eventsEndingAt(4_000),
        }),
      ).toEqual({ ok: false, code: "RESULT_EVENT_ORDER_INVALID" });
    },
  );

  it("100개를 초과한 event를 거부한다", () => {
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events: Array.from({ length: 101 }, (_, index) => ({ value: 1, elapsedMs: index })),
      }),
    ).toEqual({ ok: false, code: "RESULT_CLICK_LIMIT_EXCEEDED" });
  });

  it.each([
    { value: 1, elapsedMs: -1 },
    { value: 1, elapsedMs: 1.5 },
    { value: 1, elapsedMs: 4_001 },
  ])("잘못된 event 시간을 거부한다", (invalidEvent) => {
    const events = eventsEndingAt(4_000);
    events[0] = invalidEvent;
    expect(
      replayNumberClick({
        board,
        rules: NUMBER_CLICK_RULES_SNAPSHOT,
        clientElapsedMs: 4_000,
        events,
      }),
    ).toEqual({ ok: false, code: "RESULT_EVENT_ORDER_INVALID" });
  });
});
