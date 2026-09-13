import { calculateFinalMs, calculatePenaltyMs, type ClickEvent } from "../domain/replay";
import { NUMBER_CLICK_RULES } from "../domain/rules";

export type GameMode = "practice" | "official";

export type OfficialResult = {
  record: {
    id: string;
    durationMs: number;
    mistakeCount: number;
    penaltyMs: number;
    finalMs: number;
    achievedAt: string;
  };
  result: {
    isPersonalBest: boolean;
    previousPersonalBestMs: number | null;
  };
  ranks: {
    today: number | null;
    week: number | null;
    all: number | null;
  };
  points: {
    status: "AWARDED" | "DAILY_LIMIT_REACHED" | "NOT_ELIGIBLE" | "REVERSED";
    awarded: number;
    balance: number;
    dailyLimit: number;
    policyVersion: string;
  };
};

export type FinishedResult =
  | {
      kind: "practice";
      durationMs: number;
      mistakeCount: number;
      penaltyMs: number;
      finalMs: number;
    }
  | ({ kind: "official" } & OfficialResult);

type ActiveGame = {
  mode: GameMode;
  sessionId: string | null;
  board: number[];
  nextExpected: number;
  completedValues: number[];
  events: ClickEvent[];
  mistakeCount: number;
};

export type CompletionPayload = {
  clientElapsedMs: number;
  events: ClickEvent[];
};

export type UiError = {
  code: string;
  title: string;
  message: string;
  requestId?: string;
  retry: "create" | "start" | "complete" | null;
};

export type GameState =
  | { status: "IDLE" }
  | ({
      status: "READY";
      phase: "preparing" | "countdown" | "starting";
      countdown: number | null;
    } & ActiveGame)
  | ({ status: "PLAYING"; startedPerformanceMs: number; currentElapsedMs: number } & ActiveGame)
  | ({ status: "SUBMITTING"; completionPayload: CompletionPayload } & ActiveGame)
  | ({ status: "FINISHED"; result: FinishedResult } & ActiveGame)
  | ({
      status: "ERROR";
      error: UiError;
      completionPayload: CompletionPayload | null;
    } & Partial<ActiveGame>);

export type GameAction =
  | { type: "BEGIN"; mode: GameMode }
  | { type: "BOARD_READY"; board: number[]; sessionId: string | null }
  | { type: "COUNTDOWN"; value: number }
  | { type: "STARTING" }
  | { type: "RESUME_START" }
  | { type: "PLAY"; startedPerformanceMs: number }
  | { type: "TICK"; elapsedMs: number }
  | { type: "CLICK"; value: number; elapsedMs: number }
  | { type: "OFFICIAL_RESULT"; result: OfficialResult }
  | { type: "FAIL"; error: UiError; preserveCompletion?: boolean }
  | { type: "RETRY_COMPLETION" }
  | { type: "RESET" };

export const initialGameState: GameState = { status: "IDLE" };

function emptyActiveGame(mode: GameMode): ActiveGame {
  return {
    mode,
    sessionId: null,
    board: [],
    nextExpected: 1,
    completedValues: [],
    events: [],
    mistakeCount: 0,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "BEGIN":
      return {
        status: "READY",
        phase: "preparing",
        countdown: null,
        ...emptyActiveGame(action.mode),
      };
    case "BOARD_READY":
      if (state.status !== "READY") return state;
      return {
        ...state,
        phase: "countdown",
        countdown: 3,
        board: [...action.board],
        sessionId: action.sessionId,
      };
    case "COUNTDOWN":
      if (state.status !== "READY" || state.phase !== "countdown") return state;
      return { ...state, countdown: action.value };
    case "STARTING":
      if (state.status !== "READY") return state;
      return { ...state, phase: "starting", countdown: null };
    case "RESUME_START":
      if (state.status !== "ERROR" || !state.board || !state.mode) return state;
      return {
        status: "READY",
        phase: "starting",
        countdown: null,
        mode: state.mode,
        sessionId: state.sessionId ?? null,
        board: state.board,
        nextExpected: state.nextExpected ?? 1,
        completedValues: state.completedValues ?? [],
        events: state.events ?? [],
        mistakeCount: state.mistakeCount ?? 0,
      };
    case "PLAY":
      if (state.status !== "READY" || state.board.length !== NUMBER_CLICK_RULES.maxNumber)
        return state;
      return {
        status: "PLAYING",
        mode: state.mode,
        sessionId: state.sessionId,
        board: state.board,
        nextExpected: 1,
        completedValues: [],
        events: [],
        mistakeCount: 0,
        startedPerformanceMs: action.startedPerformanceMs,
        currentElapsedMs: 0,
      };
    case "TICK":
      if (state.status !== "PLAYING") return state;
      return { ...state, currentElapsedMs: action.elapsedMs };
    case "CLICK": {
      if (state.status !== "PLAYING") return state;

      const event = { value: action.value, elapsedMs: action.elapsedMs };
      const events = [...state.events, event];
      const correct = action.value === state.nextExpected;
      const isFinal = correct && action.value === NUMBER_CLICK_RULES.maxNumber;

      if (!isFinal && events.length >= NUMBER_CLICK_RULES.maximumClickCount) {
        return {
          status: "ERROR",
          mode: state.mode,
          sessionId: state.sessionId,
          board: state.board,
          nextExpected: state.nextExpected,
          completedValues: state.completedValues,
          events,
          mistakeCount: state.mistakeCount + (correct ? 0 : 1),
          completionPayload: null,
          error: {
            code: "RESULT_CLICK_LIMIT_EXCEEDED",
            title: "입력 횟수를 모두 사용했습니다",
            message: "새 게임에서 다시 도전해 주세요.",
            retry: null,
          },
        };
      }

      if (!correct) {
        return {
          ...state,
          events,
          mistakeCount: state.mistakeCount + 1,
          currentElapsedMs: action.elapsedMs,
        };
      }

      const completedValues = [...state.completedValues, action.value];
      if (!isFinal) {
        return {
          ...state,
          events,
          completedValues,
          nextExpected: state.nextExpected + 1,
          currentElapsedMs: action.elapsedMs,
        };
      }

      if (state.mode === "practice") {
        const penaltyMs = calculatePenaltyMs(
          state.mistakeCount,
          NUMBER_CLICK_RULES.penaltyPerMistakeMs,
        );
        return {
          ...state,
          status: "FINISHED",
          events,
          completedValues,
          nextExpected: 26,
          result: {
            kind: "practice",
            durationMs: action.elapsedMs,
            mistakeCount: state.mistakeCount,
            penaltyMs,
            finalMs: calculateFinalMs(action.elapsedMs, penaltyMs),
          },
        };
      }

      return {
        status: "SUBMITTING",
        mode: state.mode,
        sessionId: state.sessionId,
        board: state.board,
        nextExpected: 26,
        completedValues,
        events,
        mistakeCount: state.mistakeCount,
        completionPayload: { clientElapsedMs: action.elapsedMs, events },
      };
    }
    case "OFFICIAL_RESULT":
      if (state.status !== "SUBMITTING") return state;
      return { ...state, status: "FINISHED", result: { kind: "official", ...action.result } };
    case "FAIL": {
      const completionPayload =
        action.preserveCompletion && state.status === "SUBMITTING" ? state.completionPayload : null;
      const active = state.status === "IDLE" ? {} : state;
      return { ...active, status: "ERROR", error: action.error, completionPayload };
    }
    case "RETRY_COMPLETION":
      if (state.status !== "ERROR" || !state.completionPayload || !state.sessionId) return state;
      return {
        status: "SUBMITTING",
        mode: state.mode ?? "official",
        sessionId: state.sessionId,
        board: state.board ?? [],
        nextExpected: state.nextExpected ?? 26,
        completedValues: state.completedValues ?? [],
        events: state.events ?? state.completionPayload.events,
        mistakeCount: state.mistakeCount ?? 0,
        completionPayload: state.completionPayload,
      };
    case "RESET":
      return initialGameState;
  }
}
