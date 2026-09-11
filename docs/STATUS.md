# JGD.GG 현재 상태

기준일: 2026-09-11

이 문서는 다음 작업을 시작할 때 필요한 현재 구현 상태, 환경 제약과 우선순위를 요약한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)가 안내하는 담당 설계 문서이며, 과거 변경은 Git 이력에 보존한다.

## 구현 상태

- Next.js 기반 애플리케이션과 number-click MVP 코드가 구현돼 있다.
- 비로그인 연습 플레이의 unit/component 및 desktop/mobile/compact E2E가 통과했다.
- PostgreSQL schema, migration, 공식 GameSession API, Discord OAuth, 개인 최고와 기간별 랭킹 코드가 구현돼 있다.
- 홈은 커뮤니티 라운지로 구성돼 있다. 오늘의 대화 주제 선택·복사, 실제 TOP 5·주간 랭킹 진입, 개인 영역과 이용 가이드를 제공하며 미니게임은 보조 활동이다.
- 라운지와 공통 메뉴의 desktop/mobile/compact E2E, KST 날짜별 주제와 복사 실패 복구 component 검증이 통과했다. 주간 랭킹 초기 조회 실패에도 선택한 기간과 재시도 경로를 유지한다.
- 320·390·768·1280·1440px 화면, 키보드 본문 진입, reduced motion, 실제 클립보드 복사와 200% CSS 확대 레이아웃을 확인했다. 상세 QA 범위는 [TESTING.md](TESTING.md)를 따른다.
- `NODE_ENV=test`와 `E2E_AUTH_MODE=mock-discord`에서만 열리는 local mock Discord OAuth가 Better Auth의 state·PKCE·callback·DB session 흐름을 통과한다. 공식 desktop/mobile 완료, 500ms 오클릭 페널티, 재도전, 완료 응답 유실 후 동일 payload retry와 즉시 랭킹 반영 E2E가 구현됐다.

## 환경과 미검증 범위

- 로컬 PostgreSQL 18.6 서버가 설치돼 있으며 `postgresql-x64-18` 서비스가 자동 시작된다.
- 로컬 개발 DB `jgd`와 별도 테스트 DB `jgd_test`, 비관리자 애플리케이션 역할 `jgd`가 준비돼 있다. Git에서 제외되는 `.env`에 로컬 전용 임의 자격 증명과 테스트 DB reset 안전 설정을 구성했다.
- 개발 DB `jgd`에는 `20260906120000_init_auth_and_game_models` migration과 number-click seed를 적용했다. 테스트 DB `jgd_test`에도 같은 migration을 적용했다.
- integration 설정이 로컬 env 파일을 선택적으로 로드하며, GameSession의 `createdAt`과 `readyExpiresAt`을 같은 DB 기준 시각으로 저장한다.
- PostgreSQL integration 17개가 통과했다. 세션 생성·완료의 BANNED 재검증, READY·PLAYING 만료, READY 완료 거부, 오클릭 저장, malformed payload 보존, 완료 후 rank 조회 실패 복구와 랭킹 기간 경계·제외·viewer·결정적 정렬을 포함한다.
- 공식 E2E 대상 실행은 3개가 통과하고 비대상 project 6개가 skip됐다. 전체 `pnpm test:e2e`에서는 17개 통과, 비대상 공식 조합 6개 skip, 기존 desktop 라운지 200% CSS 확대 위치 검사 1개 실패 뒤 Windows의 Playwright web server 종료 정지로 수동 중단했다.
- 개발 환경의 실제 랭킹 조회에 필요한 DB schema와 game row가 준비됐다.
- 실제 Discord application의 local callback을 구성했다. 실제 계정 로그인, 프로필 mapping, DB session 생성과 callback 후 Discord OAuth token 비저장을 수동 확인했다. 로그인 취소·로그아웃·재로그인 프로필 갱신과 실제 계정 공식 플레이는 아직 검증하지 않았다.
- Node.js 24.20.0과 pnpm 12.3.4가 프로젝트 고정값에 맞게 준비돼 있다.
- 로컬 `main` branch가 GitHub의 `origin/main`을 추적한다.

## 다음 작업 우선순위

1. 실제 Discord application으로 로그인 취소·로그아웃·재로그인 프로필 갱신과 실제 계정 공식 플레이를 수동 검증한다.
2. desktop 라운지의 200% CSS 확대 위치 검사 회귀와 Playwright web server 종료 후 `pnpm test:e2e` 프로세스가 남는 Windows 환경 문제를 재현·수정한다.
3. 실제 브라우저 200% zoom, 실기기 Safari/Android와 로그인 후 keyboard-only 공식 흐름 등 남은 출시 전 수동 QA를 수행한다.

## 갱신 규칙

- 현재 구현 상태, 환경 제약, blocker 또는 다음 우선순위가 달라진 작업에서 이 문서를 갱신한다.
- 완료된 작업의 변경 내용과 실제 검증 결과는 commit 또는 PR 설명에 남긴다.
- 요구사항이나 설계 결정을 이 문서에서 새로 정의하지 않는다.
