# JGD.GG 작업 로그

이 문서는 수행한 저장소 작업과 실제 검증 결과를 누적한다. 현재 구현 상태, 환경 제약과 다음 우선순위는 [STATUS.md](STATUS.md)에서 관리한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)에 정의된 담당 설계 문서이며, 이 로그는 그 요구사항을 변경하거나 대체하지 않는다.

## 기록 원칙

- 최신 작업을 위에 추가한다.
- 실행하지 않은 검증은 PASS로 쓰지 않는다.
- secret, token, cookie, 개인정보, 전체 DB connection string이나 환경 변수 값은 기록하지 않는다.
- 과거 기록은 보존한다. 사실 오류 정정이 필요하면 정정 날짜와 이유를 남긴다.
- 각 작업에는 요청, 수행 내용, 주요 파일, 검증, Acceptance Criteria, 남은 사항을 기록한다.

## 2026-09-09 — 다음 작업과 Git 선행 여부 점검

요청

- 현재 저장소 상태를 기준으로 JGD.GG의 다음 우선 작업을 정하고, 원격 Git 저장소 업로드가 먼저 필요한지 판단한다.

수행

- 현재 상태 문서와 프로젝트 초기 구성·DB·인증·테스트 기준을 대조했다.
- 로컬 Git 저장소와 원격 설정이 모두 없고, Node.js가 고정 버전보다 낮으며, PostgreSQL 실행 도구·서비스와 로컬 환경 파일이 아직 준비되지 않은 상태를 확인했다.
- 환경 구성 전에 로컬 Git 기준선을 만들고, 비밀값과 생성물을 제외한 뒤 원격 private 저장소에 백업하는 순서를 권장하기로 했다.
- `.gitignore`가 주요 생성 디렉터리와 `.env`를 제외하지만 현재 생성된 `tsconfig.tsbuildinfo`는 제외하지 않는 점을 확인했다.

주요 파일

- `docs/README.md`
- `docs/STATUS.md`
- `docs/AI_RULES.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/AUTH.md`
- `docs/TESTING.md`
- `.gitignore`
- `.env.example`
- `.nvmrc`
- `package.json`

검증

- `git status --short --branch`: BLOCKED — 현재 디렉터리가 Git 저장소가 아니다.
- `git remote -v`: BLOCKED — 로컬 Git 저장소가 없어 원격 설정도 확인할 수 없다.
- `node --version`: PASS — v24.18.0이며 프로젝트 고정값 24.20.0과 다르다.
- `pnpm --version`: PASS — packageManager에 고정된 12.3.4와 일치한다.
- `psql`·`docker`·Windows PostgreSQL service 확인: BLOCKED — 모두 현재 환경에서 찾지 못했다.
- 로컬 환경 파일 이름 확인: PASS — `.env.example`만 있고 실제 secret 파일은 없다.
- 코드 test 및 build: NOT RUN — 구현을 변경하지 않은 우선순위 분석 작업이다.

Acceptance Criteria

- 현재 blocker와 다음 실행 단계를 실제 환경 기준으로 식별한다: PASS.
- Git 원격 업로드의 선행 필요성을 구분한다: PASS — 로컬 Git 기준선은 먼저 필요하고, 원격 업로드는 실행 필수는 아니지만 초기 기준선 직후 권장한다.

남은 사항

- `.gitignore`에 `*.tsbuildinfo`를 추가하는 등 초기 추적 대상을 검토한 뒤 Git 저장소를 초기화하거나 기존 원격 이력을 복원해야 한다.
- Git 기준선 다음에는 Node.js 24.20.0, PostgreSQL 18 개발·테스트 DB, 로컬 환경 변수를 순서대로 구성해야 한다.

## 2026-09-09 — Agent 지침 문서 경량화

요청

- `AGENTS.md`에는 모든 작업에 공통인 지침만 남기고 상세 지침은 책임별 Markdown 문서로 분리해 링크한다.

수행

- `AGENTS.md`를 작업 진입, 문서 라우팅, 공통 안전 원칙과 완료 절차 중심으로 축소했다.
- `docs/README.md`를 문서 책임, Source of Truth 우선순위와 작업 유형별 조건부 읽기 표를 제공하는 문서 라우터로 재구성했다.
- `docs/AI_RULES.md`에서 제품·보안·DB·API·기능별 상세 규칙의 복제를 제거하고 작업 절차, 범위 통제, 검증, Git 안전과 보고 규칙만 유지했다.
- 계속 커지는 작업 이력 전체를 매번 읽지 않도록 현재 구현 상태, 환경 제약과 다음 작업을 새 `docs/STATUS.md`로 분리했다.
- `docs/WORK_LOG.md`에서는 현재 상태 요약과 다음 작업을 제거하고 `docs/STATUS.md`를 가리키도록 역할을 이력 전용으로 조정했다.
- Next.js가 자동 관리하는 `nextjs-agent-rules` 블록은 원문 그대로 `AGENTS.md`에 보존했다.

주요 파일

- `AGENTS.md`
- `docs/README.md`
- `docs/AI_RULES.md`
- `docs/STATUS.md`
- `docs/WORK_LOG.md`

검증

- `git status --short`: BLOCKED — 현재 디렉터리가 Git 저장소가 아니다.
- 로컬 Markdown 링크 대상 검사: PASS — 끊어진 링크가 없다.
- 핵심 규칙 담당 문서 검색: PASS — stack, 인증, 점수, 시간, DB, API와 접근성 불변식이 각 Source of Truth에 남아 있다.
- Next.js 자동 관리 블록 marker 검사: PASS.
- `node --version`: PASS — v24.18.0을 확인했으며 프로젝트 기준 24.20.x와 다른 상태는 `docs/STATUS.md`에 유지했다.
- `pnpm --version`: PASS — 12.3.4.
- `pnpm format:check`: PASS.
- 코드 test 및 build: NOT RUN — 런타임 코드와 계약을 변경하지 않은 Markdown 구조 리팩토링이다.

Acceptance Criteria

- 루트 `AGENTS.md`가 범용 진입 지침과 링크 중심이어야 한다: PASS — 16,891 bytes에서 4,257 bytes로 축소했다.
- 상세 규칙은 책임별 단일 원본을 가져야 한다: PASS — 도메인별 기존 문서로 연결하고 `docs/AI_RULES.md`의 중복 상세 규칙을 제거했다.
- 필요한 문서만 조건부로 읽을 수 있어야 한다: PASS — `docs/README.md`에 작업별 라우팅 표를 유지했다.
- 현재 상태 확인을 위해 전체 작업 이력을 읽지 않아야 한다: PASS — `docs/STATUS.md`를 추가했다.
- 자동 생성 Next.js 지침이 보존돼야 한다: PASS.

남은 사항

- Git 저장소가 없어 실제 diff와 변경 이력을 Git으로 검증하지 못했다.
- runtime 코드 검증은 문서 전용 변경이므로 실행하지 않았다.

## 2026-09-09 — Agent 지침 문서 리팩토링 구상

요청

- 비대해진 `AGENTS.md`에는 모든 작업에 공통인 진입 지침만 남기고, 상세 지침은 책임별 Markdown 문서로 분리해 링크하는 리팩토링 방안을 구상한다.

수행

- `AGENTS.md`, `docs/README.md`, `docs/AI_RULES.md`, `docs/WORK_LOG.md`의 역할, 읽기 순서, 중복 규칙과 참조 관계를 검토했다.
- `AGENTS.md`를 얇은 진입점으로 유지하고 `docs/README.md`를 작업별 문서 라우터로 사용하는 최소 중복 구조를 제안했다.
- 제품·보안·DB·API·UI·기능·테스트 규칙은 기존 담당 Source of Truth 문서로 이동하고, 범용 작업 절차만 `docs/AI_RULES.md`에 유지하는 섹션 이동 원칙을 정리했다.
- 매 작업마다 계속 커지는 전체 작업 로그를 읽는 비용을 줄이기 위해 현재 상태를 `docs/STATUS.md`로 분리하고 `docs/WORK_LOG.md`는 이력 조회용으로 전하는 방안을 포함했다.
- Next.js가 관리하는 `nextjs-agent-rules` 블록은 루트 `AGENTS.md`에 유지해야 한다는 제약을 확인했다.

주요 파일

- `AGENTS.md`
- `docs/README.md`
- `docs/AI_RULES.md`
- `docs/WORK_LOG.md`

검증

- `git status --short`: BLOCKED — 현재 디렉터리가 Git 저장소가 아니다.
- 문서 구조, 제목, 상호 참조와 package manager 수동 검토: PASS.
- `pnpm format:check`: PASS.
- 코드 test 및 build: NOT RUN — 구현이 없는 문서 구조 분석 작업이다.

Acceptance Criteria

- 루트 지침에서 제거할 프로젝트별 상세 규칙과 유지할 공통 규칙을 구분했다: PASS.
- 상세 규칙의 단일 원본과 링크 목적지를 정했다: PASS.
- 조건부 문서 로딩, 상태와 이력 분리, 단계적 이행·검증 방안을 포함했다: PASS.

남은 사항

- 이번 요청은 구상 단계이므로 실제 `AGENTS.md` 축소, 문서 이동, 링크 수정은 수행하지 않았다.
- 사용자가 구현을 요청하면 문서 참조 검사와 `pnpm format:check`를 포함해 변경을 검증해야 한다.

## 2026-09-09 — 작업 로그와 상시 기록 지침 추가

요청

- 지금까지의 작업과 앞으로 해야 할 일을 `docs/WORK_LOG.md`에 기록한다.
- AI 지침서에 모든 저장소 작업을 이 로그에 기록하도록 규칙을 추가한다.

수행

- 작업 로그의 목적, 기록 원칙, 현재 상태, 다음 작업 우선순위와 항목 템플릿을 정의했다.
- `AGENTS.md`와 `docs/AI_RULES.md`에 작업 전 로그 확인과 완료 전 로그 갱신을 의무화했다.
- `docs/README.md`의 문서 책임, 읽기 순서와 디렉터리 구조에 WORK_LOG를 추가했다.
- WORK_LOG가 Source of Truth를 대체하지 않는다는 충돌 규칙을 명시했다.

주요 파일

- `docs/WORK_LOG.md`
- `AGENTS.md`
- `docs/AI_RULES.md`
- `docs/README.md`

검증

- 문서 간 참조, 읽기 순서, 섹션 번호와 역할 구분 수동 검토: PASS.
- `pnpm format:check`: PASS.

Acceptance Criteria

- 기존 작업과 미완료 검증을 한 문서에서 확인할 수 있어야 한다: 구현됨.
- 이후 모든 저장소 작업에서 로그를 읽고 갱신해야 한다: 지침에 반영됨.
- 로그가 설계 문서를 덮어쓰지 않아야 한다: 우선순위와 역할을 명시함.

남은 사항

- 이 문서 작업 자체에는 남은 사항이 없다.

## 2026-09-07 — 최초 실행 기반 및 number-click MVP 구현

요청

- 설계 문서를 Source of Truth로 사용해 JGD 프로젝트의 최초 실행 기반과 number-click MVP를 구현한다.

수행

- Node.js 24 LTS, pnpm, Next.js 16.3.x App Router, React 19.2, TypeScript strict, Tailwind CSS 4.3.x 기반을 구성했다.
- Prisma 7과 PostgreSQL용 schema, 초기 migration, number-click seed를 작성했다.
- Better Auth 1.7.x와 Discord OAuth `identify` 전용 설정, Discord 프로필 매핑, 사용자 상태 확인, 안전한 returnTo, 토큰·IP·User-Agent 비저장 처리를 구현했다.
- 공식 GameSession 생성·시작·포기·완료 API와 공통 JSON envelope, requestId, strict Zod validation, same-origin Origin 검사를 구현했다.
- 서버 CSPRNG 보드, 브라우저 crypto 연습 보드, `performance.now()` 타이머, 명시적 게임 상태 머신과 페이지 이동 없는 재도전을 구현했다.
- 서버 event replay로 실제 시간, 오클릭, 페널티와 최종 기록을 재계산하고 최소·최대 시간, 클릭 수, 소유권, 상태, 만료와 시계 관계를 검증하도록 구현했다.
- session row lock, `GameRecord.sessionId` UNIQUE, 활성 session partial UNIQUE와 완료 재시도 멱등성을 구현했다.
- 개인 최고와 오늘·주간·전체 랭킹, Asia/Seoul 기간 경계, 사용자별 최고 한 건, 결정적 정렬과 viewer UI를 구현했다.
- 320px 이상 보드, 44px 이상 cell, focus 이동, 색 외 상태 표시와 reduced motion을 포함한 반응형·접근성 UI를 구현했다.
- unit, component, PostgreSQL integration test 코드와 guest Playwright E2E를 작성했다.

주요 파일

- `package.json`, `pnpm-lock.yaml`, TypeScript·Next.js·Tailwind·Vitest·Playwright 설정
- `prisma/schema.prisma`
- `prisma/migrations/20260906120000_init_auth_and_game_models/migration.sql`
- `prisma/seed.ts`
- `src/lib/auth/*`, `src/lib/db/*`, `src/lib/http/*`, `src/lib/time/*`
- `src/features/number-click/*`
- `src/features/ranking/*`
- `src/app/*`
- `tests/integration/game-session/number-click-session.integration.test.ts`
- `tests/e2e/guest-practice.spec.ts`

DB 변경

- Better Auth용 `User`, `Session`, `Account`, `Verification` 모델을 추가했다.
- 게임용 `Game`, `GameSession`, `GameRecord` 모델을 추가했다.
- UTC `timestamptz`, FK, UNIQUE, CHECK, partial UNIQUE와 랭킹 index를 migration에 정의했다.
- number-click 규칙 버전 1 게임 row를 초기 migration과 idempotent seed에 정의했다.

검증

- `pnpm lint`: PASS.
- `pnpm format:check`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm test`: PASS — 11 files, 102 tests.
- `pnpm test:coverage`: PASS — statements 98.77%, branches 92.78%, functions 100%, lines 98.69%.
- `pnpm test:e2e`: PASS — 6 tests, 320×700, 390×844, 1280×800 guest 연습 흐름과 보드 overflow·44px cell 검증.
- `pnpm build`: PASS.
- `pnpm exec prisma validate`: PASS.
- `pnpm test:integration`: BLOCKED — 실제 PostgreSQL과 `DATABASE_URL_TEST`가 없어 global setup에서 중단됐다.
- 실제 migration 적용: NOT RUN — PostgreSQL 인스턴스가 없었다.
- 실제 Discord OAuth 수동 검증: NOT RUN — Discord application 자격 증명이 없었다.

Acceptance Criteria

- shuffle, replay, 페널티, 최종 기록, KST 기간과 ranking ordering unit 검증: PASS.
- 비로그인 연습 완료와 저장되지 않음 안내, 320/390/1280 레이아웃: PASS.
- 서버 보드·session·record·랭킹·OAuth 구현: 코드와 schema에 반영됨.
- migration 적용, PostgreSQL 동시 완료, 랭킹 SQL, 실제 OAuth와 공식 플레이 E2E: 환경 또는 test 기반 부족으로 미검증.

남은 사항

- 상단 `다음 작업 우선순위`의 환경 구성, integration/E2E 보강과 실제 OAuth QA가 필요하다.
