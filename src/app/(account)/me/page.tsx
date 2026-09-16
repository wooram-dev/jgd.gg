import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { GameProfilePanel } from "@/features/game-profiles/components/game-profile-panel";
import { getNumberClickStats } from "@/features/number-click/server/stats-service";
import { PointsPanel } from "@/features/points/components/points-panel";
import { getPageViewer } from "@/lib/auth/page-viewer";
import { getDatabase } from "@/lib/db/client";
import { formatScore } from "@/lib/time/format-score";

export const dynamic = "force-dynamic";

export default async function MyInfoPage() {
  const viewer = await getPageViewer();
  if (!viewer) redirect(`/login?returnTo=${encodeURIComponent("/내정보")}`);
  const stats = await getNumberClickStats(getDatabase(), { userId: viewer.id });

  return (
    <div className="page-stack narrow-page">
      <header className="profile-heading">
        <Avatar name={viewer.displayName} src={viewer.image} size={64} />
        <div>
          <p className="eyebrow">MY RECORDS</p>
          <h1>{viewer.displayName}</h1>
        </div>
      </header>
      <GameProfilePanel />
      <PointsPanel />
      <section className="stats-grid">
        <StatCard
          label="전체 최고"
          value={stats?.best.all ? formatScore(stats.best.all.finalMs) : "—"}
        />
        <StatCard
          label="오늘 최고"
          value={stats?.best.today ? formatScore(stats.best.today.finalMs) : "—"}
        />
        <StatCard
          label="이번 주 최고"
          value={stats?.best.week ? formatScore(stats.best.week.finalMs) : "—"}
        />
        <StatCard label="공식 완료" value={`${stats?.completedPlayCount ?? 0}회`} />
      </section>
      <section>
        <div className="section-heading">
          <h2>최근 기록</h2>
          <Link href="/games/number-click">게임 시작</Link>
        </div>
        {stats?.recent.length ? (
          <ol className="recent-list">
            {stats.recent.map((record, index) => (
              <li key={`${record.achievedAt}-${index}`}>
                <strong>{formatScore(record.finalMs)}</strong>
                <span>
                  실제 {formatScore(record.durationMs)} · 오클릭 {record.mistakeCount}회
                </span>
                <time dateTime={record.achievedAt}>
                  {new Date(record.achievedAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-card">
            <p>아직 공식 기록이 없습니다.</p>
            <Link className="button button-primary" href="/games/number-click">
              첫 기록에 도전
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
