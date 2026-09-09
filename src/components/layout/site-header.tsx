import Link from "next/link";

import { getPageViewer } from "@/lib/auth/page-viewer";

import { Avatar } from "../ui/avatar";
import { SignOutButton } from "../ui/auth-button";

export async function SiteHeader() {
  const viewer = await getPageViewer();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="wordmark" href="/">
          JGD<span>.GG</span>
        </Link>
        <nav className="desktop-nav" aria-label="주요 메뉴">
          <Link href="/games/number-click">게임</Link>
          <Link href="/rankings/number-click">랭킹</Link>
        </nav>
        <div className="account-nav">
          {viewer ? (
            <>
              <Link className="viewer-link" href="/me">
                <Avatar name={viewer.displayName} src={viewer.image} size={32} />
                <span>{viewer.displayName}</span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link className="header-login" href="/login">
              Discord로 로그인
            </Link>
          )}
        </div>
        <details className="mobile-menu">
          <summary aria-label="메뉴 열기">메뉴</summary>
          <nav aria-label="모바일 메뉴">
            <Link href="/games/number-click">게임</Link>
            <Link href="/rankings/number-click">랭킹</Link>
            {viewer ? (
              <>
                <Link href="/me">내 기록</Link>
                <SignOutButton />
              </>
            ) : (
              <Link href="/login">로그인</Link>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
