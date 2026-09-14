# JGD.GG 현재 상태

기준일: 2026-09-15

이 문서는 다음 작업을 시작할 때 필요한 현재 구현 상태, 환경 제약과 우선순위를 요약한다. 제품·보안·DB·API 동작의 Source of Truth는 [README.md](README.md)가 안내하는 담당 설계 문서이며, 과거 변경은 Git 이력에 보존한다.

## 구현 상태

- Next.js 기반 애플리케이션과 number-click MVP 코드가 구현돼 있다.
- 비로그인 연습 플레이의 unit/component 및 desktop/mobile/compact E2E가 통과했다.
- PostgreSQL schema, migration, 공식 GameSession API, Discord OAuth, 개인 최고와 기간별 랭킹 코드가 구현돼 있다.
- 랭킹 목록과 내 순위는 전체 순위를 한 번 계산해 함께 반환한다. 로그인 조회 SQL을 3회에서 2회로 줄였으며 페이지 밖 viewer가 목록·hasMore에 영향을 주지 않도록 회귀 검증했다.
- 포인트 적립 v1이 구현돼 있다. 정책 적용 시각은 2026-09-12 01:12 KST이며 유효한 number-click 공식 완료당 10P, 사용자별 KST 하루 최대 50P를 적립한다. 포인트 사용·상점은 비범위다.
- 사용자별 0P 계정 자동 생성과 기존 사용자 backfill, append-only 적립·회수 원장, 같은 GameRecord의 정확히 한 번 적립, 잔액·원장 정합성 검사와 기록 무효화 회수가 구현돼 있다.
- 로그인 사용자는 공식 완료 결과, 공통 header와 `/me`에서 확정 잔액을 확인하고 `/me`에서 최근 변동·빈 상태·조회 오류 재시도를 확인한다. BANNED 사용자는 조회만 가능하다.
- 홈은 커뮤니티 라운지로 구성돼 있다. 오늘의 대화 주제 선택·복사, 실제 TOP 5·주간 랭킹 진입, 개인 영역과 이용 가이드를 제공하며 미니게임은 보조 활동이다.
- 홈 상단 배너를 멤버 사진 스토리로 교체했다. 목록은 로그인 여부와 관계없이 게시자의 Discord 프로필 사진·이름으로 표시하고 비로그인은 스토리/추가 클릭 시 로그인 안내 팝업을 본다. 실제 사진은 로그인한 사용자만 열람하며 ACTIVE 사용자는 사진 선택·미리보기·게시·이전/다음 열람을 이용한다. 서버 게시 시각부터 24시간 후 목록·사진 접근은 숨기고 원본은 PostgreSQL에 보관한다. 상세 정책은 [features/stories.md](features/stories.md)를 따른다.
- 스토리는 실제 이미지·크기·픽셀·애니메이션 검증, 메타데이터 없는 표시용 이미지, Origin·계정 상태 검사, 동시 게시 멱등성, 24시간 내 10장 한도와 no-store 이미지 응답을 구현했다. 원본 자동 삭제나 별도 보관함은 없다.
- 스토리 목록은 작성자당 프로필 하나이며 작성자별 최신순 30명 단위로 모든 유효 사진을 함께 조회한다. 뷰어는 게시 순서대로 사진 로드 후 5초 자동 전환, 사진 좌우 절반 클릭·방향키 이동, 진행 막대, 일시정지·재생과 숨겨진 탭 일시정지를 제공한다. 현재 불러온 마지막 작성자까지 재생하면 닫는다.
- 라운지와 공통 메뉴의 desktop/mobile/compact E2E, KST 날짜별 주제와 복사 실패 복구 component 검증이 통과했다. 주간 랭킹 초기 조회 실패에도 선택한 기간과 재시도 경로를 유지한다.
- 320·390·768·1280·1440px 화면, 키보드 본문 진입, reduced motion, 실제 클립보드 복사와 200% CSS 확대 레이아웃을 확인했다. 상세 QA 범위는 [TESTING.md](TESTING.md)를 따른다.
- `NODE_ENV=test`와 `E2E_AUTH_MODE=mock-discord`에서만 열리는 local mock Discord OAuth가 Better Auth의 state·PKCE·callback·DB session 흐름을 통과한다. 공식 desktop/mobile 완료, 500ms 오클릭 페널티, 재도전, 완료 응답 유실 후 동일 payload retry와 즉시 랭킹 반영 E2E가 구현됐다.

## 환경과 미검증 범위

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
- 로컬 `main` branch가 GitHub의 `origin/main`을 추적한다.

## 다음 작업 우선순위

1. 출시 전 실제 배포 환경의 사양·pool·네트워크·장기 기록/원장/사진 분포로 HTTP 동시 부하를 검증한다. 로컬 100만 건 서비스 성능·격리 복원·forward-fix 절차 준비는 완료됐으며, 다음 단계는 운영 DB 대상과 backup/PITR·RPO/RTO·보존 기간·담당자 확정 및 격리 복원 검증이다.
2. 포인트 사용처·상점은 별도 제품 요구사항이 승인된 뒤 정책, 원자적 대상 효과와 멱등성 계약부터 설계한다.

사용자가 수행할 기존 Chrome/Edge 200% browser zoom과 실기기 Safari/Android QA 결과는 [TESTING.md](TESTING.md)에 기록한다.

## 갱신 규칙

- 현재 구현 상태, 환경 제약, blocker 또는 다음 우선순위가 달라진 작업에서 이 문서를 갱신한다.
- 완료된 작업의 변경 내용과 실제 검증 결과는 commit 또는 PR 설명에 남긴다.
- 요구사항이나 설계 결정을 이 문서에서 새로 정의하지 않는다.
