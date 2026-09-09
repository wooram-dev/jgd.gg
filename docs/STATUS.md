# JGD.GG 현재 상태

기준일: 2026-09-10

이 문서는 다음 작업을 시작할 때 필요한 현재 구현 상태, 환경 제약과 우선순위를 요약한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)가 안내하는 담당 설계 문서이며, 과거 변경은 Git 이력에 보존한다.

## 구현 상태

- Next.js 기반 애플리케이션과 number-click MVP 코드가 구현돼 있다.
- 비로그인 연습 플레이의 unit/component 및 desktop/mobile/compact E2E가 통과했다.
- PostgreSQL schema, migration, 공식 GameSession API, Discord OAuth, 개인 최고와 기간별 랭킹 코드가 구현돼 있다.
- 홈은 커뮤니티 라운지로 구성돼 있다. 오늘의 대화 주제 선택·복사, 실제 TOP 5·주간 랭킹 진입, 개인 영역과 이용 가이드를 제공하며 미니게임은 보조 활동이다.
- 라운지와 공통 메뉴의 desktop/mobile/compact E2E, KST 날짜별 주제와 복사 실패 복구 component 검증이 통과했다. 주간 랭킹 초기 조회 실패에도 선택한 기간과 재시도 경로를 유지한다.
- 320·390·768·1280·1440px 화면, 키보드 본문 진입, reduced motion, 실제 클립보드 복사와 200% CSS 확대 레이아웃을 확인했다. 상세 QA 범위는 [TESTING.md](TESTING.md)를 따른다.

## 환경과 미검증 범위

- 로컬 PostgreSQL 18.6 서버가 설치돼 있으며 `postgresql-x64-18` 서비스가 자동 시작된다.
- 로컬 개발 DB `jgd`와 별도 테스트 DB `jgd_test`, 비관리자 애플리케이션 역할 `jgd`가 준비돼 있다. Git에서 제외되는 `.env`에 로컬 전용 임의 자격 증명과 테스트 DB reset 안전 설정을 구성했다.
- 개발·테스트 DB에는 아직 migration과 seed를 적용하지 않았다.
- 홈의 실제 랭킹 조회도 DB 준비 전에는 오류·재시도 상태로 표시된다. 이번 UI 작업에서는 DB, OAuth 설정과 migration을 변경하지 않았다.
- 실제 Discord OAuth 환경이 없어 실제 로그인과 공식 플레이 E2E는 아직 검증되지 않았다.
- Node.js 24.20.0과 pnpm 12.3.4가 프로젝트 고정값에 맞게 준비돼 있다.
- 로컬 `main` branch가 GitHub의 `origin/main`을 추적한다.

## 다음 작업 우선순위

1. `pnpm db:deploy`, `pnpm db:seed`를 실행해 migration과 seed를 실제 검증한다.
2. `DATABASE_URL_TEST`와 `ALLOW_TEST_DATABASE_RESET=true`로 `pnpm test:integration`을 실행한다.
3. 문서에 정의됐지만 아직 없는 DB integration 시나리오를 보강한다: 만료, READY 완료 거부, 오클릭 저장, BANNED 사용자, malformed payload, rank lookup 실패, 랭킹 경계·제외·viewer·결정적 정렬.
4. test 전용 mock Discord OAuth 흐름과 공식 desktop/mobile E2E를 구현한다: 로그인, 공식 완료, 오클릭 페널티, 재도전, 완료 응답 유실 후 retry, 랭킹 반영.
5. 실제 Discord application으로 로그인·취소·로그아웃·재로그인 프로필 갱신과 OAuth token 비저장을 수동 검증한다.
6. 실제 브라우저 200% zoom, 실기기 Safari/Android와 로그인 후 keyboard-only 공식 흐름 등 남은 출시 전 수동 QA를 수행한다.

## 갱신 규칙

- 현재 구현 상태, 환경 제약, blocker 또는 다음 우선순위가 달라진 작업에서 이 문서를 갱신한다.
- 완료된 작업의 변경 내용과 실제 검증 결과는 commit 또는 PR 설명에 남긴다.
- 요구사항이나 설계 결정을 이 문서에서 새로 정의하지 않는다.
