import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Discord 로그인이 취소되었습니다.",
  state_mismatch: "로그인 요청이 만료되었거나 올바르지 않습니다.",
  account_blocked: "이 계정은 공식 기록을 등록할 수 없습니다.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = (await searchParams).error ?? "unknown";
  return (
    <div className="auth-page">
      <p className="eyebrow">SIGN IN ERROR</p>
      <h1>로그인 중 문제가 발생했습니다</h1>
      <p>{ERROR_MESSAGES[error] ?? "Discord 로그인에 일시적인 문제가 있습니다."}</p>
      <div className="hero-actions">
        <Link className="button button-primary" href="/login">
          다시 로그인
        </Link>
        <Link className="button button-secondary" href="/games/number-click">
          게임으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
