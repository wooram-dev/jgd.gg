import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteNavigation } from "@/components/layout/site-navigation";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "JGD.GG", template: "%s · JGD.GG" },
  description:
    "게임으로 만나, 일상으로 이어지는 곳. 오늘의 대화 주제와 커뮤니티 기록을 만나는 우리들의 라운지, JGD.GG.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#101116",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <div className="site-shell">
          <SiteNavigation />
          <main id="main-content" tabIndex={-1} className="site-main">
            {children}
          </main>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
