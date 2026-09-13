"use client";

import { useEffect, useState } from "react";

import { pointOverviewResponseSchema, type PointOverviewData } from "../schemas/response";

type PointsPanelState =
  { status: "loading" } | { status: "ready"; data: PointOverviewData } | { status: "error" };

const reasonLabels = {
  NUMBER_CLICK_COMPLETION: "숫자 순서대로 누르기 공식 완료",
  GAME_RECORD_INVALIDATION: "공식 기록 무효화 회수",
} as const;

function formatPoints(value: number): string {
  return `${value.toLocaleString("ko-KR")} P`;
}

export function PointsPanel() {
  const [state, setState] = useState<PointsPanelState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/me/points", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Point request failed.");
        return pointOverviewResponseSchema.parse(await response.json()).data;
      })
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [requestVersion]);

  return (
    <section id="points" className="points-panel" aria-labelledby="points-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMMUNITY POINTS</p>
          <h2 id="points-heading">내 포인트</h2>
        </div>
        {state.status === "ready" ? (
          <strong className="points-balance">{formatPoints(state.data.balance)}</strong>
        ) : null}
      </div>
      <p className="points-description">
        공식 게임 참여로 쌓이는 커뮤니티 포인트입니다. 게임 점수와 랭킹에는 영향을 주지 않습니다.
      </p>

      {state.status === "loading" ? (
        <p className="points-state" role="status">
          포인트를 불러오는 중…
        </p>
      ) : state.status === "error" ? (
        <div className="points-state" role="alert">
          <p>포인트를 불러오지 못했습니다.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setRequestVersion((version) => version + 1);
            }}
          >
            다시 불러오기
          </button>
        </div>
      ) : state.data.transactions.length === 0 ? (
        <p className="points-state">아직 포인트 변동 내역이 없습니다.</p>
      ) : (
        <ol className="point-transactions" aria-label="최근 포인트 변동">
          {state.data.transactions.map((transaction) => (
            <li key={transaction.id}>
              <div>
                <strong>{reasonLabels[transaction.reason]}</strong>
                <time dateTime={transaction.createdAt}>
                  {new Date(transaction.createdAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </time>
              </div>
              <span className={transaction.amount > 0 ? "point-earned" : "point-reversed"}>
                {transaction.amount > 0 ? "+" : ""}
                {formatPoints(transaction.amount)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
