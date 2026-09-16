# JGD.GG 시스템 아키텍처

문서 책임: 기술 스택, 실행 경계, 코드 구조, 의존 방향, 비기능 기준을 정의한다.

## 1. 아키텍처 결정

MVP는 하나의 Next.js 애플리케이션과 하나의 PostgreSQL 데이터베이스로 구성하는 modular monolith다. UI, HTTP Route Handler, 인증 통합, 도메인 서비스는 한 저장소와 한 배포 단위에 둔다.

~~~text
Browser
  ├─ Server-rendered public pages
  ├─ number-click Client Component
  └─ JSON calls under /api/v1
          │
Next.js Node.js application
  ├─ Route Handlers: auth, validation, response mapping
  ├─ Application services: session, completion, ranking
  ├─ Domain functions: scoring, event replay, period calculation
  ├─ Better Auth: Discord OAuth and web sessions
  └─ Prisma data access
          │
PostgreSQL
  ├─ Better Auth tables
  ├─ Game / GameSession / GameRecord
  └─ constraints and ranking indexes
~~~

별도 백엔드, queue, cache, websocket, Redis는 없다.

## 2. 최종 기술 스택

버전 기준일은 2026-09-06이다. 구현 시작 시 아래 major 범위의 최신 patch를 설치하고 lockfile에 정확한 버전을 고정한다.

| 영역 | 선택 | 버전 정책 | 이유 |
|---|---|---|---|
| Runtime | Node.js | 24 LTS | 현재 LTS이며 운영 안정성과 도구 호환성이 좋다. Current 릴리스인 Node 26은 MVP 기준으로 사용하지 않는다. |
| Package manager | pnpm | 현재 stable 고정 | 빠르고 lockfile이 명확하며 AI 변경 diff가 작다. 저장소의 packageManager 필드로 고정한다. |
| Full stack | Next.js App Router + TypeScript strict | 16.3.x, 최초 설치는 16.3.3 이상 보안 patch | Active LTS 한 배포 단위에서 Server Component, Client Component, Route Handler를 사용한다. |
| UI | React, Tailwind CSS | React 19.2 Next.js 호환 patch, Tailwind 4.3.x | 인터랙티브 보드와 반응형 UI를 단순하게 구현한다. Tailwind 4의 CSS-first 토큰을 사용한다. |
| Authentication | Better Auth | 1.7.2부터 시작, 1.7.x 보안 patch만 허용 | 2026년 신규 프로젝트 기준으로 Next.js, Discord, Prisma가 공식 지원되고 Auth.js에서의 신규 이전 방향과 맞는다. |
| Database | PostgreSQL | 18 managed instance 권장 | 트랜잭션, partial unique index, window function으로 세션과 랭킹을 해결한다. |
| ORM | Prisma ORM | 7.x stable 고정 | Better Auth의 현재 안정 Prisma 가이드와 맞고 schema/migration이 AI에게 명확하다. Prisma 8은 별도 호환성 검증 전 업그레이드하지 않는다. |
| Validation | Zod | stable 고정 | 환경 변수와 API 경계 스키마를 같은 TypeScript 코드로 검증한다. |
| Date/time | date-fns + @date-fns/tz | stable 고정 | Asia/Seoul 기간 경계를 한 모듈에서 명시적으로 계산한다. |
| Unit/API tests | Vitest | stable 고정 | TypeScript 순수 함수와 application service 테스트를 빠르게 실행한다. |
| Component tests | Testing Library | stable 고정 | 사용자 관점의 상태·접근성 동작을 검증한다. |
| E2E | Playwright | stable 고정 | Chromium 데스크톱과 모바일 viewport의 전체 흐름을 검증한다. |
| Lint/format | ESLint + Prettier | Next.js 호환 stable | 자동화 가능한 품질 기준을 제공한다. |

UI 컴포넌트 라이브러리, 전역 상태 라이브러리, TanStack Query는 MVP 기본 dependency가 아니다. 실제 중복이나 상태 복잡성이 입증되기 전 추가하지 않는다.

## 3. 버전 고정과 업그레이드

- package.json의 packageManager, engines.node, dependency 버전을 명시한다.
- 초기 Node.js pin은 24.20.0이며 24 LTS 안의 보안 patch는 검증 후 올린다.
- pnpm-lock.yaml을 커밋한다.
- major 업그레이드는 기능 개발과 분리한다.
- Better Auth와 Prisma 중 하나를 major 업그레이드할 때 schema diff, migration, 로그인, 세션, 전체 E2E를 검증한다.
- Prisma 8로의 이동은 Better Auth 안정 adapter가 공식 호환을 명시하고 기존 transaction/raw query 테스트가 통과할 때만 한다.
- 보안 patch는 같은 major 안에서 우선 적용한다.

## 4. 렌더링과 클라이언트 경계

### 4.1 Server Component 기본

페이지와 정적 설명, 초기 랭킹, 로그인 상태 기반 요약은 Server Component가 기본이다. 서버에서 DB나 인증을 읽고 필요한 표시 데이터만 직렬화한다.

### 4.2 Client Component 허용 범위

다음만 Client Component로 둔다.

- number-click 상태 머신과 performance.now 기반 타이머
- 보드 입력 처리
- 랭킹 탭의 클라이언트 갱신
- 로그인·로그아웃처럼 브라우저 상호작용이 필요한 컨트롤
- 공통 메뉴의 현재 경로 표시와 모바일 메뉴 닫기
- 라운지 대화 주제 선택·클립보드 복사와 공개 랭킹 재시도
- 멤버 사진 스토리 업로드·미리보기·열람 dialog와 만료 갱신
- 게임 프로필 입력·저장·삭제와 멤버 목록 필터·페이지 이동

Client Component에 Prisma, secret, DB model 전체 객체를 import하지 않는다.

### 4.3 API 사용

게임 시작·완료처럼 권한, validation, 트랜잭션이 필요한 변경은 /api/v1 Route Handler를 거친다. Server Action과 Route Handler 두 방식으로 같은 mutation을 중복 구현하지 않는다. MVP의 외부 JSON 계약은 API.md가 정하므로 해당 mutation에는 Route Handler를 사용한다.

## 5. 권장 소스 구조

~~~text
/
├─ docs/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (public)/
│  │  │  ├─ page.tsx
│  │  │  ├─ games/number-click/page.tsx
│  │  │  └─ rankings/number-click/page.tsx
│  │  ├─ (account)/me/page.tsx       # /내정보를 rewrite해 제공
│  │  ├─ (account)/members/page.tsx  # /멤버를 rewrite해 제공
│  │  ├─ api/auth/[...all]/route.ts
│  │  ├─ api/v1/
│  │  ├─ auth/error/page.tsx
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ layout/
│  │  └─ ui/
│  ├─ features/
│  │  ├─ number-click/
│  │  │  ├─ components/
│  │  │  ├─ client/
│  │  │  ├─ domain/
│  │  │  ├─ server/
│  │  │  └─ schemas/
│  │  └─ ranking/
│  │     ├─ components/
│  │     ├─ domain/
│  │     ├─ server/
│  │     └─ schemas/
│  ├─ lib/
│  │  ├─ auth/
│  │  ├─ db/
│  │  ├─ env/
│  │  ├─ http/
│  │  ├─ time/
│  │  └─ logging/
│  └─ generated/prisma/
├─ tests/
│  ├─ integration/
│  ├─ e2e/
│  ├─ fixtures/
│  └─ helpers/
└─ public/
~~~

기능 전용 코드가 세 군데 이상에서 재사용되지 않으면 lib로 이동하지 않는다.

## 6. 계층과 의존 방향

~~~text
UI / Route Handler
        ↓
Application service
        ↓
Pure domain function
        ↓
Data access abstraction limited to that feature
        ↓
Prisma / PostgreSQL
~~~

규칙:

- domain은 React, Next.js, Prisma에 의존하지 않는다.
- Route Handler는 body parsing, auth, application service 호출, HTTP mapping만 담당한다.
- application service는 트랜잭션 경계와 use case 순서를 담당한다.
- Prisma model을 API response로 직접 반환하지 않는다.
- feature가 다른 feature의 내부 파일을 deep import하지 않는다. 공개 barrel도 무분별하게 만들지 않는다.
- 공통화는 실제 두 번째 사용처가 생긴 뒤 한다.

## 7. 주요 런타임 흐름

### 7.1 공식 게임 시작

1. Route Handler가 Better Auth 세션을 확인한다.
2. request schema와 idempotency key를 검증한다.
3. transaction에서 만료된 ACTIVE session을 EXPIRED로 바꾸고, 다른 ACTIVE session을 ABANDONED로 바꾼다.
4. cryptographic random으로 1~25 순열을 생성한다.
5. READY GameSession을 만들고 public session DTO와 board를 반환한다.
6. 클라이언트 countdown이 끝나면 start API가 상태를 PLAYING으로 원자 변경한다.

READY와 PLAYING을 나누는 이유는 네트워크 응답 시간을 플레이 시간 검증 기준에서 분리하기 위해서다.

### 7.2 공식 게임 완료

1. 인증 사용자를 확인한다.
2. 입력 이벤트 schema를 검증한다.
3. DB transaction에서 session row를 FOR UPDATE로 잠근다.
4. 이미 COMPLETED이면 기존 record 결과를 그대로 반환한다.
5. 소유자, 게임, 상태, 만료를 검증한다.
6. 저장한 board와 제출 이벤트를 재생해 오클릭과 완료 여부를 서버에서 계산한다.
7. 클라이언트 경과 시간과 서버 시간의 현실성 규칙을 검증한다.
8. GameRecord를 만들고 GameSession을 COMPLETED로 바꾼다.
9. 개인 최고·현재 순위를 조회해 응답한다.

### 7.3 랭킹

1. period를 Asia/Seoul 반개구간 UTC 경계로 바꾼다.
2. 유효하고 활성 규칙 버전인 기록만 선택한다.
3. 사용자별 window row_number로 최고 한 건을 고른다.
4. 그 결과를 전체 정렬해 순위를 붙인다.
5. 상위 목록과 로그인 사용자의 행을 반환한다.

## 8. 상태와 캐시

스토리 이미지 처리는 `sharp 0.35.4`를 직접 의존한다. 기존 Next.js에 포함된 동일 버전이며 Apache-2.0이다. Node 서버에서 실제 디코딩·픽셀 제한·메타데이터 제거·표시용 JPEG/썸네일을 만든다. 클라이언트 bundle에는 포함하지 않는다. MIME 또는 파일 signature만 확인하는 대안은 손상된 파일과 디코딩 자원 제한을 충분히 처리하지 못한다. raw 원본과 파생 이미지는 기존 PostgreSQL에 저장해 외부 storage 운영을 추가하지 않으며, 누적 용량이 커지면 별도 storage 이전을 검토한다.

스토리 이미지는 인증 cookie가 필요한 API를 `Image unoptimized`로 직접 요청해 Next.js 공용 이미지 최적화 cache를 거치지 않는다. 원본은 사용자 API에서 제공하지 않고, 모든 목록·이미지 조회에서 만료를 확인한다. 원본 보관 정책이므로 cleanup worker나 scheduled job은 필요하지 않다.

- 플레이 상태는 브라우저 컴포넌트의 reducer/state machine에 둔다.
- 인증·공식 세션·기록의 진실은 서버와 DB에 있다.
- 공식 완료 후 클라이언트는 서버 응답을 결과 Source of Truth로 사용한다.
- 개인 최고와 랭킹 GET은 기본적으로 동적 응답이다.
- CDN 또는 Next.js 장기 cache를 MVP에 적용하지 않는다.
- 짧은 private browser cache도 적용하지 않는다. 정확한 즉시 반영이 우선이다.
- Redis 캐시는 측정된 DB 병목과 무효화 설계가 생긴 뒤에만 검토한다.

## 9. 보안 경계

- 모든 /api/v1 mutation은 origin/CSRF 방어, 인증, Zod validation을 거친다.
- 클라이언트의 userId, final score, mistake count, penalty를 받지 않는다.
- session 소유자는 서버 인증 user id로만 비교한다.
- DB unique constraint가 애플리케이션 검사와 함께 중복 기록을 막는다.
- secret과 OAuth token은 서버 전용 모듈 밖으로 노출하지 않는다.
- 오류 응답에 SQL, stack, Discord token, 내부 설정을 포함하지 않는다.
- 보안 상세는 AUTH.md, 게임 검증 상세는 features/number-click.md를 따른다.

## 10. 환경 변수

필수 변수:

| 이름 | 용도 | 클라이언트 노출 |
|---|---|---|
| DATABASE_URL | pooled PostgreSQL 연결 | 금지 |
| DIRECT_DATABASE_URL | migration용 direct 연결, provider가 요구할 때만 | 금지 |
| BETTER_AUTH_SECRET | 세션·암호화 secret, 32 bytes 이상 entropy | 금지 |
| BETTER_AUTH_URL | canonical origin | 금지 |
| DISCORD_CLIENT_ID | OAuth application id | 서버에서만 사용 |
| DISCORD_CLIENT_SECRET | OAuth secret | 금지 |
| DISCORD_BOT_TOKEN | 게임 프로필 멤버 확인용 기존 bot token, 해당 기능에 필요 | 금지 |
| TARGET_GUILD_ID | 게임 프로필의 단일 대상 Discord 서버 ID, 해당 기능에 필요 | 금지 |

테스트 전용 변수는 TESTING.md를 따른다. 환경 변수는 Zod로 검증한다. 공통 필수값 누락은 시작 실패이며, 게임 프로필 전용 두 값은 미설정 시 그 기능만 503으로 차단한다. secret 값을 log하지 않는다. 멤버 검사·메모리 재사용·외부 오류 처리는 AUTH.md를 따른다.

## 11. 오류와 관측성

- 모든 /api/v1 응답에 requestId를 포함한다.
- requestId는 신뢰 가능한 형식의 inbound header가 있으면 사용하고 아니면 서버에서 생성한다.
- 로그는 JSON 한 줄 구조로 level, event, requestId, route, userId 내부값, sessionId, durationMs, errorCode를 기록한다.
- Discord access token, cookie, authorization header, 전체 이벤트 trace는 log하지 않는다.
- 예상된 validation/도메인 오류는 warn 이하, 예상하지 못한 오류는 error와 stack을 서버 log에 기록한다.
- MVP에 외부 APM dependency는 필수가 아니다. 배포 플랫폼 log와 DB 지표로 시작한다.

## 12. 성능 기준

초기 목표는 production 유사 환경의 p95다.

| 작업 | 목표 |
|---|---|
| 게임 페이지 최초 서버 응답 | 800ms 이하, 외부 Discord 호출 없음 |
| session 생성 API | 500ms 이하 |
| 완료 API | 800ms 이하 |
| 랭킹 상위 100 조회 | 500ms 이하 |

네트워크 왕복과 cold start를 분리해 측정한다. 목표 초과 시 먼저 EXPLAIN ANALYZE, query 수, payload를 측정하고 캐시를 추가하지 않는다.

## 13. 배포 원칙

- Node.js runtime을 사용한다. 게임·DB Route Handler를 Edge runtime에 배치하지 않는다.
- 한 Next.js 배포와 한 managed PostgreSQL로 시작한다.
- serverless 배포라면 provider의 pooled DATABASE_URL을 사용하고 migration은 direct URL로 실행한다.
- migration은 애플리케이션 시작 시 자동 실행하지 않는다. 배포 단계에서 prisma migrate deploy를 한 번 실행한다.
- preview 환경은 production Discord redirect URI와 DB를 공유하지 않는다.
- production DB backup과 point-in-time recovery는 managed provider에서 활성화한다.
- hosting provider는 구현 시 하나를 선택해 운영 문서에 기록하되 도메인 코드는 vendor SDK에 의존하지 않는다.

## 14. 금지된 초기 구조

- 별도 Express/Nest API
- GraphQL
- microservice
- Redis session/ranking cache
- repository interface를 모든 model마다 만드는 것
- event bus와 background worker
- 범용 게임 plugin engine
- 아직 없는 server, season, achievement, ad 테이블
- 같은 validation 규칙을 client와 server에 복사

## 15. 기술 결정의 공식 근거

- Next.js App Router와 Route Handler: https://nextjs.org/docs/app
- Next.js Active LTS 정책: https://nextjs.org/support-policy
- Next.js 설치·Node 요구사항: https://nextjs.org/docs/app/getting-started/installation
- Node.js 릴리스 상태: https://nodejs.org/en/about/previous-releases
- Tailwind CSS 4 설치: https://tailwindcss.com/docs/installation/framework-guides
- Better Auth 설치와 Next.js handler: https://better-auth.com/docs/installation
- Better Auth Discord provider: https://better-auth.com/docs/authentication/discord
- Better Auth Prisma adapter: https://better-auth.com/docs/adapters/prisma
- PostgreSQL window function: https://www.postgresql.org/docs/current/functions-window.html
- PostgreSQL index: https://www.postgresql.org/docs/current/indexes.html

## 16. Architecture Acceptance Criteria

- [ ] 애플리케이션은 한 Next.js Node.js 배포 단위다.
- [ ] domain 함수는 framework·DB에 의존하지 않는다.
- [ ] mutation은 API.md의 Route Handler 한 경로로만 구현된다.
- [ ] Prisma와 secret을 Client Component가 import하지 않는다.
- [ ] dependency와 Node/pnpm 버전이 lockfile·package metadata에 고정된다.
- [ ] 공식 플레이 완료가 한 DB transaction에서 처리된다.
- [ ] Redis, queue, 별도 API server가 없다.
- [ ] 환경 변수 검증, 구조화 log, requestId가 구현된다.
