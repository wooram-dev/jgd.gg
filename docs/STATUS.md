# JGD.GG 현재 상태

기준일: 2026-09-13

이 문서는 다음 작업을 시작할 때 필요한 현재 구현 상태, 환경 제약과 우선순위를 요약한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)가 안내하는 담당 설계 문서이며, 과거 변경은 Git 이력에 보존한다.

## 구현 상태

- Next.js 기반 애플리케이션과 number-click MVP 코드가 구현돼 있다.
- 비로그인 연습 플레이의 unit/component 및 desktop/mobile/compact E2E가 통과했다.
- PostgreSQL schema, migration, 공식 GameSession API, Discord OAuth, 개인 최고와 기간별 랭킹 코드가 구현돼 있다.
- 포인트 적립 v1이 구현돼 있다. 정책 적용 시각은 2026-09-12 01:12 KST이며 유효한 number-click 공식 완료당 10P, 사용자별 KST 하루 최대 50P를 적립한다. 포인트 사용·상점은 비범위다.
- 사용자별 0P 계정 자동 생성과 기존 사용자 backfill, append-only 적립·회수 원장, 같은 GameRecord의 정확히 한 번 적립, 잔액·원장 정합성 검사와 기록 무효화 회수가 구현돼 있다.
- 로그인 사용자는 공식 완료 결과, 공통 header와 `/me`에서 확정 잔액을 확인하고 `/me`에서 최근 변동·빈 상태·조회 오류 재시도를 확인한다. BANNED 사용자는 조회만 가능하다.
- 홈은 커뮤니티 라운지로 구성돼 있다. 오늘의 대화 주제 선택·복사, 실제 TOP 5·주간 랭킹 진입, 개인 영역과 이용 가이드를 제공하며 미니게임은 보조 활동이다.
- 라운지와 공통 메뉴의 desktop/mobile/compact E2E, KST 날짜별 주제와 복사 실패 복구 component 검증이 통과했다. 주간 랭킹 초기 조회 실패에도 선택한 기간과 재시도 경로를 유지한다.
- 320·390·768·1280·1440px 화면, 키보드 본문 진입, reduced motion, 실제 클립보드 복사와 200% CSS 확대 레이아웃을 확인했다. 상세 QA 범위는 [TESTING.md](TESTING.md)를 따른다.
- `NODE_ENV=test`와 `E2E_AUTH_MODE=mock-discord`에서만 열리는 local mock Discord OAuth가 Better Auth의 state·PKCE·callback·DB session 흐름을 통과한다. 공식 desktop/mobile 완료, 500ms 오클릭 페널티, 재도전, 완료 응답 유실 후 동일 payload retry와 즉시 랭킹 반영 E2E가 구현됐다.

## 환경과 미검증 범위

- 로컬 PostgreSQL 18.6 서버가 설치돼 있으며 `postgresql-x64-18` 서비스가 자동 시작된다.
- 로컬 개발 DB `jgd`와 별도 테스트 DB `jgd_test`, 비관리자 애플리케이션 역할 `jgd`가 준비돼 있다. Git에서 제외되는 `.env`에 로컬 전용 임의 자격 증명과 테스트 DB reset 안전 설정을 구성했다.
- 개발 DB `jgd`와 테스트 DB `jgd_test`에는 `20260906120000_init_auth_and_game_models`, `20260912120000_add_point_accounts_and_ledger` migration과 number-click seed를 적용했다.
- integration 설정이 로컬 env 파일을 선택적으로 로드하며, GameSession의 `createdAt`과 `readyExpiresAt`을 같은 DB 기준 시각으로 저장한다.
- PostgreSQL integration 24개가 통과했다. 기존 세션·랭킹 검증에 포인트 신규 계정, 정책 경계, KST 일일 한도, 동시 replay, 원장 불일치 rollback, DB 제약과 무효화 회수를 포함한다.
- unit/component 122개가 통과했다. 포인트 정책 시각·KST 경계와 `/me` 포인트 loading·빈 상태·적립·회수·오류 재시도를 포함한다.
- 전체 `pnpm test:e2e`는 별도 `E2E_PORT=3109`에서 18개 통과와 비대상 공식 조합 6개 skip 후 정상 종료한다. 공식 desktop/mobile 완료의 10P 적립, header·`/me` 확정 잔액과 완료 응답 유실 replay의 원장 한 건을 포함한다. desktop 라운지의 200% 확대 검증은 1280px desktop의 유효 콘텐츠 너비를 절반 viewport로 재현해 중앙·보조 열의 재배치와 가로 overflow 없음을 확인한다. E2E runner는 Windows 종료 시 server output pipe도 해제해 전용 Next.js server가 남지 않는다.
- lint, format check, TypeScript strict, coverage와 production build가 포인트 v1 변경을 포함해 통과했다.
- 개발 환경의 실제 랭킹 조회에 필요한 DB schema와 game row가 준비됐다.
- 실제 Discord application의 local callback을 구성했다. 실제 계정 로그인, 프로필 mapping, DB session 생성과 callback 후 Discord OAuth token 비저장을 수동 확인했다. 2026-09-11 로컬 브라우저에서 실제 계정 공식 플레이 1회를 완료해 개인 최고와 오늘·주간·전체 랭킹 반영을 확인했다. 같은 날 사용자가 로그인 취소·로그아웃·재로그인 프로필 갱신 수동 QA를 진행했다고 보고했다.
- 2026-09-12 Codex in-app browser의 기존 인증 세션에서 Enter만으로 공식 게임 시작과 1~25 완료를 확인했고, 결과 heading focus와 개인 최고·오늘·주간·전체 순위 표시를 확인했다. Chrome/Edge의 실제 200% browser zoom과 실기기 Safari/Android QA는 사용자가 수행하기로 했다.
- 2026-09-13 로컬 Codex in-app browser의 실제 Discord 인증 세션에서 공식 완료당 10P 적립을 확인했다. 완료 직후 결과와 공통 header가 같은 확정 잔액으로 갱신되고 `/me`의 잔액·최신 원장과 일치하며, 이 과정에서 발견한 상위 layout 잔액 지연은 완료 성공 후 Server Component refresh와 E2E 회귀 검증으로 수정했다.
- Node.js 24.20.0과 pnpm 12.3.4가 프로젝트 고정값에 맞게 준비돼 있다.
- 로컬 `main` branch가 GitHub의 `origin/main`을 추적한다.

## 다음 작업 우선순위

1. 출시 전 production 유사 DB에서 포인트 적립 transaction과 기존 랭킹의 performance smoke, migration backup/forward-fix 계획을 확인한다.
2. 포인트 사용처·상점은 별도 제품 요구사항이 승인된 뒤 정책, 원자적 대상 효과와 멱등성 계약부터 설계한다.

사용자가 수행할 기존 Chrome/Edge 200% browser zoom과 실기기 Safari/Android QA 결과는 [TESTING.md](TESTING.md)에 기록한다.

## 갱신 규칙

- 현재 구현 상태, 환경 제약, blocker 또는 다음 우선순위가 달라진 작업에서 이 문서를 갱신한다.
- 완료된 작업의 변경 내용과 실제 검증 결과는 commit 또는 PR 설명에 남긴다.
- 요구사항이나 설계 결정을 이 문서에서 새로 정의하지 않는다.
