import Link from "next/link";

import { getPageViewer } from "@/lib/auth/page-viewer";

import { Avatar } from "../ui/avatar";
import { SignOutButton } from "../ui/auth-button";
import { DiscordIcon } from "../ui/icon";
import { SiteNavigation } from "./site-navigation";

export async function SiteHeader() {
  const viewer = await getPageViewer();

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
