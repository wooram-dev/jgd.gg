import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { getNumberClickRanking } from "@/features/ranking/server/ranking-service";
import { getPageViewer } from "@/lib/auth/page-viewer";
import { getDatabase } from "@/lib/db/client";
import { hasServerEnv } from "@/lib/env/server";
import { formatScore } from "@/lib/time/format-score";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getPageViewer();
  let topFive: Awaited<ReturnType<typeof getNumberClickRanking>> = null;
  let rankingFailed = false;
  if (hasServerEnv()) {
    try {
      topFive = await getNumberClickRanking(getDatabase(), {
        period: "today",
        limit: 5,
        offset: 0,
        viewerId: null,
      });
    } catch (error) {
      rankingFailed = true;
      console.error(
        JSON.stringify({
          level: "error",
          event: "home.ranking_lookup_failed",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }

  return (
    <div className="home-page page-stack">
      <section className="home-intro">
        <p className="eyebrow">NUMBER CLICK</p>
        <h1>
          짧게 즐기고,
          <br />
          기록으로 경쟁하세요.
        </h1>
        <p>1부터 25까지. 빠르게, 정확하게, 그리고 한 번 더.</p>
        <div className="hero-actions">
          <Link className="button button-primary button-large" href="/games/number-click">
            숫자 게임 시작
          </Link>
          {!viewer ? (
            <Link className="button button-secondary" href="/login">
              Discord로 로그인
            </Link>
          ) : null}
        </div>
      </section>

      <section className="game-card">
        <div>
          <span className="game-index">01</span>
          <h2>숫자 순서대로 누르기</h2>
          <p>5×5 보드에서 1부터 25까지 순서대로 누르세요. 오클릭마다 0.50초가 추가됩니다.</p>
        </div>
        <Link href="/games/number-click">플레이</Link>
      </section>

      <section className="home-ranking">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TODAY</span>
            <h2>오늘 TOP 5</h2>
          </div>
          <Link href="/rankings/number-click">전체 랭킹</Link>
        </div>
        {rankingFailed ? (
          <div className="inline-error">
            오늘 랭킹을 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.
          </div>
        ) : topFive?.items.length ? (
          <ol className="top-list">
            {topFive.items.map((item) => (
              <li key={`${item.rank}-${item.achievedAt}`}>
                <span className="rank-number">{item.rank}</span>
                <Avatar name={item.displayName} src={item.avatarUrl} size={40} />
                <span className="player-name">{item.displayName}</span>
                <strong>{formatScore(item.finalMs)}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-card">
            <p>아직 오늘의 기록이 없습니다. 첫 기록의 주인공이 되어 보세요.</p>
          </div>
        )}
      </section>
    </div>
  );
}
