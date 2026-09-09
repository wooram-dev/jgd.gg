import { redirect } from "next/navigation";

import { RankingView } from "@/features/ranking/components/ranking-view";
import { getNumberClickRanking } from "@/features/ranking/server/ranking-service";
import { getPageViewer } from "@/lib/auth/page-viewer";
import { getDatabase } from "@/lib/db/client";
import { hasServerEnv } from "@/lib/env/server";
import type { RankingPeriodKey } from "@/lib/time/ranking-period";

export const dynamic = "force-dynamic";

function isRankingPeriod(value: string): value is RankingPeriodKey {
  return value === "today" || value === "week" || value === "all";
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const requestedPeriod = (await searchParams).period ?? "today";
  if (!isRankingPeriod(requestedPeriod)) {
    redirect("/rankings/number-click?period=today");
  }
  const period = requestedPeriod;
  const viewer = await getPageViewer();
  let initialData: Awaited<ReturnType<typeof getNumberClickRanking>> = null;
  let initialLoadFailed = true;
  if (hasServerEnv()) {
    try {
      initialData = await getNumberClickRanking(getDatabase(), {
        period,
        limit: 100,
        offset: 0,
        viewerId: viewer?.id ?? null,
      });
      initialLoadFailed = false;
    } catch (error) {
      initialData = null;
      initialLoadFailed = true;
      console.error(
        JSON.stringify({
          level: "error",
          event: "ranking.initial_load_failed",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">LEADERBOARD</p>
        <h1>숫자 게임 랭킹</h1>
        <p>기간마다 각 사용자의 가장 좋은 기록 한 건만 반영됩니다.</p>
      </header>
      <RankingView
        initialData={initialData}
        initialLoadFailed={initialLoadFailed}
        initialPeriod={period}
      />
    </div>
  );
}
