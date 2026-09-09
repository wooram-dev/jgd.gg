"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { formatScore } from "@/lib/time/format-score";
import { rankingResponseSchema, type RankingData } from "@/features/ranking/schemas/response";

type PeriodKey = RankingData["period"]["key"];

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "all", label: "전체" },
];

export function RankingView({
  initialData,
  initialLoadFailed = false,
}: {
  initialData: RankingData | null;
  initialLoadFailed?: boolean;
}) {
  const [period, setPeriod] = useState<PeriodKey>(initialData?.period.key ?? "today");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialLoadFailed ? "랭킹을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요." : null,
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  async function selectPeriod(nextPeriod: PeriodKey): Promise<void> {
    if (nextPeriod === period && data) return;
    setPeriod(nextPeriod);
    setLoading(true);
    setError(null);
    window.history.replaceState(null, "", `/rankings/number-click?period=${nextPeriod}`);
    try {
      const response = await fetch(
        `/api/v1/games/number-click/rankings?period=${nextPeriod}&limit=100&offset=0`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("RANKING_LOAD_FAILED");
      const body: unknown = await response.json();
      const parsed = rankingResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error("RANKING_RESPONSE_INVALID");
      }
      setData(parsed.data.data);
    } catch {
      setError("랭킹을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  function moveTab(currentIndex: number, offset: number): void {
    const nextIndex = (currentIndex + offset + PERIODS.length) % PERIODS.length;
    tabRefs.current[nextIndex]?.focus();
    void selectPeriod(PERIODS[nextIndex].key);
  }

  const viewerOutsideItems =
    data?.viewer && !data.items.some((item) => item.isViewer) ? data.viewer : null;

  return (
    <section className="ranking-panel">
      <div className="ranking-tabs" role="tablist" aria-label="랭킹 기간">
        {PERIODS.map((item, index) => (
          <button
            key={item.key}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            aria-selected={period === item.key}
            tabIndex={period === item.key ? 0 : -1}
            onClick={() => void selectPeriod(item.key)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") moveTab(index, 1);
              if (event.key === "ArrowLeft") moveTab(index, -1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="ranking-zone">Asia/Seoul 기준 · 사용자별 최고 기록</p>
      {loading ? (
        <div className="ranking-progress" role="status">
          새 랭킹을 불러오는 중…
        </div>
      ) : null}
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">플레이어</th>
                <th scope="col">최종 기록</th>
                <th scope="col">오클릭</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={`${data.period.key}-${item.rank}-${item.achievedAt}`}
                  className={item.isViewer ? "viewer-row" : undefined}
                >
                  <td className="rank-number">{item.rank}</td>
                  <td>
                    <span className="player-cell">
                      <Avatar name={item.displayName} src={item.avatarUrl} size={36} />
                      <span className="player-name" title={item.displayName}>
                        {item.displayName}
                      </span>
                      {item.isViewer ? <span className="badge badge-viewer">내 기록</span> : null}
                    </span>
                    <time dateTime={item.achievedAt}>
                      {new Date(item.achievedAt).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </time>
                  </td>
                  <td className="score-cell">{formatScore(item.finalMs)}</td>
                  <td>{item.mistakeCount}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-card">
          <p>아직 이 기간의 기록이 없습니다. 첫 기록에 도전해 보세요.</p>
          <Link className="button button-primary" href="/games/number-click">
            게임 시작
          </Link>
        </div>
      )}

      {viewerOutsideItems ? (
        <div className="viewer-rank-card">
          <span>내 순위</span>
          <strong>{viewerOutsideItems.rank}위</strong>
          <span>{formatScore(viewerOutsideItems.finalMs)}</span>
        </div>
      ) : null}
      {data && !data.viewer ? (
        <div className="ranking-cta">
          <p>공식 기록을 남겨 순위에 참여하세요.</p>
          <Link href="/games/number-click">도전하기</Link>
        </div>
      ) : null}
    </section>
  );
}
