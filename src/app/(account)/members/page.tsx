import { redirect } from "next/navigation";
import { GameProfileDirectory } from "@/features/game-profiles/components/game-profile-directory";
import { getPageViewer } from "@/lib/auth/page-viewer";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "멤버 게임 프로필 | JGD.GG",
  robots: { index: false, follow: false },
};

export default async function MembersPage() {
  const viewer = await getPageViewer();
  if (!viewer) redirect(`/login?returnTo=${encodeURIComponent("/멤버")}`);
  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">OUR GAMES</p>
        <h1>멤버 게임 프로필</h1>
        <p>
          누가 어떤 게임을 즐기는지 둘러보세요. 닉네임과 티어는 멤버가 직접 작성한 정보이며, 대상
          Discord 서버 멤버에게만 공개됩니다.
        </p>
      </header>
      <GameProfileDirectory />
    </div>
  );
}
