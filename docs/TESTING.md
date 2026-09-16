# JGD.GG 테스트 전략

문서 책임: 테스트 계층, 환경 격리, fixture, 필수 시나리오, 품질·출시 게이트를 정의한다.

## 1. 목표

테스트는 다음 위험을 우선 막는다.

1. 점수와 랭킹 계산 오류
2. session 소유권·상태·만료 우회
3. 동시 완료의 중복 기록
4. KST 날짜·주 경계 오류
5. Discord identity 중복과 개인정보 저장
6. 모바일에서 게임을 완료할 수 없는 UI 회귀

모든 구현 세부를 고정하는 것이 아니라 공개 행동과 도메인 불변식을 고정한다.

## 2. 도구

| 계층 | 도구 | 실행 환경 |
|---|---|---|
| Unit | Vitest | Node, pure domain |
| Component | Vitest + Testing Library + jsdom | UI state와 접근성 |
| API/Integration | Vitest + 실제 PostgreSQL test DB | Prisma, transaction, Route Handler/service |
| E2E | Playwright | 실제 Next.js test server + PostgreSQL |
| Static | TypeScript strict, ESLint, Prettier check | 전체 코드 |
| Build | Next.js production build | production 설정 검증 |

SQLite나 in-memory DB를 PostgreSQL integration 대체로 사용하지 않는다. partial index, row lock, timestamptz, window query가 핵심이기 때문이다.

## 3. 테스트 디렉터리

~~~text
src/
  features/**/domain/*.test.ts
  features/**/components/*.test.tsx
tests/
  integration/
    auth/
    game-session/
    points/
    ranking/
  e2e/
    guest-practice.spec.ts
    official-number-click.spec.ts
    ranking.spec.ts
  fixtures/
    discord-profiles.ts
    records.ts
  helpers/
    database.ts
    auth.ts
    clock.ts
~~~

unit test를 실제 코드에서 멀리 떨어뜨리지 않는다. cross-feature integration과 E2E만 tests 아래 둔다.

## 4. 테스트 환경 변수

| 변수 | 목적 |
|---|---|
| DATABASE_URL_TEST | 전용 PostgreSQL test database |
| BETTER_AUTH_SECRET_TEST | test 전용 고정 secret |
| BETTER_AUTH_URL | E2E server origin |
| E2E_AUTH_MODE | test에서만 mock-discord |
| E2E_PORT | E2E 전용 Next.js server port, 기본 3000 |
| ALLOW_TEST_DATABASE_RESET | 명시적 true일 때만 test DB 초기화 |

안전장치:

- NODE_ENV가 test가 아니면 E2E_AUTH_MODE=mock-discord로 시작 실패한다.
- production build 또는 production hostname에서 test auth path는 404다.
- reset helper는 DATABASE_URL_TEST만 읽는다.
- database 이름이 _test 또는 _test_worker_N suffix가 아니면 reset을 거부한다.
- DATABASE_URL과 DATABASE_URL_TEST가 같으면 즉시 실패한다.
- test output에 secret이나 전체 connection string을 출력하지 않는다.
- 기존 개발 server와 병렬 실행이 필요하면 `E2E_PORT`에 비점유 port를 지정한다. `pnpm test:e2e`는 `.next-e2e` build output의 전용 Next.js server를 직접 시작하고, 실행 완료·실패·중단 후에는 그 process tree만 종료하므로 개발 server의 `.next` lock과 공유하지 않는다.

## 5. DB 격리

권장 local/CI 방식:

1. 별도 PostgreSQL database를 준비한다.
2. suite 시작 전에 prisma migrate deploy를 실행한다.
3. integration test는 file parallelism을 제한하거나 worker별 test database를 쓴다.
4. 각 test는 fixture를 명시적으로 만들고 종료 시 application table을 FK 안전 순서로 정리한다.
5. 동시성 test는 실제 별도 DB connection 두 개를 사용한다.

transaction rollback만으로 모든 test를 감싸지 않는다. 완료 동시성, Better Auth session, 다른 connection visibility를 검증해야 하기 때문이다.

production data dump를 fixture로 쓰지 않는다.

## 6. Clock과 randomness

- period 함수는 now를 argument로 받아 fake timer 없이도 unit test할 수 있게 한다.
- application service는 clock interface 또는 함수 주입으로 DB now와 test 시간을 통제한다.
- production 완료 transaction의 최종 achievedAt은 DB clock을 사용한다.
- test는 board generator에 deterministic random source를 주입할 수 있다.
- production dependency wiring은 Node crypto source만 사용한다.
- test-only minimum duration 변경은 금지한다. clock을 이동해 3000ms 조건을 만족시킨다.
- fake timer가 performance.now와 Date를 다르게 움직이는지 명시적으로 검증한다.

## 7. Discord OAuth test

CI에서 Discord 실제 endpoint나 실제 계정을 사용하지 않는다.

### 7.1 Unit

Discord profile mapping 함수에 fixture를 넣는다.

- 일반 username, global_name, custom avatar
- global_name null
- avatar null
- email null
- profile에 실제 email이 존재해도 placeholder 저장
- 잘못된 id, username 길이, avatar host

### 7.2 Integration

Better Auth와 같은 OAuth callback 계약을 가진 local mock provider를 test 환경에서만 활성화한다.

- state 발급·검증
- code exchange fixture
- 신규·반복 identity
- profile 갱신
- session cookie
- callback 뒤 token null

mock provider endpoint와 test login helper는 NODE_ENV=test와 E2E_AUTH_MODE=mock-discord가 동시에 참일 때만 존재한다. production bundle smoke test에서 endpoint가 404인지 검증한다.

### 7.3 E2E

Playwright helper가 mock provider를 통해 로그인하고 storage state를 얻는다. DB에 session row와 cookie를 임의 조합하는 방식만으로 OAuth E2E를 대체하지 않는다.

실제 Discord sandbox smoke는 출시 전 운영자가 수동으로 한 번 수행한다.

## 8. Unit test 기준

필수 대상:

- shuffle invariant
- number-click event replay
- penalty와 final score
- 개인 최고 comparator
- ranking comparator
- KST today/week/all boundary
- returnTo sanitizer
- Discord profile mapper
- score formatter
- game state reducer
- API Zod schema의 경계값
- 포인트 정책 적용 시각, KST 일일 경계와 10P·50P 결정

원칙:

- 입력/출력과 edge case를 테스트한다.
- private 함수 호출 순서나 Tailwind class 전체 snapshot을 고정하지 않는다.
- randomness distribution처럼 flaky한 assertion을 만들지 않는다.
- timezone test는 process timezone에 독립적이어야 한다.

coverage gate:

- src/features/*/domain, src/lib/time, auth sanitizer/mapper는 line 95%, branch 90% 이상
- 전체 저장소 숫자를 맞추기 위한 무의미한 test는 작성하지 않는다.
- 보안·점수 분기는 퍼센트와 무관하게 전부 명시 test한다.

## 9. Component test 기준

라운지:

- KST 자정의 주제 변경과 같은 날짜의 일관성, 14일 주기
- 대화 종류 선택, 선택한 내용 복사, 성공 상태 초기화, 클립보드 거부 시 직접 복사
- 커뮤니티 기록의 연결 전·실패·실제 빈 목록 구분, 재시도와 응답 schema 검증

number-click:

- 각 상태의 action과 disabled
- countdown 동안 입력 무시
- 올바른 click과 오클릭 표시
- 완료 cell 유지와 재클릭 오클릭
- SUBMITTING 이중 제출 방지
- retry가 같은 payload 사용
- practice와 official 결과 문구
- focus가 FINISHED/ERROR heading으로 이동

ranking:

- tab keyboard 동작
- loading, empty, error
- viewer row 강조
- top 밖 viewer card
- 긴 displayName ellipsis에 accessible full name

points:

- loading, 0P 빈 원장, 적립·회수 목록
- 조회 실패와 다시 불러오기 복구
- 증감 부호, 사유와 시각을 색 외 텍스트로 제공

접근성:

- Testing Library role/name query를 우선한다.
- 자동 axe 검사 도입은 dependency 검토 후 가능하지만 수동 keyboard E2E를 대체하지 않는다.

## 10. API/Integration 필수 matrix

스토리 테스트는 [features/stories.md](features/stories.md)의 Acceptance Criteria에 대응한다. `src/features/stories/server/image.test.ts`, `components/story-strip.test.tsx`, `tests/integration/stories/stories.integration.test.ts`, `tests/e2e/stories.spec.ts`에서 비로그인 접근, BANNED·Origin, 크기·실제 이미지 검증, 중복/동시 게시·한도, 정확한 24시간 경계, 원본 보관·cascade, 미리보기·재시도·dialog focus와 desktop/mobile/compact 흐름을 검증한다. 이미지 성공 응답은 JSON envelope 대신 JPEG와 X-Request-Id header를 검사한다.

### 10.1 공통

- content type, strict body, body size
- auth missing/expired
- BANNED
- foreign Origin
- requestId 성공·오류
- 예상하지 못한 오류의 redaction

### 10.2 Session

- create, create replay, create conflict
- start, start replay, READY expiry
- new session이 old live session ABANDONED
- abandon idempotency
- 다른 user의 모든 operation 404

### 10.3 Complete

- normal record
- mistake 계산
- malformed 400은 session 유지
- domain invalid 422는 REJECTED
- minimum 2999/3000
- maximum 300000/300001
- server/client clock 관계
- expiry
- duplicate sequential
- two concurrent requests
- GameRecord unique, exact column values
- rank 조회 실패와 record commit 유지

### 10.4 Ranking

- user당 최고 하나
- today/week/all boundaries
- tie-breaker 전체
- old rules, invalid record, BANNED user 제외
- viewer 안/밖/null
- pagination validation
- viewer가 요청 페이지 앞/안/다음 페이지 확인용 한 행/뒤에 있어도 items·hasMore 정확성
- no-store header

### 10.5 Auth

AUTH.md의 테스트 절을 모두 포함한다.

### 10.6 Points

- 기존 user backfill과 신규 user 0P 계정 자동 생성
- 정책 적용 시각 전·경계, KST 날짜 경계
- 공식 완료당 10P, 하루 최대 50P와 여섯 번째 기록 0P
- 같은 GameRecord의 순차·동시 replay가 EARN 한 건
- balance와 원장 합계 불일치 시 완료·적립 전체 rollback
- balance 음수와 같은 type/GameRecord 중복의 DB 제약
- 기록 무효화 시 원본 EARN 보존, REVERSAL 한 건과 0 미만 방지
- BANNED 본인 조회 허용과 새 공식 완료 적립 차단
- 본인 조회 DTO에 타인 userId, 내부 무효화 사유와 GameRecord id 미노출

## 11. E2E 필수 흐름

게임 프로필은 [features/game-profiles.md](features/game-profiles.md)의 GP-1~8을 검증한다.

| 수락 기준 | 테스트 |
|---|---|
| GP-1·2·5·6·7 | `tests/integration/game-profiles/game-profiles.integration.test.ts`: CRUD·소유권·추가 필드·Origin·크기·동시 저장·rollback·필터·페이지·DB 제약·cascade |
| GP-2 | `src/features/game-profiles/schemas/profile.test.ts`: 필수·선택·길이·중복·지원 게임·숨은 문자·추가 필드 |
| GP-4 | `src/lib/auth/guild-membership.test.ts`: canonical ID 응답 일치·60초 만료·pending/bot/guest·잘못된 응답·설정 누락·429/5xx·timeout 오류·mock test guard |
| GP-3·8 | game-profiles component 테스트: 사용자 입력 표시·입력 유지·재시도·취소·삭제 확인·이중 제출·권한 상실 |
| GP-1·3·4·6·8 | `tests/e2e/game-profiles.spec.ts`: 실제 mock OAuth·PostgreSQL·desktop/mobile/320px 등록·수정·필터·삭제·비로그인/비멤버 차단 |

한글 페이지 주소는 같은 E2E에서 `/내정보`·`/멤버`의 로그인 복귀·메뉴 활성 표시와 기존 `/me`·`/members`의 308 이동·query 보존·프로필 fragment 보존을 검증한다. `return-to.test.ts`는 한글·인코딩된 내부 주소가 중복 인코딩되지 않는지 확인한다.

실제 Discord를 CI에서 호출하지 않는다. membership unit은 외부 HTTP만 fixture로 대체하며 integration은 canonical 계정 조회·권한·DB를 실제로 검증한다. 실제 bot token 설정·멤버/비멤버 확인은 배포 전 수동 smoke 대상이다.

### 11.1 Guest

라운지 추가 흐름 (`tests/e2e/lounge.spec.ts`):

- 홈에서 오늘의 이야기 → 주제 종류 변경 → 복사 → 주간 랭킹 이동
- desktop/mobile/compact 메뉴 이동과 모바일 메뉴 닫기
- 320px/390px/1280px 가로 overflow, 본문 건너뛰기, reduced motion, 이용 가이드 펼침
- 클립보드 E2E는 브라우저 API를 대체해 전달 내용을 확인한다. 실제 권한 허용/거부는 component와 별도 브라우저 QA로 확인한다.

1. /games/number-click 접속
2. 연습 시작
3. board 완료
4. 연습 기록과 저장 안 됨 확인
5. 로그인 CTA 확인
6. 랭킹 공개 열람

### 11.2 Official desktop

1. mock Discord login
2. game 페이지
3. create와 start
4. 오클릭 1회
5. 1~25 완료
6. 실제 시간 + 500ms 결과
7. 개인 최고와 순위
8. +10P 적립 결과와 header·/내정보 확정 잔액·최근 내역
9. 다시 하기
10. 새 session/board 확인

### 11.3 Official mobile

- 390×844에서 official 핵심 흐름
- board overflow 없음
- touch target 기준
- 결과와 다시 하기 접근 가능
- 적립 결과가 가로 overflow 없이 표시됨

### 11.4 Retry

- complete response를 browser layer에서 한 번 유실
- 기록 다시 전송
- 같은 result 반환
- DB record 한 건

### 11.5 Ranking

- period tab과 URL
- 새 완료 후 내 row
- top 밖 viewer fixture
- empty fixture

## 12. 수동 QA

출시 전 최소:

- 실제 Discord application local 또는 staging 로그인
- 로그인 취소, 재시도, 로그아웃
- Discord 이름·avatar 변경 뒤 재로그인 갱신
- Chrome desktop
- 최신 Android Chrome 또는 실제 touch device
- iOS Safari 가능하면 실제 device
- keyboard-only 핵심 흐름
- 200% zoom
- prefers-reduced-motion
- 느린 네트워크에서 start/complete 상태
- 두 tab에서 공식 시작과 이전 tab 완료

수동 QA 결과는 날짜, 환경, browser, pass/fail, issue link로 남긴다.

### 게임 프로필 QA — 2026-09-16

- 페이지 한글화 후 unit/component 180개, 전체 E2E 24개 PASS/기존 비대상 6개 skip, lint·format check·typecheck·production build PASS. 별도 로컬 production 서버에서 기존 두 주소의 308·query 보존과 한글 페이지의 로그인 복귀 주소를 확인했다. API·DB 계약 변경은 없으며 이번 주소 변경에서 integration은 재실행하지 않았다.
- 최초 한글 폴더 직접 라우팅은 개발 서버에서 404가 발생했다. 영문 내부 페이지에 한글 URL rewrite를 적용해 수정했다. 최초 전체 E2E는 경로 관련 4건과 설정 변경·서버 재시작 중 스토리 1건이 실패했으며, 변경 완료 후 테스트·timeout 완화 없이 단독 전체 재실행해 통과했다. 최초 typecheck의 이전 경로 생성 타입 오류도 Next 타입 재생성 후 통과했다.
- GP-1~8 관련 schema·component·membership unit과 PostgreSQL integration PASS. 전체 unit/component 178개, integration 39개 PASS.
- 전체 E2E 24개 PASS/기존 비대상 조합 6개 skip. 게임 프로필은 desktop 1280×800, mobile 390×844, compact 320×700에서 등록·새로고침 후 유지·수정·게임 항목 제거·필터·삭제·권한 차단을 검증했다.
- desktop/mobile 카드와 compact 입력 화면 screenshot을 확인했다. 티어 선택 안내 줄바꿈·단일 카드 폭을 조정한 뒤 전체 E2E를 다시 통과했다.
- production build PASS. 별도 로컬 production 모드에서 mock OAuth 404, 비로그인 `/api/v1/game-profiles`와 `/api/v1/me/game-profile` 401 확인. 실제 bot/API·실기기·실서비스 DB 적용은 미검증이다.
- lint·format check·typecheck PASS. 최초 typecheck의 테스트 query 옵션 오류는 수정 후 재검증했다. 최초 production smoke 명령의 빈 `E2E_AUTH_MODE`는 env 검증에 거부됐으며, 변수를 제거한 정상 production 설정으로 재검증했다.

### 스토리 UI QA — 2026-09-14 정리

- 프로필 목록 변경 뒤 320×700, 390×844, 1280×800에서 로그인·비로그인에 같은 작성자 아바타 표시, 클릭 전 팝업 없음, 스토리/추가 클릭 시 로그인 팝업, Escape·focus 복구, 비로그인 사진 요청 없음과 직접 이미지 API 401을 검증했다. component는 아바타 로드 실패 fallback을, integration은 공개 DTO·만료·차단 작성자 제외를 검증한다.
- Discord CDN은 로컬 아바타 fixture로 대체한 브라우저 검증이며 실제 업로드 사진은 API로 읽는다. desktop 비로그인 목록과 mobile 로그인 팝업 screenshot을 시각 확인했다.
- 로컬 mock Discord와 Playwright Chromium의 320×700, 390×844, 1280×800에서 사진 선택·미리보기·게시·열람·Escape 닫기·focus 복구·가로 overflow 검증 PASS.
- desktop 스토리 목록과 compact 뷰어 screenshot을 시각 확인했다. 발견한 dialog 좌측 정렬은 `margin: auto`로 수정하고 관련 E2E 3개가 PASS했다.
- API와 실제 PostgreSQL로 정확한 24시간 만료, 이미지 주소 접근 거부, 원본 byte 보존, 동시 게시·재전송과 한도를 검증했다.
- 실제 Discord 계정으로 사진을 게시하거나 실기기 Safari/Android를 검증하지는 않았다.

### 스토리 묶음·자동 재생 QA — 2026-09-15

- `story-playback.test.tsx`: 이미지 로드 완료 전 대기, 로드 후 5초 경계, 부모 갱신 시 경과 시간 유지, 일시정지·숨겨진 탭의 남은 시간 재개, 이미지 오류 중 자동 넘김 중단, 좌우 버튼·방향키와 종료 후 이벤트 정리 PASS.
- `story-strip.test.tsx`: 작성자당 프로필 하나, 게시 순서 재생, 수동 이전 뒤 5초 초기화, 다음 작성자 이동과 마지막 자동 닫기·원래 버튼 focus 복구 PASS. 기존 비로그인 팝업·24시간 만료·게시 재시도 검증 유지.
- `stories.integration.test.ts`: 같은 표시 이름의 서로 다른 31명·62장을 작성자별 30명/1명 페이지로 나누고 각 작성자의 두 사진이 같은 페이지에 시간순으로 포함됨을 검증 PASS. 공개 DTO와 이미지 인증·보존 검증 유지.
- `tests/e2e/stories.spec.ts`: 실제 사진 두 장 게시 후 단일 프로필, 사진 로드·자동 다음 사진, 좌우 영역 클릭·진행 표시·일시정지, 비로그인 단일 프로필과 로그인 팝업을 320×700, 390×844, 1280×800에서 검증 PASS. compact 뷰어 screenshot을 시각 확인했다. 실제 기기 QA는 미실행이다.

### 기존 라운지 UI QA — 2026-09-10

Windows 로컬 개발 서버, Playwright Chromium에서 확인했다. 기록 목록의 운영 데이터와 실제 OAuth 검증을 대신하지 않는다.

| 시나리오 | 결과 | 범위 |
|---|---|---|
| 320×700 / 390×844 / 1280×800 | PASS | 라운지 탐색·복사, 주간 진입, 메뉴 닫기, 연습 완료, 가로 넘침·보드 44px |
| 768×1024 / 1440×900 | PASS | 화면 캡처와 실제 레이아웃 확인 |
| 200% CSS 확대 | PASS | container query로 콘텐츠 재배치, 중앙·보조 열 겹침 방지; 브라우저 자체 zoom 검증은 별도 |
| 키보드 / reduced motion | PASS | 본문 건너뛰기, 게임 핵심 테스트, 비필수 모션 축소 |
| 실제 클립보드 | PASS | 격리된 Chromium의 권한 허용 후 복사 문자열 일치 |
| 실제 Discord 로그인·공식 기록 | PASS (2026-09-11) | 로컬 `http://localhost:3000`, Codex in-app browser에서 실제 계정의 공식 플레이 완료와 개인 최고·오늘·주간·전체 랭킹 반영 확인 |
| 실제 Discord 계정 포인트 적립 | PASS (2026-09-13) | 로컬 `http://localhost:3000`, Codex in-app browser의 기존 실제 인증 세션에서 공식 완료당 10P, 완료 결과와 같은 화면 header의 확정 잔액 갱신, `/me` 잔액·최신 원장 일치를 확인 |
| 실제 Discord 로그인 취소·로그아웃·프로필 갱신 | USER-REPORTED (2026-09-11) | 사용자가 수동 QA 수행을 보고함; pass/fail 및 브라우저별 세부 결과는 별도 기록 필요 |
| 로그인 후 keyboard-only 공식 흐름 | PASS (2026-09-12) | 로컬 `http://localhost:3000`, Codex in-app browser의 기존 인증 세션에서 게임 시작과 1~25 입력을 Enter로 완료했다. 결과 heading으로 focus가 이동하고 개인 최고·오늘·주간·전체 순위가 표시됐다. |
| 실제 브라우저 200% zoom | BLOCKED (2026-09-12) | Codex in-app browser에서 확대 단축키가 유효 viewport를 변경하지 않아 검증할 수 없었다. Chrome/Edge 또는 지원 브라우저에서 별도 확인이 필요하다. |

로컬 3000 포트의 기존 개발 서버가 실행 중이면 기본 E2E 명령은 포트 충돌로 중단된다. 이번 QA는 Git 제외된 임시 Playwright 설정에서 `reuseExistingServer: true`로 해당 서버를 사용했으며 저장소의 기본 서버 격리 설정은 유지했다.

## 13. 성능 test

release candidate에서 production 유사 PostgreSQL에 합성 데이터를 넣는다.

- user 100,000
- GameRecord 1,000,000
- 활성 rulesVersion과 이전 version 혼합
- 최근 하루/주/전체 분포

측정:

- today/week/all top 100
- top 100 밖 viewer
- 개인 best
- EXPLAIN ANALYZE BUFFERS plan

목표는 ARCHITECTURE.md를 따른다. 성능 fixture는 production 개인정보를 포함하지 않는다.

재현 명령은 `pnpm test:performance`, 소규모 도구 점검은 `pnpm test:performance --quick`이다. 로컬 별도 테스트 DB에 실행별 스키마를 만들며 기존 public 데이터는 변경하지 않는다. 서비스 실제 SQL의 EXPLAIN, 포인트 포함 완료 transaction, 격리 스키마 backup/restore를 포함한다. 표본 수·분포·한계·복구 절차는 [DB_OPERATIONS.md](DB_OPERATIONS.md)를 따른다. 원격/운영 DB 실행은 이 자동화가 허용하지 않는다.

최근 실행 환경·수치·회귀 test·남은 출시 검증은 [PERFORMANCE_RESULTS.md](PERFORMANCE_RESULTS.md)에 기록한다.

## 14. 명령 계약

package.json에 다음 script 이름을 제공한다.

~~~text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:integration
pnpm test:e2e
pnpm build
~~~

권장 범위:

- pnpm test: unit + component
- pnpm test:integration: 실제 test DB 필요
- pnpm test:e2e: test server와 DB 필요
- pnpm build: production env shape와 test route 비활성 검증

script가 없거나 이름이 바뀌면 AI_RULES.md와 CI를 같은 변경에서 갱신한다.

## 15. 완료 게이트

### 15.1 작은 pure UI 변경

- lint
- format:check
- typecheck
- 관련 unit/component test
- 영향 viewport 수동 확인

### 15.2 기능·API·DB 변경

- lint
- format:check
- typecheck
- 전체 unit/component
- 전체 integration
- 관련 E2E
- build
- migration review

### 15.3 출시

- 위 전체
- 전체 E2E desktop/mobile
- performance smoke
- 실제 Discord staging login
- migration backup/restore 또는 forward-fix 계획
- 수동 QA

하나라도 실패하면 완료로 보고하지 않는다. 환경 문제라면 실패 command와 오류, 시도한 해결, 미검증 범위를 명시한다.

## 16. Acceptance Criteria 추적

각 pull request 또는 AI 작업 보고에는 구현한 문서의 checkbox를 나열하고 대응 test 이름을 적는다.

예:

~~~text
AC: duplicate complete가 record 한 건
Test: complete.concurrent.integration.test.ts
Result: PASS
~~~

한 test가 여러 AC를 검증할 수 있지만 모호하게 전체 테스트 통과라고만 쓰지 않는다.

## 17. Testing Acceptance Criteria

- [ ] unit, component, PostgreSQL integration, Playwright E2E가 분리돼 있다.
- [ ] test DB reset이 production DB에서 실행될 수 없다.
- [ ] Discord 실제 API와 실제 계정을 CI에서 사용하지 않는다.
- [ ] clock과 randomness를 결정적으로 제어한다.
- [ ] 동시 완료는 실제 여러 DB connection으로 검증한다.
- [ ] desktop/mobile 공식 흐름과 guest 흐름이 있다.
- [ ] package script와 CI gate가 문서의 이름과 일치한다.
- [ ] 실패한 test나 미실행 gate를 완료 보고에서 숨기지 않는다.
- [ ] 포인트 정책 경계, 동시 멱등성, 원장 정합성, 회수와 본인 조회가 실제 PostgreSQL·component·E2E로 검증된다.
