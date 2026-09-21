# JGD.GG 현재 상태

기준일: 2026-09-21

이 문서는 다음 작업을 시작할 때 필요한 현재 구현 상태, 환경 제약과 우선순위를 요약한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)가 안내하는 담당 설계 문서이며, 과거 변경은 Git 이력에 보존한다.

## 구현 상태

- Next.js 기반 애플리케이션과 number-click MVP 코드가 구현돼 있다.
- 공개 `/게임궁합`을 구현했다. 12문항·네 축의 다수결로 16가지 게임 성향 코드와 별명·선택 근거를 보여주고 친구 유형과 비교·결과 복사·답변 수정·초기화를 제공한다. 홈 카드와 공통 메뉴에서 진입하며 로그인·bot·Steam 설정이 필요 없다. 답변은 페이지 메모리에서만 처리한다. 상세 계약은 [게임 성향·궁합](features/game-compatibility.md)을 따른다. 2026-09-21에 `https://jgd.wooram.online/게임궁합`으로 공개 배포했다.
- 수동 게임 프로필 v1을 구현했다. `/내정보#game-profile`에서 LoL·PUBG·Overwatch의 닉네임·선택 티어를 등록·수정·삭제하고 `/멤버`에서 멤버별 카드와 게임 필터·페이지 이동을 제공한다. 모든 카드에 사용자 입력·미인증 안내를 표시한다. 상세 계약은 [features/game-profiles.md](features/game-profiles.md)를 따른다.
- 페이지 주소를 `/내정보`, `/멤버`로 한글화했다. 메뉴·프로필·포인트 링크와 로그인 복귀 주소를 맞추고 기존 `/me`, `/members`는 query·fragment를 보존해 308 이동한다. API 경로와 접근 권한은 유지한다.
- 게임 프로필 API는 canonical Discord ID와 기존 bot의 멤버 조회로 대상 서버의 ACTIVE 멤버만 허용한다. 탈퇴·차단 작성자를 숨기고 멤버 확인 실패는 차단한다. 기존 공개 홈·게임·랭킹과 개인 포인트 권한은 유지한다. 이 게임 프로필 구현에는 Steam·bot 명령을 포함하지 않았다. 공개 게임 성향 콘텐츠는 멤버 프로필 데이터를 사용하지 않는 별도 기능이다.
- 비로그인 연습 플레이의 unit/component 및 desktop/mobile/compact E2E가 통과했다.
- PostgreSQL schema, migration, 공식 GameSession API, Discord OAuth, 개인 최고와 기간별 랭킹 코드가 구현돼 있다.
- 랭킹 목록과 내 순위는 전체 순위를 한 번 계산해 함께 반환한다. 로그인 조회 SQL을 3회에서 2회로 줄였으며 페이지 밖 viewer가 목록·hasMore에 영향을 주지 않도록 회귀 검증했다.
- 포인트 적립 v1이 구현돼 있다. 정책 적용 시각은 2026-09-12 01:12 KST이며 유효한 number-click 공식 완료당 10P, 사용자별 KST 하루 최대 50P를 적립한다. 포인트 사용·상점은 비범위다.
- 사용자별 0P 계정 자동 생성과 기존 사용자 backfill, append-only 적립·회수 원장, 같은 GameRecord의 정확히 한 번 적립, 잔액·원장 정합성 검사와 기록 무효화 회수가 구현돼 있다.
- 로그인 사용자는 공식 완료 결과, 공통 header와 `/내정보`에서 확정 잔액을 확인하고 `/내정보`에서 최근 변동·빈 상태·조회 오류 재시도를 확인한다. BANNED 사용자는 조회만 가능하다.
- 홈은 커뮤니티 라운지로 구성돼 있다. 오늘의 대화 주제 선택·복사, 실제 TOP 5·주간 랭킹 진입, 개인 영역과 이용 가이드를 제공하며 미니게임은 보조 활동이다.
- 홈 상단 배너를 멤버 사진 스토리로 교체했다. 목록은 로그인 여부와 관계없이 게시자의 Discord 프로필 사진·이름으로 표시하고 비로그인은 스토리/추가 클릭 시 로그인 안내 팝업을 본다. 실제 사진은 로그인한 사용자만 열람하며 ACTIVE 사용자는 사진 선택·미리보기·게시·이전/다음 열람을 이용한다. 서버 게시 시각부터 24시간 후 목록·사진 접근은 숨기고 원본은 PostgreSQL에 보관한다. 상세 정책은 [features/stories.md](features/stories.md)를 따른다.
- 스토리는 실제 이미지·크기·픽셀·애니메이션 검증, 메타데이터 없는 표시용 이미지, Origin·계정 상태 검사, 동시 게시 멱등성, 24시간 내 10장 한도와 no-store 이미지 응답을 구현했다. 원본 자동 삭제나 별도 보관함은 없다.
- 스토리 목록은 작성자당 프로필 하나이며 작성자별 최신순 30명 단위로 모든 유효 사진을 함께 조회한다. 뷰어는 게시 순서대로 사진 로드 후 5초 자동 전환, 사진 좌우 절반 클릭·방향키 이동, 진행 막대, 일시정지·재생과 숨겨진 탭 일시정지를 제공한다. 현재 불러온 마지막 작성자까지 재생하면 닫는다.
- 라운지와 공통 메뉴의 desktop/mobile/compact E2E, KST 날짜별 주제와 복사 실패 복구 component 검증이 통과했다. 주간 랭킹 초기 조회 실패에도 선택한 기간과 재시도 경로를 유지한다.
- 320·390·768·1280·1440px 화면, 키보드 본문 진입, reduced motion, 실제 클립보드 복사와 200% CSS 확대 레이아웃을 확인했다. 상세 QA 범위는 [TESTING.md](TESTING.md)를 따른다.
- `NODE_ENV=test`와 `E2E_AUTH_MODE=mock-discord`에서만 열리는 local mock Discord OAuth가 Better Auth의 state·PKCE·callback·DB session 흐름을 통과한다. 공식 desktop/mobile 완료, 500ms 오클릭 페널티, 재도전, 완료 응답 유실 후 동일 payload retry와 즉시 랭킹 반영 E2E가 구현됐다.

## 환경과 미검증 범위

### 현재 Linux 개발 환경 — 2026-09-18

- Windows에서 Linux(`/home/wooram/jgd-platform/jgd.gg`)로 개발 환경을 이전했다. nvm에 Node.js 24.20.0과 pnpm 12.3.4를 설치하고 frozen lockfile로 의존성을 설치했다. 새 shell에서는 저장소에서 `nvm use`를 실행한다.
- `compose.dev.yaml`은 PostgreSQL 18.6을 `127.0.0.1:5432`에 제공한다. 전용 `jgd-gg-dev_postgres-data` 볼륨의 `jgd`·`jgd_test` DB와 비관리자 `jgd` 역할을 만들고 두 DB에 기존 migration 4개, 개발 DB에 number-click seed를 적용했다. 기존 bot·게임 서버 컨테이너는 변경하지 않았다. 2026-09-18에 기존 `jgd-web_postgres_data`는 읽기 전용 원본에서 `jgd-gg-legacy-postgres-snapshot-20260918` 스냅샷으로 보존한 뒤 검사했다. 구형 DB의 유효 Discord ID 사용자 3명만 Better Auth 사용자·Discord account·0P point account로 `jgd`에 이관했다. 구형 스도쿠·지뢰찾기 기록은 0건이고 현재 스키마와 호환되지 않아 이관하지 않았다. 이관 전 `jgd` custom dump는 `jgd-gg-pre-user-import-backup-20260918` 볼륨에 보관했다.
- Git 제외·권한 0600인 `.env`에는 auth/test secret과 OAuth 변수가 있다. `DATABASE_URL`·`DIRECT_DATABASE_URL`·`DATABASE_URL_TEST`는 실행 중인 개발 PostgreSQL의 `localhost:5432`를 사용하며, 2026-09-18에 `jgd` 역할과 함께 새 비밀번호로 교체한 뒤 Prisma migration status와 `jgd_test` 읽기 전용 접속을 확인했다. Compose 재생성에 필요한 `JGD_POSTGRES_PASSWORD`와 `JGD_DATABASE_PASSWORD`는 `.env` 외부에서 주입한다. 실제 OAuth/login smoke는 미실행이다.
- 2026-09-18에 production Next.js user service(`jgd-web.service`)와 Cloudflare Tunnel user service(`jgd-cloudflared.service`)를 구성했다. 같은 날 후속 점검에서 두 서비스 모두 active/enabled, `Linger=yes`를 확인했다. curl 기준 `127.0.0.1:3001`과 `https://jgd.wooram.online`의 홈·게임은 모두 200으로 기존 공개 502는 재현되지 않았다. 재부팅 후 실제 자동 기동과 현재 요청을 처리한 Tunnel 커넥터의 식별은 별도 검증하지 않았다. 이번 후속 점검에서는 서비스·Tunnel 설정을 변경하거나 재시작하지 않았다.
- 후속 HTTP smoke에서 로컬·공개 주소 모두 `/내정보`·`/멤버`는 비로그인 시 올바른 returnTo를 포함한 로그인 주소로 307 이동, 두 게임 프로필 API는 401, mock OAuth 경로는 404를 확인했다. 로컬 기존 `/me`·`/members`의 query 보존 308도 확인했다. Python urllib 공개 요청은 403으로 실패했고 curl 재검증은 통과했으며 차이의 원인은 확정하지 않았다. 실제 브라우저 OAuth 성공을 의미하지 않는다.
- Linux `.env`의 OAuth 필수값은 존재하지만 `DISCORD_BOT_TOKEN`·`TARGET_GUILD_ID`는 미설정이다. 실제 멤버·비멤버 smoke는 아직 실행할 수 없다. 멤버 확인의 단위 테스트(`src/lib/auth/guild-membership.test.ts`) 15개는 통과했다. 이 결과는 실제 Discord API 검증을 대체하지 않는다.
- Linux에서 typecheck·lint·format check, unit/component 180개, PostgreSQL integration 39개, 전체 E2E 24개 PASS/기존 비대상 6개 skip을 확인했다. production build와 별도 로컬 production smoke의 홈 200·mock OAuth 404·두 프로필 API 비로그인 401도 통과했다. integration과 build/smoke에는 프로세스 전용 임시 OAuth 값을 사용했다. 재현 절차는 [README](../README.md#linux-개발-환경)에 있다.
- 초기 의존성 설치·DB 접속·브라우저 설치·Turbopack 빌드는 실행 sandbox의 DNS·파일 쓰기·네트워크/포트 제한으로 실패했고 권한 허용 후 실행했다. Turbopack은 최초 실패 캐시를 `/tmp/jgd-next-sandbox-build-20260918`로 보관한 뒤 새 빌드가 통과했다. 최초 integration은 OAuth 필수값 누락으로 9개가 실패했으며 테스트 전용 값을 지정한 재실행에서 39개 모두 통과했다. assertion·timeout·skip 변경은 없다.
- E2E는 정상 종료했으며 실행 중 Next.js의 `The destination stream closed early` 로그 1건이 있었다. pg의 동시 query deprecation 경고도 관측됐다. 이번 작업에서 실제 공개 서비스 배포·Tunnel 이전·Windows DB 복원은 수행하지 않았다.

### 게임 성향·궁합 검증 — 2026-09-18

- lint·format check·typecheck PASS. unit/component 195개와 coverage gate(전체 lines 98.46%, branches 92.67%) PASS, PostgreSQL integration 39개 PASS. 게임 성향 도메인은 4096개 가능한 답변·256개 유형 쌍과 잘못된 응답 거부를 검증했다. 최초 component 테스트의 `toHaveValue` 비지원 matcher 사용은 DOM value 검사로 수정해 전체 재검증했다.
- 전체 E2E 27개 PASS/기존 비대상 6개 skip. 게임 궁합의 desktop/mobile/compact 비로그인 진입·문항·친구 비교·복사·저장 없음·새로고침 초기화를 포함한다. 실행 중 Next stream 종료·pg 동시 query 경고와 test 데이터 변경 시점의 포인트 header 정합성 오류 로그 1건이 관측됐다. 테스트는 통과했으며 해당 로그의 정확한 원인은 이번 범위에서 확정하지 않았다.
- 실행 중인 서비스의 `.next`를 보존하기 위해 `/tmp/jgd-compatibility-build-bkf9sxte` 복사본에서 기본 Turbopack production build를 통과했다. 별도 `127.0.0.1:3117` production 서버에서 320·390·768·1280·1440px 및 640px의 한글 주소 직접 진입·키보드 전체 응답·결과 focus·친구 비교·실제 클립보드 복사·가로 넘침 없음과 browser runtime error 없음을 확인했다. 640px은 좁은 콘텐츠 너비 검증이며 실제 browser 200% zoom 검증을 대신하지 않는다. 영문 주소 query 보존 308, mock OAuth 404, 비로그인 프로필 API 401도 PASS. 검증 서버는 종료했다.
- 최초 Linux screenshot은 한글 글꼴이 없어 네모로 표시됐다. Ubuntu `fonts-noto-cjk` 패키지에서 Noto Sans CJK Regular/Bold를 사용자 글꼴 디렉터리에 설치한 뒤 별도 production 브라우저에서 desktop intro·320px 결과의 한글 렌더링과 레이아웃을 시각 확인했다. 앱의 폰트 dependency·외부 폰트 요청은 추가하지 않았다.
- DB schema·migration·인증·bot 설정 변경과 공개 배포·서비스 재시작·commit·push는 수행하지 않았다.

### 게임 성향·궁합 공개 배포 — 2026-09-21

- 사용자 승인으로 검증된 production 빌드 `sO1lFOAQq-dW9Ea42iS6x`를 기존 `jgd-web.service`에 배포했다. 실제 배포 전 현재 소스·의존성 lockfile·환경과 검증 복사본의 동일성을 확인했다. DB migration·환경 변수·Tunnel·bot 설정은 변경하지 않았다.
- 2026-09-18의 첫 배포는 `.next` 복사 시 symlink를 역참조해 Prisma 외부 모듈의 의존성 해석이 깨졌고, 로컬 health check 실패 후 기존 빌드로 자동 복구됐다. 이번에는 `shutil.copytree(..., symlinks=True)`로 런타임 링크 3개를 보존하고 재배치한 staging에서 홈·게임·랭킹·전체 유형 흐름을 확인한 뒤 전환했다. 이전 static asset 4개도 보존했다.
- 공개 HTTPS에서 1280·390·320px의 홈 진입→12문항→유형 결과→친구 비교→실제 클립보드 복사→새로고침 초기화를 확인했다. 가로 넘침과 browser runtime error가 없었다. 홈·게임 궁합·게임·랭킹 200, 영문 게임 궁합 주소 308, mock OAuth 404, 비로그인 프로필 API 두 경로 401을 확인했다. 전환 후 웹 서비스 active/running·자동 재시작 0회·확인 구간의 서비스 오류 로그 0건이다.
- 복구용 이전 빌드 `nLcyWE4N5C1Bma3TiU_p6`는 `/home/wooram/.local/share/jgd-gg/deployments/game-compatibility-sO1lFOAQq-dW9Ea42iS6x/previous-next`에 보존했다. 같은 디렉터리의 `deployment.json`에 빌드 ID·검증 상태를 기록한다. 복구 시 웹 서비스만 중지하고 현재 `.next`를 별도 보존한 뒤 `previous-next`를 저장소 `.next`로 이동해 서비스를 시작하고 확인한다. 보존 폴더에서 직접 실행하면 상대 symlink 기준이 달라지므로 사용하지 않는다.
- 전체 출시 게이트의 실제 Discord 로그인·실기기 QA·운영 HTTP 동시 부하·운영 backup/PITR 확정은 기존 미검증 항목으로 남는다. 이번 배포는 로그인 없이 동작하는 게임 성향 콘텐츠이며 기존 인증·DB 계약을 변경하지 않는다.

### 이전 Windows 환경의 검증 이력

아래 내용은 이전 PC에서 기록한 결과이며 현재 Linux의 서비스 실행 상태를 뜻하지 않는다.
- 2026-09-16 페이지 한글화 후 unit/component 180개, E2E 24개 PASS/기존 비대상 6개 skip, lint·format check·typecheck·production build를 통과했다. `/내정보`·`/멤버`의 로그인 복귀·메뉴 활성 표시·기존 주소 이동을 E2E와 로컬 production smoke로 확인했다. 한글 URL은 내부 영문 페이지로 rewrite하며, 실제 서비스 배포는 수행하지 않았다.
- 게임 프로필 migration `20260916120000_add_game_profiles`는 전용 `jgd_test` DB에 적용했다. 기존 사용자·기록·포인트·스토리를 바꾸지 않고 카드·게임 항목 테이블을 추가한다. 실제 서비스 DB 적용과 앱 배포는 수행하지 않았다.
- 웹 프로젝트 `.env`의 `DISCORD_BOT_TOKEN`, `TARGET_GUILD_ID`는 미설정이다. 설정 전 프로필 API는 접근을 차단한다. 실제 bot 자격 증명으로 멤버/비멤버 확인은 미실행이며 [설정 절차](features/game-profiles.md)를 따른다.
- 2026-09-16 게임 프로필 추가 후 전체 PostgreSQL integration 39개, 단위·component 178개, 전체 E2E 24개 PASS/기존 비대상 6개 skip을 확인했다. E2E는 1280·390·320px에서 등록·재조회·수정·게임 필터·삭제와 비로그인/비멤버 차단을 검증한다. 카드·입력 화면 screenshot을 시각 확인했다.
- 게임 프로필 포함 lint·format check·typecheck·production build가 통과했다. 별도 로컬 production smoke에서 mock OAuth 경로 404, 비로그인 프로필 API 두 경로 401을 확인했다. 실제 서비스 배포나 사용자 계정 프로필 등록은 하지 않았다.
- 로컬 PostgreSQL 18.6 서버가 설치돼 있으며 `postgresql-x64-18` 서비스가 자동 시작된다.
- 로컬 개발 DB `jgd`와 별도 테스트 DB `jgd_test`, 비관리자 애플리케이션 역할 `jgd`가 준비돼 있다. Git에서 제외되는 `.env`에 로컬 전용 임의 자격 증명과 테스트 DB reset 안전 설정을 구성했다.
- 개발 DB `jgd`와 테스트 DB `jgd_test`에는 `20260906120000_init_auth_and_game_models`, `20260912120000_add_point_accounts_and_ledger` migration과 number-click seed를 적용했다.
- 두 로컬 DB에 additive `20260913120000_add_stories` migration을 적용했다. 기존 데이터 변경이나 삭제는 없다. 원본·파생 이미지가 계속 누적되므로 출시 운영에서 DB와 backup 용량을 관찰해야 한다.
- integration 설정이 로컬 env 파일을 선택적으로 로드하며, GameSession의 `createdAt`과 `readyExpiresAt`을 같은 DB 기준 시각으로 저장한다.
- PostgreSQL integration 32개가 통과했다. 기존 세션·랭킹·포인트 검증과 스토리 공개 프로필 DTO·비로그인 이미지 차단, 24시간 경계, 원본 보관, 동시 게시·한도, pagination, DB CHECK와 cascade, 랭킹 페이지 앞/안/뒤 viewer를 포함한다.
- unit/component 및 성능 도구 안전 검증 143개가 통과했다. 기존 검증과 스토리 실제 이미지·크기·픽셀·애니메이션 검증, 미리보기·오류 재시도·같은 게시 키, 열린 뷰어 만료와 dialog focus, 비로그인 클릭 시 로그인 팝업·아바타 fallback, 로딩 후 5초·일시정지·숨겨진 탭·좌우 이동·마지막 닫기, 로컬 성능 DB 격리와 URL 오류 비밀정보 숨김을 포함한다.
- 2026-09-15 작성자별 묶음·자동 재생 변경 후 integration 32개와 전체 E2E 21개 PASS/기존 비대상 6개 skip을 확인했다. 동일 이름의 31명·62장 페이지 경계 검증과 desktop/mobile/compact의 두 장 게시·단일 프로필·실제 자동 전환·좌우 사진 클릭을 포함한다. schema와 migration 추가 변경은 없다.
- 전체 `pnpm test:e2e`는 별도 `E2E_PORT=3109`에서 21개 통과와 비대상 공식 조합 6개 skip 후 정상 종료한다. 스토리의 desktop/mobile/compact 게시·열람·원본 보관, 공식 완료의 10P와 header·`/me` 갱신, 응답 유실 replay를 포함한다. desktop 라운지의 200% 확대 검증은 1280px desktop 유효 콘텐츠 너비를 절반 viewport로 재현한다. 전용 E2E runner는 Windows 종료 시 server output pipe도 해제한다.
- 스토리 마지막 UI 수정 뒤 관련 E2E 3개가 추가 통과했다. 직접 Playwright 실행의 Windows server 종료 지연은 해당 테스트 서버 process tree만 종료해 정리했다. 테스트 실행에는 기존 `pnpm test:e2e` runner를 우선 사용한다.
- 공개 프로필 목록·로그인 팝업 변경 후 전체 E2E는 단독 재실행에서 21개 PASS/기존 비대상 6개 skip이다. 첫 실행은 build와 병행 중 공식 게임 시작 두 건이 5초 대기 실패했고 스토리 3개는 통과했다. 테스트·timeout 변경 없이 단독 재실행으로 전체 통과를 확인했으며 첫 실패의 정확한 원인은 확정하지 않았다.
- lint, format check, TypeScript strict와 production build가 스토리·랭킹 변경을 포함해 통과했다. coverage gate도 통과했고 랭킹 변경 후 전체 E2E도 21개 PASS/기존 비대상 6개 skip으로 재확인했다. 스토리의 실제 Discord 계정 사진 게시와 실기기 QA는 미실행이다.
- `pnpm test:performance`로 로컬 격리 스키마의 합성 사용자 10만 명·기록 100만 건을 측정했다. 로그인 랭킹 p95는 수정 전 약 593~982ms에서 161~384ms로 줄었고 모든 랭킹 시나리오가 500ms 목표를 통과했다. 포인트 포함 완료 transaction p95 6.2ms, 후속 응답 생성 p95 405.6ms는 서비스별 관측이며 전체 HTTP 800ms 목표 통과를 뜻하지 않는다.
- 같은 합성 스키마의 백업 16.3초·복원 42.8초 후 행 수·해시·인덱스·0P trigger·만료 사진 보존을 확인하고 해당 스키마와 dump만 정리했다. [PERFORMANCE_RESULTS.md](PERFORMANCE_RESULTS.md)에 환경·계획·수치·한계를, [DB_OPERATIONS.md](DB_OPERATIONS.md)에 재현과 backup/forward-fix 절차를 기록했다. 운영 backup/PITR와 RPO/RTO·보존 기간·담당자는 아직 확정되지 않았다.
- 개발 환경의 실제 랭킹 조회에 필요한 DB schema와 game row가 준비됐다.
- 실제 Discord application의 local callback을 구성했다. 실제 계정 로그인, 프로필 mapping, DB session 생성과 callback 후 Discord OAuth token 비저장을 수동 확인했다. 2026-09-11 로컬 브라우저에서 실제 계정 공식 플레이 1회를 완료해 개인 최고와 오늘·주간·전체 랭킹 반영을 확인했다. 같은 날 사용자가 로그인 취소·로그아웃·재로그인 프로필 갱신 수동 QA를 진행했다고 보고했다.
- 2026-09-12 Codex in-app browser의 기존 인증 세션에서 Enter만으로 공식 게임 시작과 1~25 완료를 확인했고, 결과 heading focus와 개인 최고·오늘·주간·전체 순위 표시를 확인했다. Chrome/Edge의 실제 200% browser zoom과 실기기 Safari/Android QA는 사용자가 수행하기로 했다.
- 2026-09-13 로컬 Codex in-app browser의 실제 Discord 인증 세션에서 공식 완료당 10P 적립을 확인했다. 완료 직후 결과와 공통 header가 같은 확정 잔액으로 갱신되고 `/me`의 잔액·최신 원장과 일치하며, 이 과정에서 발견한 상위 layout 잔액 지연은 완료 성공 후 Server Component refresh와 E2E 회귀 검증으로 수정했다.
- Node.js 24.20.0과 pnpm 12.3.4가 프로젝트 고정값에 맞게 준비돼 있다.
- Cloudflare Tunnel `wooram-llm-tunnel`이 `https://jgd.wooram.online`을 이 PC의 production Next.js 서버(`http://localhost:3001`)로 전달한다. Tunnel Windows 서비스는 자동 시작이며 2026-09-15 공개 주소에서 JGD.GG 홈 응답과 실제 Discord OAuth callback·DB session 생성을 확인했다. 앱 서버는 Discord token 교환을 위한 outbound HTTPS가 허용된 환경에서 실행해야 하며, PC 재부팅 뒤 자동 시작 서비스는 별도로 구성해야 한다.
- 기존 Discord bot 저장소가 로컬 `C:\Users\jung8\Documents\jgd` 프로젝트로 준비됐다. 관리자 전용 `/서버_구조_내보내기` 명령은 메시지·첨부파일·멤버 목록·secret 없이 카테고리·채널·포럼 태그와 접근 범위를 JSON으로 내보내도록 bot 저장소에 구현했으며, bot 재시작과 실제 서버에서의 명령 실행은 아직 하지 않았다.
- 로컬 `main` branch가 GitHub의 `origin/main`을 추적한다.

## 다음 작업 우선순위

1. Linux 웹 OAuth 필수값 존재·공개 HTTP 접근·기존 사용자 3명 이관은 확인됐다. 사용자의 2026-09-18 지시로 게임 프로필의 `DISCORD_BOT_TOKEN`·`TARGET_GUILD_ID` 설정과 실제 멤버/비멤버 smoke는 추후로 보류한다. 실제 브라우저 로그인 확인도 미실행 상태다. 설정 절차는 [게임 프로필](features/game-profiles.md#설정과-적용)을 따른다. 재부팅 후 서비스 자동 기동도 별도 확인한다. [게임 성향·궁합 v1](features/game-compatibility.md)의 공개 배포와 브라우저 검증을 완료했다. 다음은 실제 이용 피드백에 따른 질문·유형 문구 개선이다. Steam 라이브러리 비교는 별도 범위 결정 전 비범위로 유지한다. 배포 사양 검증보다 커뮤니티 콘텐츠를 우선한다.
2. 출시 전 실제 배포 환경의 사양·pool·네트워크·장기 기록/원장/사진 분포로 HTTP 동시 부하를 검증한다. 로컬 100만 건 서비스 성능·격리 복원·forward-fix 절차 준비는 완료됐으며, 다음 단계는 운영 DB 대상과 backup/PITR·RPO/RTO·보존 기간·담당자 확정 및 격리 복원 검증이다.
3. 포인트 사용처·상점은 별도 제품 요구사항이 승인된 뒤 정책, 원자적 대상 효과와 멱등성 계약부터 설계한다.

사용자가 수행할 기존 Chrome/Edge 200% browser zoom과 실기기 Safari/Android QA 결과는 [TESTING.md](TESTING.md)에 기록한다.

## 갱신 규칙

- 현재 구현 상태, 환경 제약, blocker 또는 다음 우선순위가 달라진 작업에서 이 문서를 갱신한다.
- 완료된 작업의 변경 내용과 실제 검증 결과는 commit 또는 PR 설명에 남긴다.
- 요구사항이나 설계 결정을 이 문서에서 새로 정의하지 않는다.
