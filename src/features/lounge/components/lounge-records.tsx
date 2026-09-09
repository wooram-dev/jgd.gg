"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { rankingResponseSchema, type RankingData } from "@/features/ranking/schemas/response";
import { formatScore } from "@/lib/time/format-score";

export function LoungeRecords({
  initialData,
  initialState,
}: {
  initialData: RankingData | null;
  initialState: "ready" | "error" | "unavailable";
}) {
  const [data, setData] = useState(initialData);
  const [state, setState] = useState<"ready" | "error" | "unavailable" | "loading">(initialState);

  async function refresh() {
    setState("loading");
    try {
      const response = await fetch(
        "/api/v1/games/number-click/rankings?period=today&limit=5&offset=0",
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("RANKING_LOAD_FAILED");
      const parsed = rankingResponseSchema.parse(await response.json());
      setData(parsed.data);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="lounge-panel lounge-records" aria-labelledby="records-heading">
      <div className="panel-heading">
        <div className="heading-with-icon">
          <span className="icon-tile peach">
            <Icon name="trophy" />
          </span>
          <h2 id="records-heading">오늘의 기록</h2>
        </div>
        <Link className="subtle-link" href="/rankings/number-click">
          전체 보기 <Icon name="chevron" size={14} />
        </Link>
      </div>
      <p className="panel-description">오늘 도전한 사람들의 작은 성취를 만나보세요.</p>
      <div className="records-label">
        <span>NUMBER CLICK · TOP 5</span>
        <span>오늘 · KST</span>
      </div>
      {state === "error" || state === "unavailable" ? (
        <div className="lounge-empty">
          <Icon name="trophy" size={30} />
          <h3>
            {state === "error"
              ? "기록을 잠시 불러오지 못했어요"
              : "커뮤니티 기록을 연결하고 있어요"}
          </h3>
          <p>
            {state === "error"
              ? "다른 이야기를 둘러보거나 다시 시도해 주세요."
              : "지금은 오늘의 대화와 로그인 없는 연습을 즐겨보세요."}
          </p>
          <button className="text-button" type="button" onClick={() => void refresh()}>
            다시 불러오기 <Icon name="arrow" size={16} />
          </button>
        </div>
      ) : state === "loading" ? (
        <div className="lounge-empty" role="status">
          오늘의 기록을 불러오는 중…
        </div>
      ) : data?.items.length ? (
        <ol className="lounge-record-list">
          {data.items.map((item) => (
            <li
              key={`${item.rank}-${item.achievedAt}`}
              className={item.isViewer ? "viewer-row" : undefined}
            >
              <span className="rank-number">{String(item.rank).padStart(2, "0")}</span>
              <Avatar name={item.displayName} src={item.avatarUrl} size={36} />
              <div className="record-person">
                <span className="player-name" title={item.displayName}>
                  {item.displayName}
                  {item.isViewer ? " · 나" : ""}
                </span>
                <span>오클릭 {item.mistakeCount}회</span>
              </div>
              <strong>{formatScore(item.finalMs)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <div className="lounge-empty">
          <Icon name="spark" size={30} />
          <h3>오늘의 첫 기록은 누구일까요?</h3>
          <p>
            아직 오늘의 공식 기록이 없어요.
            <br />
            가벼운 한 판으로 첫 번째 이름을 남겨보세요.
          </p>
          <Link className="subtle-link" href="/games/number-click">
            첫 기록 남기기 <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}
      <div className="panel-footnote">한 사람당 가장 좋은 공식 기록만 표시해요.</div>
    </section>
  );
}
