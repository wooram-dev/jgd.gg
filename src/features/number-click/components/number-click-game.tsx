"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";

import { SignInButton } from "@/components/ui/auth-button";
import { formatScore } from "@/lib/time/format-score";

import {
  ApiClientError,
  abandonOfficialSession,
  completeOfficialSession,
  createOfficialSession,
  startOfficialSession,
} from "../client/api-client";
import { gameReducer, initialGameState, type GameMode, type UiError } from "../client/game-reducer";
import { createPracticeBoard } from "../client/practice-board";
import { NUMBER_CLICK_RULES } from "../domain/rules";

type SummaryRecord = {
  finalMs: number;
  mistakeCount: number;
};

type NumberClickGameProps = {
  authenticated: boolean;
  officialEligible: boolean;
  personalBest: SummaryRecord | null;
  todayBest: (SummaryRecord & { displayName: string }) | null;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function readHighResolutionTime(): number {
  return performance.now();
}

function toUiError(error: unknown, retry: UiError["retry"]): UiError {
  if (error instanceof ApiClientError) {
    const retryable = error.status >= 500 || error.code === "INVALID_RESPONSE";
    return {
      code: error.code,
      title: retryable ? "연결을 확인해 주세요" : "기록을 저장하지 못했습니다",
      message: error.message,
      requestId: error.requestId,
      retry: retryable ? retry : null,
    };
  }
  return {
    code: "NETWORK_ERROR",
    title: "연결을 확인해 주세요",
    message: "네트워크 연결 뒤 다시 시도해 주세요.",
    retry,
  };
}

export function NumberClickGame({
  authenticated,
  officialEligible,
  personalBest,
  todayBest,
}: NumberClickGameProps) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [wrongValue, setWrongValue] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);
  const [slowStart, setSlowStart] = useState(false);
  const pendingCreateKey = useRef<string | null>(null);
  const inFlightCompletion = useRef<string | null>(null);
  const activeOperation = useRef(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const errorHeading = useRef<HTMLHeadingElement>(null);

  const startedPerformanceMs = state.status === "PLAYING" ? state.startedPerformanceMs : null;

  useEffect(() => {
    if (startedPerformanceMs === null) return;

    let frame = 0;
    let lastShownCentisecond = -1;
    const update = () => {
      const elapsedMs = Math.max(0, Math.round(readHighResolutionTime() - startedPerformanceMs));
      const centisecond = Math.floor(elapsedMs / 10);
      if (centisecond !== lastShownCentisecond) {
        lastShownCentisecond = centisecond;
        dispatch({ type: "TICK", elapsedMs });
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [startedPerformanceMs]);

  useEffect(() => {
    if (state.status === "FINISHED") resultHeading.current?.focus();
    if (state.status === "ERROR") errorHeading.current?.focus();
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "SUBMITTING" || !state.sessionId) return;
    const key = `${state.sessionId}:${state.completionPayload.clientElapsedMs}`;
    if (inFlightCompletion.current === key) return;
    inFlightCompletion.current = key;

    void completeOfficialSession(state.sessionId, state.completionPayload)
      .then((result) => dispatch({ type: "OFFICIAL_RESULT", result }))
      .catch((error: unknown) => {
        dispatch({ type: "FAIL", error: toUiError(error, "complete"), preserveCompletion: true });
      });
  }, [state]);

  async function runCountdown(operation: number): Promise<boolean> {
    await wait(500);
    if (activeOperation.current !== operation) return false;
    dispatch({ type: "COUNTDOWN", value: 2 });
    await wait(500);
    if (activeOperation.current !== operation) return false;
    dispatch({ type: "COUNTDOWN", value: 1 });
    await wait(500);
    return activeOperation.current === operation;
  }

  async function confirmOfficialStart(
    sessionId: string,
    resume = false,
    operation = ++activeOperation.current,
  ): Promise<void> {
    if (resume) dispatch({ type: "RESUME_START" });
    else dispatch({ type: "STARTING" });
    setSlowStart(false);
    const slowTimer = window.setTimeout(() => setSlowStart(true), 1_000);
    try {
      await startOfficialSession(sessionId);
      if (activeOperation.current !== operation) return;
      window.clearTimeout(slowTimer);
      setSlowStart(false);
      const startedPerformanceMs = readHighResolutionTime();
      setShowGo(true);
      dispatch({ type: "PLAY", startedPerformanceMs });
      window.setTimeout(() => setShowGo(false), 300);
    } catch (error) {
      window.clearTimeout(slowTimer);
      setSlowStart(false);
      if (activeOperation.current === operation) {
        dispatch({ type: "FAIL", error: toUiError(error, "start") });
      }
    }
  }

  async function startGame(mode: GameMode, reuseKey = false): Promise<void> {
    const operation = ++activeOperation.current;
    dispatch({ type: "BEGIN", mode });
    inFlightCompletion.current = null;

    if (mode === "practice") {
      try {
        const board = createPracticeBoard();
        dispatch({ type: "BOARD_READY", board, sessionId: null });
        if (!(await runCountdown(operation))) return;
        const startedPerformanceMs = readHighResolutionTime();
        setShowGo(true);
        dispatch({ type: "PLAY", startedPerformanceMs });
        window.setTimeout(() => setShowGo(false), 300);
      } catch {
        dispatch({
          type: "FAIL",
          error: {
            code: "CRYPTO_UNAVAILABLE",
            title: "이 브라우저에서는 게임을 시작할 수 없습니다",
            message: "최신 브라우저에서 다시 시도해 주세요.",
            retry: null,
          },
        });
      }
      return;
    }

    const idempotencyKey =
      reuseKey && pendingCreateKey.current ? pendingCreateKey.current : crypto.randomUUID();
    pendingCreateKey.current = idempotencyKey;
    try {
      const response = await createOfficialSession(idempotencyKey);
      if (activeOperation.current !== operation) {
        await Promise.allSettled([abandonOfficialSession(response.data.session.id)]);
        return;
      }
      if (response.data.session.status !== "READY") {
        throw new ApiClientError(409, "SESSION_NOT_STARTABLE", "새 게임을 시작해 주세요.");
      }
      dispatch({
        type: "BOARD_READY",
        board: response.data.board,
        sessionId: response.data.session.id,
      });
      if (!(await runCountdown(operation))) return;
      await confirmOfficialStart(response.data.session.id, false, operation);
      pendingCreateKey.current = null;
    } catch (error) {
      if (activeOperation.current === operation) {
        dispatch({ type: "FAIL", error: toUiError(error, "create") });
      }
    }
  }

  function handleCellClick(value: number): void {
    if (state.status !== "PLAYING") return;
    const elapsedMs = Math.max(
      0,
      Math.round(readHighResolutionTime() - state.startedPerformanceMs),
    );
    const correct = value === state.nextExpected;
    const finishes = correct && value === NUMBER_CLICK_RULES.maxNumber;
    const reachesLimit =
      state.events.length + 1 >= NUMBER_CLICK_RULES.maximumClickCount && !finishes;

    if (!correct) {
      setWrongValue(value);
      window.setTimeout(
        () => setWrongValue((current) => (current === value ? null : current)),
        120,
      );
    }
    dispatch({ type: "CLICK", value, elapsedMs });

    if (reachesLimit && state.sessionId) {
      void Promise.allSettled([abandonOfficialSession(state.sessionId)]);
    }
  }

  async function stopGame(): Promise<void> {
    activeOperation.current += 1;
    if (state.status !== "IDLE" && state.sessionId) {
      await Promise.allSettled([abandonOfficialSession(state.sessionId)]);
    }
    dispatch({ type: "RESET" });
  }

  const board = state.status === "IDLE" ? [] : (state.board ?? []);
  const timerMs = state.status === "PLAYING" ? state.currentElapsedMs : 0;
  const mistakeCount = state.status === "IDLE" ? 0 : (state.mistakeCount ?? 0);
  const nextExpected = state.status === "PLAYING" ? state.nextExpected : 1;
  const boardLocked = state.status !== "PLAYING";

  return (
    <section className="game-shell" aria-label="숫자 순서대로 누르기 게임">
      <div className="record-context">
        <div>
          <span>내 최고</span>
          <strong>{personalBest ? formatScore(personalBest.finalMs) : "아직 없음"}</strong>
        </div>
        <div>
          <span>오늘 최고</span>
          <strong>{todayBest ? formatScore(todayBest.finalMs) : "첫 기록을 기다려요"}</strong>
          {todayBest ? <small>{todayBest.displayName}</small> : null}
        </div>
      </div>

      <div
        className="game-status"
        aria-busy={state.status === "READY" || state.status === "SUBMITTING"}
      >
        {state.status === "IDLE" ? (
          <p>준비되면 바로 시작하세요.</p>
        ) : state.status === "READY" ? (
          <p>
            {state.phase === "preparing"
              ? "게임 준비 중…"
              : state.phase === "countdown"
                ? state.countdown
                : slowStart
                  ? "게임 시작 확인 중…"
                  : "시작 확인 중…"}
          </p>
        ) : state.status === "PLAYING" ? (
          <div className="play-status">
            <p>
              다음 숫자 <strong>{nextExpected}</strong>
            </p>
            <output className="timer" aria-label={`경과 시간 ${formatScore(timerMs)}`}>
              {formatScore(timerMs)}
            </output>
            <p className="mistakes">오클릭 {mistakeCount}회</p>
          </div>
        ) : state.status === "SUBMITTING" ? (
          <p>기록 확인 중…</p>
        ) : null}
      </div>

      <div className="board-wrap">
        {showGo ? <span className="go-indicator">GO</span> : null}
        <div className="number-board" aria-label="1부터 25까지 숫자 보드">
          {(board.length === 25 ? board : Array.from({ length: 25 }, () => null)).map(
            (value, index) => {
              const completed =
                value !== null &&
                state.status !== "IDLE" &&
                (state.completedValues ?? []).includes(value);
              return value === null ? (
                <span className="number-cell placeholder" key={index} aria-hidden="true" />
              ) : (
                <button
                  className={`number-cell${completed ? " completed" : ""}${wrongValue === value ? " wrong" : ""}`}
                  type="button"
                  key={value}
                  disabled={boardLocked}
                  onClick={() => handleCellClick(value)}
                  aria-label={completed ? `숫자 ${value}, 완료됨` : `숫자 ${value}`}
                >
                  <span>{value}</span>
                  {completed ? (
                    <span className="check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            },
          )}
        </div>
      </div>

      {state.status === "IDLE" ? (
        <div className="game-actions">
          <button
            className="button button-primary button-large"
            type="button"
            onClick={() => void startGame(officialEligible ? "official" : "practice")}
          >
            {officialEligible ? "게임 시작" : "연습 시작"}
          </button>
          {!officialEligible ? <p>연습 기록은 랭킹에 저장되지 않습니다.</p> : null}
        </div>
      ) : null}

      {state.status === "READY" || state.status === "PLAYING" ? (
        <button className="button button-secondary" type="button" onClick={() => void stopGame()}>
          {state.status === "READY" ? "취소" : "중단"}
        </button>
      ) : null}

      {state.status === "FINISHED" ? (
        <div className="result-card" aria-live="polite">
          <h2 ref={resultHeading} tabIndex={-1}>
            {formatScore(
              state.result.kind === "practice" ? state.result.finalMs : state.result.record.finalMs,
            )}
          </h2>
          {state.result.kind === "practice" ? (
            <>
              <span className="badge badge-practice">연습 기록</span>
              <p>이 기록은 저장되지 않았습니다.</p>
              <ResultEquation
                durationMs={state.result.durationMs}
                mistakeCount={state.result.mistakeCount}
                penaltyMs={state.result.penaltyMs}
              />
              {!authenticated ? (
                <>
                  <SignInButton callbackURL="/games/number-click" />
                  <small>로그인 후에는 새 공식 게임으로 도전하게 됩니다.</small>
                </>
              ) : (
                <small>이 계정은 연습 플레이만 이용할 수 있습니다.</small>
              )}
            </>
          ) : (
            <>
              {state.result.result.isPersonalBest ? (
                <span className="badge badge-best">새 개인 최고!</span>
              ) : null}
              <ResultEquation
                durationMs={state.result.record.durationMs}
                mistakeCount={state.result.record.mistakeCount}
                penaltyMs={state.result.record.penaltyMs}
              />
              <div className="rank-summary">
                <span>오늘 {state.result.ranks.today ? `${state.result.ranks.today}위` : "—"}</span>
                <span>
                  이번 주 {state.result.ranks.week ? `${state.result.ranks.week}위` : "—"}
                </span>
                <span>전체 {state.result.ranks.all ? `${state.result.ranks.all}위` : "—"}</span>
              </div>
            </>
          )}
          <div className="result-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => void startGame(officialEligible ? "official" : "practice")}
            >
              다시 하기
            </button>
            <Link className="button button-secondary" href="/rankings/number-click">
              랭킹 보기
            </Link>
          </div>
        </div>
      ) : null}

      {state.status === "ERROR" ? (
        <div className="error-card" aria-live="assertive">
          <h2 ref={errorHeading} tabIndex={-1}>
            {state.error.title}
          </h2>
          <p>{state.error.message}</p>
          {state.error.requestId ? <small>문의 코드: {state.error.requestId}</small> : null}
          <div className="result-actions">
            {state.error.retry === "complete" ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  inFlightCompletion.current = null;
                  dispatch({ type: "RETRY_COMPLETION" });
                }}
              >
                기록 다시 전송
              </button>
            ) : null}
            {state.error.retry === "create" ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() => void startGame("official", true)}
              >
                준비 다시 시도
              </button>
            ) : null}
            {state.error.retry === "start" && state.sessionId ? (
              <RetryStartButton sessionId={state.sessionId} onRetry={confirmOfficialStart} />
            ) : null}
            <button
              className={state.error.retry ? "button button-secondary" : "button button-primary"}
              type="button"
              onClick={() => void startGame(officialEligible ? "official" : "practice")}
            >
              새 게임 시작
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RetryStartButton({
  sessionId,
  onRetry,
}: {
  sessionId: string;
  onRetry: (sessionId: string, resume: boolean) => Promise<void>;
}) {
  return (
    <button
      className="button button-primary"
      type="button"
      onClick={() => void onRetry(sessionId, true)}
    >
      시작 확인 다시 시도
    </button>
  );
}

function ResultEquation({
  durationMs,
  mistakeCount,
  penaltyMs,
}: {
  durationMs: number;
  mistakeCount: number;
  penaltyMs: number;
}) {
  return (
    <p className="result-equation">
      실제 {formatScore(durationMs)} + 오클릭 {mistakeCount}회 × 0.50초 = 페널티{" "}
      {formatScore(penaltyMs)}
    </p>
  );
}
