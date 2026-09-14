import Link from "next/link";

import { SignInButton } from "@/components/ui/auth-button";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = sanitizeReturnTo((await searchParams).returnTo);
  return (
    <div className="auth-page">
      <p className="eyebrow">SIGN IN</p>
      <h1>Discord로 계속하기</h1>
      <p>기본 프로필만 확인해 공식 기록과 랭킹에 표시합니다.</p>
      <ul>
        <li>저장: 표시 이름, 아바타, 게임 기록</li>
        <li>
          선택한 스토리 사진: 로그인한 멤버에게 24시간 공개 후 숨김. 사진 원본은 서버에 보관하며,
          계정 삭제 시 함께 삭제합니다. 스토리 목록의 프로필 사진과 표시 이름은 비로그인
          방문자에게도 공개됩니다.
        </li>
        <li>
          사진 원본 삭제 문의: <a href="mailto:contact@jgd.gg">contact@jgd.gg</a>
        </li>
        <li>수집하지 않음: 실제 이메일, 서버 목록, OAuth 토큰</li>
      </ul>
      <SignInButton callbackURL={returnTo} />
      <Link href={returnTo}>취소하고 돌아가기</Link>
    </div>
  );
}
