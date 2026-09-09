import type { NumberClickRulesSnapshot } from "./rules";

export type ClickEvent = {
  value: number;
  elapsedMs: number;
};

export type ReplayErrorCode =
  | "RESULT_RULES_UNSUPPORTED"
  | "RESULT_BOARD_INVALID"
  | "RESULT_EVENT_ORDER_INVALID"
  | "RESULT_INCOMPLETE"
  | "RESULT_CLICK_LIMIT_EXCEEDED"
  | "RESULT_TOO_FAST"
  | "RESULT_TOO_LONG";

export type ReplaySuccess = {
  ok: true;
  durationMs: number;
  mistakeCount: number;
  penaltyMs: number;
  finalMs: number;
  clickCount: number;
};

export type ReplayFailure = {
  ok: false;
  code: ReplayErrorCode;
};

export type ReplayResult = ReplaySuccess | ReplayFailure;

export function calculatePenaltyMs(mistakeCount: number, penaltyPerMistakeMs: number): number {
  if (!Number.isSafeInteger(mistakeCount) || mistakeCount < 0) {
    throw new RangeError("Mistake count must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(penaltyPerMistakeMs) || penaltyPerMistakeMs < 0) {
    throw new RangeError("Penalty must be a non-negative safe integer.");
  }

  const penaltyMs = mistakeCount * penaltyPerMistakeMs;
  if (!Number.isSafeInteger(penaltyMs)) {
    throw new RangeError("Penalty exceeds the safe integer range.");
  }
  return penaltyMs;
}

export function calculateFinalMs(durationMs: number, penaltyMs: number): number {
  if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
    throw new RangeError("Duration must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(penaltyMs) || penaltyMs < 0) {
    throw new RangeError("Penalty must be a non-negative safe integer.");
  }

  const finalMs = durationMs + penaltyMs;
  if (!Number.isSafeInteger(finalMs)) {
    throw new RangeError("Final score exceeds the safe integer range.");
  }
  return finalMs;
}

function isSupportedRules(rules: NumberClickRulesSnapshot): boolean {
  return (
    rules.version === 1 &&
    rules.boardSize === 5 &&
    rules.maxNumber === 25 &&
    rules.penaltyPerMistakeMs === 500 &&
    rules.minimumDurationMs === 3_000 &&
    rules.maximumDurationMs === 300_000 &&
    rules.maximumClickCount === 100
  );
}

function isValidBoard(board: readonly number[], maxNumber: number): boolean {
  return (
    board.length === maxNumber &&
    new Set(board).size === maxNumber &&
    board.every((value) => Number.isInteger(value) && value >= 1 && value <= maxNumber)
  );
}

export function replayNumberClick(input: {
  board: readonly number[];
  rules: NumberClickRulesSnapshot;
  clientElapsedMs: number;
  events: readonly ClickEvent[];
}): ReplayResult {
  const { board, rules, clientElapsedMs, events } = input;

  if (!isSupportedRules(rules)) {
    return { ok: false, code: "RESULT_RULES_UNSUPPORTED" };
  }
  if (!isValidBoard(board, rules.maxNumber)) {
    return { ok: false, code: "RESULT_BOARD_INVALID" };
  }
  if (!Number.isSafeInteger(clientElapsedMs) || clientElapsedMs < 0 || clientElapsedMs > 600_000) {
    return { ok: false, code: "RESULT_EVENT_ORDER_INVALID" };
  }
  if (events.length < rules.maxNumber) {
    return { ok: false, code: "RESULT_INCOMPLETE" };
  }
  if (events.length > rules.maximumClickCount) {
    return { ok: false, code: "RESULT_CLICK_LIMIT_EXCEEDED" };
  }

  let previousElapsedMs = 0;
  let nextExpected = 1;
  let mistakeCount = 0;

  for (const event of events) {
    const validEvent =
      Number.isSafeInteger(event.value) &&
      event.value >= 1 &&
      event.value <= rules.maxNumber &&
      Number.isSafeInteger(event.elapsedMs) &&
      event.elapsedMs >= 0 &&
      event.elapsedMs <= clientElapsedMs;

    if (!validEvent) {
      return { ok: false, code: "RESULT_EVENT_ORDER_INVALID" };
    }
    if (!board.includes(event.value)) {
      return { ok: false, code: "RESULT_BOARD_INVALID" };
    }
    if (event.elapsedMs < previousElapsedMs) {
      return { ok: false, code: "RESULT_EVENT_ORDER_INVALID" };
    }

    previousElapsedMs = event.elapsedMs;
    if (event.value === nextExpected) {
      nextExpected += 1;
    } else {
      mistakeCount += 1;
    }
  }

  const lastEvent = events.at(-1);
  if (nextExpected !== rules.maxNumber + 1) {
    return { ok: false, code: "RESULT_INCOMPLETE" };
  }
  if (
    lastEvent === undefined ||
    lastEvent.value !== rules.maxNumber ||
    lastEvent.elapsedMs !== clientElapsedMs
  ) {
    return { ok: false, code: "RESULT_EVENT_ORDER_INVALID" };
  }
  if (mistakeCount > rules.maximumClickCount - rules.maxNumber) {
    return { ok: false, code: "RESULT_CLICK_LIMIT_EXCEEDED" };
  }
  if (clientElapsedMs < rules.minimumDurationMs) {
    return { ok: false, code: "RESULT_TOO_FAST" };
  }
  if (clientElapsedMs > rules.maximumDurationMs) {
    return { ok: false, code: "RESULT_TOO_LONG" };
  }

  const penaltyMs = calculatePenaltyMs(mistakeCount, rules.penaltyPerMistakeMs);
  const finalMs = calculateFinalMs(clientElapsedMs, penaltyMs);

  return {
    ok: true,
    durationMs: clientElapsedMs,
    mistakeCount,
    penaltyMs,
    finalMs,
    clickCount: events.length,
  };
}
