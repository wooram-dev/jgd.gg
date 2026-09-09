import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <span>
          JGD.GG <span className="footer-tagline">· 우리의 이야기가 이어지는 곳</span>
        </span>
        <nav aria-label="하단 메뉴">
          <Link href="/login">개인정보 안내</Link>
          <a href="mailto:contact@jgd.gg">문의</a>
        </nav>
      </div>
    </footer>
  );
}
