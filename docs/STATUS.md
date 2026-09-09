# JGD.GG 현재 상태

기준일: 2026-09-10

이 문서는 다음 작업을 시작할 때 필요한 현재 구현 상태, 환경 제약과 우선순위를 요약한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)가 안내하는 담당 설계 문서이며, 상세 작업 이력은 [WORK_LOG.md](WORK_LOG.md)에 보존한다.

## 구현 상태

- Next.js 기반 애플리케이션과 number-click MVP 코드가 구현돼 있다.
- 비로그인 연습 플레이의 unit/component 및 desktop/mobile/compact E2E가 통과했다.
- PostgreSQL schema, migration, 공식 GameSession API, Discord OAuth, 개인 최고와 기간별 랭킹 코드가 구현돼 있다.

## 환경과 미검증 범위

- 로컬 PostgreSQL 18.6 서버가 설치돼 있으며 `postgresql-x64-18` 서비스가 자동 시작된다.
- 로컬 개발 DB `jgd`와 별도 테스트 DB `jgd_test`, 비관리자 애플리케이션 역할 `jgd`가 준비돼 있다. Git에서 제외되는 `.env`에 로컬 전용 임의 자격 증명과 테스트 DB reset 안전 설정을 구성했다.
- 개발·테스트 DB에는 아직 migration과 seed를 적용하지 않았다.
- 실제 Discord OAuth 환경이 없어 실제 로그인과 공식 플레이 E2E는 아직 검증되지 않았다.
- Node.js 24.20.0과 pnpm 12.3.4가 프로젝트 고정값에 맞게 준비돼 있다.
- 로컬 `main` branch가 GitHub의 `origin/main`을 추적한다.

## 다음 작업 우선순위

1. `pnpm db:deploy`, `pnpm db:seed`를 실행해 migration과 seed를 실제 검증한다.
2. `DATABASE_URL_TEST`와 `ALLOW_TEST_DATABASE_RESET=true`로 `pnpm test:integration`을 실행한다.
3. 문서에 정의됐지만 아직 없는 DB integration 시나리오를 보강한다: 만료, READY 완료 거부, 오클릭 저장, BANNED 사용자, malformed payload, rank lookup 실패, 랭킹 경계·제외·viewer·결정적 정렬.
4. test 전용 mock Discord OAuth 흐름과 공식 desktop/mobile E2E를 구현한다: 로그인, 공식 완료, 오클릭 페널티, 재도전, 완료 응답 유실 후 retry, 랭킹 반영.
5. 실제 Discord application으로 로그인·취소·로그아웃·재로그인 프로필 갱신과 OAuth token 비저장을 수동 검증한다.
6. 768×1024, 1440×900, 200% zoom, reduced motion, keyboard-only 등 출시 전 수동 QA를 수행한다.

## 갱신 규칙

- 현재 구현 상태, 환경 제약, blocker 또는 다음 우선순위가 달라진 작업에서 이 문서를 갱신한다.
- 완료된 작업의 상세 내용과 실제 검증 결과는 [WORK_LOG.md](WORK_LOG.md)에 남긴다.
- 요구사항이나 설계 결정을 이 문서에서 새로 정의하지 않는다.
