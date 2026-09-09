import { NumberClickGame } from "@/features/number-click/components/number-click-game";
import { getNumberClickOverview } from "@/features/number-click/server/overview-service";
import { getPageViewer } from "@/lib/auth/page-viewer";
import { getDatabase } from "@/lib/db/client";
import { hasServerEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default async function NumberClickPage() {
  const viewer = await getPageViewer();
  let overview: Awaited<ReturnType<typeof getNumberClickOverview>> = null;
  if (hasServerEnv()) {
    try {
      overview = await getNumberClickOverview(getDatabase(), { viewerId: viewer?.id ?? null });
    } catch (error) {
      overview = null;
      console.error(
        JSON.stringify({
          level: "error",
          event: "number_click.overview_lookup_failed",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }

  return (
    <div className="game-page page-stack narrow-page">
      <header className="page-heading">
        <p className="eyebrow">MINI GAME · NUMBER CLICK</p>
        <h1>숫자 순서대로 누르기</h1>
        <p>1부터 25까지 순서대로 누르세요. 오클릭마다 0.50초가 추가됩니다.</p>
      </header>
      <NumberClickGame
        authenticated={viewer !== null}
        officialEligible={viewer?.status === "ACTIVE"}
        personalBest={overview?.viewer?.personalBest ?? null}
        todayBest={overview?.todayBest ?? null}
      />
      <p className="center-link">
        <a href="/rankings/number-click">오늘·주간·전체 랭킹 보기</a>
      </p>
    </div>
  );
}
