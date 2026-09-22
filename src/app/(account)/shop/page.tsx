import { redirect } from "next/navigation";
import { TitleShop } from "@/features/title-shop/components/title-shop";
import { getPageViewer } from "@/lib/auth/page-viewer";
export const dynamic = "force-dynamic";
export const metadata = { title: "칭호 상점 | JGD.GG", robots: { index: false, follow: false } };
export default async function ShopPage() {
  if (!(await getPageViewer())) redirect(`/login?returnTo=${encodeURIComponent("/상점")}`);
  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">COMMUNITY POINTS</p>
        <h1>칭호 상점</h1>
      </header>
      <TitleShop />
    </div>
  );
}
