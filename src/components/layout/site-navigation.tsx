"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "라운지", icon: "home" },
  { href: "/멤버", label: "게임 프로필", icon: "user" },
  { href: "/rankings/number-click", label: "커뮤니티 랭킹", icon: "trophy" },
  { href: "/games/number-click", label: "미니게임", icon: "game" },
  { href: "/내정보", label: "내 정보", icon: "user" },
];

export function SiteNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const navigation = (
    <nav aria-label={mobile ? "모바일 메뉴" : "주요 메뉴"}>
      {links.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href || pathname === encodeURI(href) ? "page" : undefined}
          onClick={() => {
            if (menu.current) menu.current.open = false;
          }}
        >
          <Icon name={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );

  if (mobile)
    return (
      <details className="mobile-menu" ref={menu}>
        <summary aria-label="메뉴 열기">
          <Icon name="menu" />
        </summary>
        {navigation}
      </details>
    );

  return (
    <aside className="site-sidebar">
      <div className="sidebar-heading">OUR COMMUNITY</div>
      {navigation}
      <div className="sidebar-divider" />
      <p className="sidebar-label">함께 즐기기</p>
      <Link className="sidebar-shortcut" href="/#daily-topic">
        <Icon name="chat" />
        오늘의 대화 주제
      </Link>
      <Link className="sidebar-shortcut" href="/#lounge-guide">
        <Icon name="book" />
        라운지 이용 가이드
      </Link>
      <div className="sidebar-note">
        <span className="little-star">✳</span>
        <strong>
          각자 놀다가도,
          <br />
          결국 여기서.
        </strong>
        <p>
          우리의 다음 이야기가
          <br />
          시작되는 곳, JGD.GG
        </p>
      </div>
      <span className="sidebar-bottom">A LITTLE CLOSER, EVERY DAY.</span>
    </aside>
  );
}
