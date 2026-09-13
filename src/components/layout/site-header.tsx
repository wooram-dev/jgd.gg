import Link from "next/link";

import { getConfirmedPointBalance } from "@/features/points/server";
import { getPageViewer } from "@/lib/auth/page-viewer";
import { getDatabase } from "@/lib/db/client";

import { Avatar } from "../ui/avatar";
import { SignOutButton } from "../ui/auth-button";
import { DiscordIcon } from "../ui/icon";
import { SiteNavigation } from "./site-navigation";

export async function SiteHeader() {
  const viewer = await getPageViewer();
  let pointsBalance: number | null = null;
  if (viewer) {
    try {
      pointsBalance = await getConfirmedPointBalance(getDatabase(), viewer.id);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "points.header_balance_lookup_failed",
          userId: viewer.id,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="wordmark" href="/">
          <span className="brand-symbol" aria-hidden="true">
            j.
          </span>
          JGD<span>.GG</span>
        </Link>
        <span className="header-tagline">게임으로 만나, 일상으로 이어지는 곳</span>
        <div className="account-nav">
          {viewer ? (
            <>
              {pointsBalance !== null ? (
                <Link
                  className="header-points"
                  href="/me#points"
                  aria-label={`보유 포인트 ${pointsBalance.toLocaleString("ko-KR")} P`}
                >
                  {pointsBalance.toLocaleString("ko-KR")} P
                </Link>
              ) : null}
              <Link className="viewer-link" href="/me">
                <Avatar name={viewer.displayName} src={viewer.image} size={32} />
                <span>{viewer.displayName}</span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link className="header-login" href="/login">
              <DiscordIcon />{" "}
              <span>
                <span className="login-prefix">Discord로 </span>로그인
              </span>
            </Link>
          )}
        </div>
        <SiteNavigation mobile />
      </div>
    </header>
  );
}
