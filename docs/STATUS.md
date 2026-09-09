# JGD.GG 현재 상태

기준일: 2026-09-09

이 문서는 다음 작업을 시작할 때 필요한 현재 구현 상태, 환경 제약과 우선순위를 요약한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)가 안내하는 담당 설계 문서이며, 상세 작업 이력은 [WORK_LOG.md](WORK_LOG.md)에 보존한다.

## 구현 상태

- Next.js 기반 애플리케이션과 number-click MVP 코드가 구현돼 있다.
- 비로그인 연습 플레이의 unit/component 및 desktop/mobile/compact E2E가 통과했다.
- PostgreSQL schema, migration, 공식 GameSession API, Discord OAuth, 개인 최고와 기간별 랭킹 코드가 구현돼 있다.

## 환경과 미검증 범위

- 실제 PostgreSQL과 Discord OAuth 환경이 없어 migration 적용, DB integration, 실제 로그인과 공식 플레이 E2E는 아직 검증되지 않았다.
- Node.js 24.20.0과 pnpm 12.3.4가 프로젝트 고정값에 맞게 준비돼 있다.
- 로컬 `main` branch가 GitHub의 `origin/main`을 추적한다.

## 다음 작업 우선순위

1. PostgreSQL 18에 개발 DB와 이름이 `_test`로 끝나는 별도 테스트 DB를 준비한다.
2. `.env.example`을 기준으로 로컬 환경을 설정하되 secret과 실제 값을 저장소에 기록하거나 commit하지 않는다.
3. `pnpm db:deploy`, `pnpm db:seed`를 실행해 migration과 seed를 실제 검증한다.
4. `DATABASE_URL_TEST`와 `ALLOW_TEST_DATABASE_RESET=true`로 `pnpm test:integration`을 실행한다.
5. 문서에 정의됐지만 아직 없는 DB integration 시나리오를 보강한다: 만료, READY 완료 거부, 오클릭 저장, BANNED 사용자, malformed payload, rank lookup 실패, 랭킹 경계·제외·viewer·결정적 정렬.
6. test 전용 mock Discord OAuth 흐름과 공식 desktop/mobile E2E를 구현한다: 로그인, 공식 완료, 오클릭 페널티, 재도전, 완료 응답 유실 후 retry, 랭킹 반영.
7. 실제 Discord application으로 로그인·취소·로그아웃·재로그인 프로필 갱신과 OAuth token 비저장을 수동 검증한다.
8. 768×1024, 1440×900, 200% zoom, reduced motion, keyboard-only 등 출시 전 수동 QA를 수행한다.

## 갱신 규칙

- 현재 구현 상태, 환경 제약, blocker 또는 다음 우선순위가 달라진 작업에서 이 문서를 갱신한다.
- 완료된 작업의 상세 내용과 실제 검증 결과는 [WORK_LOG.md](WORK_LOG.md)에 남긴다.
- 요구사항이나 설계 결정을 이 문서에서 새로 정의하지 않는다.
