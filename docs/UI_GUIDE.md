# JGD.GG UI·반응형 가이드

문서 책임: 정보 구조, 화면 상태, 반응형 배치, 디자인 토큰, 접근성과 사용자 문구를 정의한다.

## 1. UX 원칙

- 홈은 커뮤니티 라운지다. 오늘의 이야기, 멤버 기록과 개인 영역 탐색을 먼저 제공하고 미니게임은 보조 활동으로 배치한다.
- 사용자는 게임 규칙을 10초 안에 이해하고 두 번 이내의 입력으로 플레이를 시작한다.
- 한 판 종료 후 페이지 이동 없이 다시 한다.
- 공식 기록과 연습 기록을 혼동시키지 않는다.
- 최종 점수보다 실제 시간, 오클릭, 페널티의 관계를 명확히 보인다.
- 현재 로그인 사용자의 랭킹 위치를 쉽게 찾게 한다.
- 색만으로 정답, 오답, 상태를 표현하지 않는다.
- 모바일 320px부터 데스크톱까지 같은 기능을 제공한다.

## 2. 시각 방향

차분한 차콜 배경, 라벤더 강조와 따뜻한 라운지 일러스트로 편안한 커뮤니티 분위기를 만든다. 과도한 neon, particle, parallax는 쓰지 않는다.

### 2.1 CSS token

Tailwind 4의 CSS-first theme 변수로 다음 semantic token을 만든다. component 안에 임의 hex를 반복하지 않는다.

| token | 기준 색 | 용도 |
|---|---|---|
| color-bg | #101116 | 전체 배경 |
| color-surface | #191A21 | card |
| color-surface-raised | #23242E | hover·강조 |
| color-border | #30313C | 장식 구분선 (입력 상태는 추가 대비 제공) |
| color-text | #F5F7FA | 본문 주요 |
| color-text-muted | #AAABBA | 보조 |
| color-primary | #665CCF | Discord 연계 CTA |
| color-primary-hover | #574EB7 | CTA hover |
| color-success | #2FBF71 | 개인 최고·완료 |
| color-warning | #F4B942 | 페널티 |
| color-danger | #EF5B5B | 오클릭·오류 |
| color-focus | #B6AAFF | focus ring·라벤더 강조 |
| color-hero | #C4B5E9 | 라운지 welcome banner |
| color-hero-text | #29213B | banner 제목·CTA 배경 |
| color-hero-muted | #514463 | banner 본문 |
| color-peach | #E7B798 | 오늘 기록 아이콘 |
| color-mint | #A5CDBB | 주간 랭킹 강조 |

색상 대비는 WCAG AA를 만족해야 한다. 작은 일반 텍스트는 4.5:1, 큰 텍스트와 UI 경계는 최소 3:1을 목표로 한다.

### 2.2 Typography

- 기본 언어는 ko.
- system sans 또는 프로젝트에 포함된 한글 web font 하나만 사용한다.
- 숫자 기록은 tabular-nums를 적용한다.
- body 16px, line-height 1.5가 기본이다.
- 게임 타이머는 모바일 32px, sm 이상 40px, font weight 700.
- 페이지 제목은 모바일 28px, sm 이상 36px.

### 2.3 Shape와 motion

- card radius: 일반 16px, 라운지 콘텐츠 13px
- button radius: 12px
- cell radius: 10px
- focus ring: 3px, 2px offset
- 일반 transition: 120~180ms
- gameplay cell에는 위치 이동 animation을 사용하지 않는다.
- prefers-reduced-motion에서는 비필수 transition과 scale을 제거한다. countdown 시간과 기능은 동일하다.

## 3. 공통 레이아웃

### 3.1 Header

- 높이: 모바일 64px, 768px 이상 72px
- 왼쪽: JGD.GG wordmark, 클릭 시 /
- 중앙/데스크톱: 커뮤니티 소개 문구
- 오른쪽 비로그인: Discord로 로그인
- 오른쪽 로그인: 확정 포인트 잔액, avatar + displayName, 내 기록, 로그아웃
- 1100px 이상에서는 왼쪽에 라운지, 커뮤니티 랭킹, 미니게임, 내 기록과 홈 콘텐츠 바로가기 메뉴를 둔다. 현재 경로는 aria-current로 표시한다.
- 1100px 미만에서 nav는 header menu button으로 축약하고 이동 시 닫는다. 로그인 진입은 작은 화면에도 유지한다.
- header는 gameplay 중에도 보이지만 sticky로 보드를 가리지 않는다. 기본 static이다.

### 3.2 Main

- 모바일 좌우 padding 16px
- sm 24px
- lg 32px
- 전체 shell max-width 1488px, 데스크톱 sidebar 204px, 일반 콘텐츠 max-width 1180px
- 게임 집중 column max-width 720px
- 상단과 하단 최소 padding 24px/40px

라운지는 768px 이상에서 중앙 콘텐츠와 272px 보조 열을 사용한다 (1100~1199px에서는 244px). 작은 화면에서는 대화 → 기록 → 미니게임 → 개인 영역·가이드 순으로 쌓는다. 게임 페이지는 중앙 집중 column과 기존 보드 규격을 유지한다. 빈 광고 영역을 예약하지 않는다.

viewport뿐 아니라 main의 실제 콘텐츠 너비도 container query로 확인한다. 확대 등으로 콘텐츠가 700px 이하가 되면 라운지를 한 열로 배치하고, 520px 이하에서는 개인 영역도 한 열로 배치한다.

### 3.3 Footer

- 서비스명, 개인정보 안내, 문의 링크
- 게임 플레이 중 screen 첫 영역을 차지하지 않는다.

## 4. 경로별 화면

### 4.1 홈 /

위에서 아래 순서:

1. 제목: 우리들의 라운지. KST 날짜와 환영 문구
2. 멤버 사진 스토리: 지금, 우리 이야기. 로그인 여부와 관계없이 내 스토리 추가와 작성자의 원형 프로필 사진 목록을 본다. 비로그인은 스토리나 추가 버튼 클릭 시 로그인 안내 dialog를 본다. 사진은 로그인 후 열람하며 하단에 오늘의 이야기 바로가기를 유지한다.
3. 오늘의 대화 한 조각: 가벼운 수다·게임 이야기 선택, 질문과 복사 버튼
4. 오늘의 기록: 실제 TOP 5, 오클릭과 최종 기록, 전체 랭킹 진입
5. 기다리는 동안, 잠깐 한 판: 기존 number-click 진입
6. 보조 열: 비로그인 Discord 연결 안내 또는 로그인 사용자 프로필·내 기록, 주간 랭킹, 펼칠 수 있는 이용 가이드

대화 주제는 로그인 없이 제공한다. KST 날짜마다 정해진 두 종류의 주제를 사용하고 각 종류의 14개 편집 주제를 순환한다. 자정을 넘겨 열린 페이지는 다음 홈 접속·새로고침 때 갱신한다. 복사는 사용자의 클릭으로만 실행하며 성공/실패를 live region으로 안내한다. 클립보드 권한이 없으면 read-only textarea에서 직접 복사할 수 있다. Discord 메시지 전송이나 서버 초대 기능으로 표시하지 않는다.

데이터 로딩 실패 시 오늘의 기록 card에 다시 불러오기 버튼을 표시한다. 서버 환경 연결 전, 요청 실패, 조회 성공 후 빈 목록은 다른 상태다. 가상의 게시글·멤버 수·알림을 표시하지 않는다. 조회 재시도는 기존 공개 API의 no-store·schema 검증을 따른다.

### 4.2 로그인 /login

- Discord로 로그인 button 하나
- 요청 권한: 기본 프로필만 확인
- 저장 정보: 표시 이름, avatar, 게임 기록
- 실제 email과 서버 목록을 수집하지 않는다는 문구
- 취소하고 돌아가기

### 4.3 내 기록 /me

- 로그인 없으면 /login?returnTo=%2Fme로 이동
- profile summary: avatar, displayName
- 전체 개인 최고 card
- 오늘과 이번 주 최고
- 공식 완료 횟수
- 확정 포인트 잔액과 최근 변동 최대 20개
- 최근 기록 최대 10개
- 기록이 없으면 number-click 시작 CTA

프로필 편집 button은 없다.

### 4.4 포인트

로그인 사용자의 공통 header에 확정 잔액을 `1,250 P`처럼 간결하게 표시하고, /me에는 현재 잔액과 최근 변동 내역을 제공한다. 비로그인 사용자에게 가상 잔액을 만들지 않는다.

- 포인트와 게임 기록의 `점수`를 같은 단위나 같은 순위로 표현하지 않는다.
- 적립·사용 처리 중에는 예상 잔액을 확정값처럼 optimistic 표시하지 않는다.
- 실패하면 마지막으로 확인된 잔액을 유지하고 다시 불러오기 또는 원래 행동 재시도 경로를 제공한다.
- 변동 내역은 사유, 증감량, 처리 시각을 텍스트로 구분하며 색만으로 적립과 사용을 나타내지 않는다.
- 최초 조회 중에는 `포인트를 불러오는 중…`, 빈 원장은 `아직 포인트 변동 내역이 없습니다.`, 실패는 오류 문구와 `다시 불러오기`를 표시한다.
- 공식 완료 결과에는 `+10 P 적립 · 보유 N P`, 일일 한도 도달에는 `오늘 적립 한도 50 P를 모두 채웠습니다.`를 확정 응답 뒤에만 표시한다.
- 기록 무효화 회수는 음수 부호와 `공식 기록 무효화 회수` 텍스트를 함께 표시한다.
- 포인트 사용처가 승인되기 전에는 상점, 구매 button이나 비어 있는 메뉴를 노출하지 않는다.

세부 기능 동작과 활성화 조건은 [features/points.md](features/points.md)를 따른다.

## 5. number-click 화면 구조

한 column 안에서 다음 순서를 유지한다.

1. 페이지 제목과 짧은 규칙
2. 기록 context: 내 최고, 오늘 최고
3. 상태 message와 timer
4. 5×5 board 영역
5. primary action
6. 결과 detail 또는 오류
7. 랭킹 미리보기/링크

상태별 상세 동작은 features/number-click.md가 Source of Truth다.

### 5.1 IDLE

- board는 숫자 없는 placeholder grid 또는 낮은 대비 preview로 표시한다.
- 로그인 user primary: 게임 시작
- 비로그인 primary: 연습 시작
- 비로그인 보조문구: 연습 기록은 랭킹에 저장되지 않습니다.
- 규칙 문구: 1부터 25까지 순서대로 누르세요. 오클릭마다 0.50초가 추가됩니다.

### 5.2 READY

- session 생성 중에는 button spinner와 게임 준비 중…을 표시한다.
- session 준비 후 3, 2, 1 countdown은 각각 500ms, GO는 300ms 표시한다.
- countdown 중 board 숫자는 보이지만 pointer와 keyboard 입력을 받지 않는다.
- start API 200을 받은 뒤 GO와 동시에 PLAYING으로 바꾼다.
- countdown 중 취소하면 READY session abandon을 best-effort 호출한다.

정확한 네트워크 순서:

1. create session 완료
2. 시각 countdown
3. start API 요청
4. start API 성공
5. GO 표시와 performance.now 기준점 설정
6. board 활성화

start API가 1초 이상 걸리면 countdown 종료 뒤 게임 시작 확인 중…을 표시하며 board는 계속 잠근다.

### 5.3 PLAYING

- timer
- 다음 숫자: N
- board
- 오클릭: N회
- 중단 button은 secondary이고 primary board보다 시각적으로 약하다.
- 잘못 누르면 해당 cell이 120ms danger outline, 오클릭 숫자가 갱신된다.
- 진동은 기본 사용하지 않는다.
- 완료 cell은 그대로 있고 text와 background를 muted, check mark를 보조 표시한다.
- 완료 cell도 입력 가능하며 다시 누르면 현재 요구 숫자와 다르므로 오클릭이다.

### 5.4 SUBMITTING

UI 내부 보조 상태다. FINISHED와 구분해 이중 제출을 막는다.

- board 입력과 action을 잠근다.
- 기록 확인 중… spinner
- complete 요청을 재전송할 때 같은 session을 사용한다.
- 네트워크 오류면 기록 다시 전송과 새 게임 두 action을 준다.
- 기록 다시 전송은 동일 payload를 사용한다.

### 5.5 FINISHED

- 헤드라인: 15.20초
- 개인 최고면 새 개인 최고! badge
- 구성: 실제 14.20초 + 오클릭 2회 × 0.50초 = 페널티 1.00초
- 오늘·주간·전체 순위가 있으면 표시
- primary: 다시 하기
- secondary: 랭킹 보기
- 연습이면 연습 기록 badge와 이 기록은 저장되지 않았습니다 문구
- 연습 결과의 로그인 CTA: Discord 로그인 후 공식 기록에 도전
- 로그인 후 연습 결과를 저장한다는 문구나 동작은 금지

### 5.6 ERROR

- 오류 제목과 사용자 행동을 한 가지 이상 제공한다.
- session 만료: 게임 세션이 만료되었습니다. 새 게임 시작
- 결과 거절: 기록을 확인할 수 없어 저장하지 않았습니다. 새 게임 시작
- network: 연결을 확인한 뒤 같은 기록 다시 전송
- requestId가 있으면 작은 보조 텍스트로 문의 코드 표시
- raw error와 stack은 표시하지 않는다.

## 6. 보드 반응형 기준

보드는 항상 정사각형이고 CSS grid 5 columns다.

| viewport | board width | gap | cell 최소 |
|---|---|---|---|
| 320~479px | min(calc(100vw - 32px), 440px) | 6px | 약 53px at 320 |
| 480~767px | min(calc(100vw - 48px), 480px) | 8px | 60px 이상 |
| 768px 이상 | 500px | 10px | 92px |

규칙:

- aspect-ratio 1 / 1
- cell aspect-ratio 1 / 1
- touch target 44×44px 이상
- board max-width 500px
- 숫자 font: 모바일 clamp(18px, 6vw, 26px), 데스크톱 28px
- touch-action: manipulation
- user-select: none은 board 안에만 적용
- viewport 가로 scroll을 만들지 않는다.
- 320px 미만은 지원 대상이 아니지만 콘텐츠 손실 대신 세로 scroll을 허용한다.

## 7. 랭킹 UI

### 7.1 Tabs

- 오늘, 이번 주, 전체
- 기본 오늘
- URL query period와 동기화해 새로고침·공유 가능
- 초기 데이터 조회가 실패해도 URL에서 선택한 기간을 유지하고 같은 기간의 다시 불러오기를 제공한다. 실패를 빈 기록으로 표시하지 않는다.
- tab은 keyboard arrow 이동과 aria-selected를 지원
- 탭 변경 시 기존 목록을 유지한 채 loading overlay를 사용하지 말고 skeleton row 또는 상단 progress를 표시한다.

### 7.2 Desktop 640px 이상

table column:

1. 순위
2. 플레이어: avatar + displayName
3. 최종 기록
4. 오클릭

달성 시각은 row 보조 텍스트 또는 title로 제공하고 기본 column을 늘리지 않는다.

### 7.3 Mobile 639px 이하

table semantic을 유지하되 각 row를 grid로 표현한다.

- 왼쪽: 순위
- 중앙: avatar, displayName, 오클릭
- 오른쪽: 최종 기록
- text가 길면 displayName을 한 줄 ellipsis한다.

### 7.4 현재 사용자

- items 안의 내 row는 primary 색 border와 내 기록 badge를 표시한다.
- 내 순위가 현재 100개 밖이면 목록 아래 sticky가 아닌 별도 내 순위 card를 표시한다.
- viewer record가 없으면 공식 기록을 남겨 순위에 참여하세요 CTA를 표시한다.

### 7.5 빈 상태

문구: 아직 이 기간의 기록이 없습니다. 첫 기록에 도전해 보세요.

Game이 플레이 가능하면 game CTA를 제공한다.

## 8. Score와 시간 표시

- DB/API 정수 millisecond가 계산 Source of Truth다.
- 표시 함수 하나를 공통 사용한다.
- 초 표시는 ms / 1000을 소수점 둘째 자리까지 반올림한다.
- 14370ms는 14.37초다.
- 14375ms는 JavaScript의 명시한 정수 formatting 함수 기준 14.38초다.
- 60초 이상도 초로 유지하지 말고 1:02.35처럼 m:ss.SS로 표시한다.
- 내부 비교와 정렬에는 formatted string을 사용하지 않는다.
- 페널티 0ms도 0.00초로 표시한다.

## 9. Loading과 optimistic UI

- GameRecord 저장과 rank는 optimistic으로 확정하지 않는다.
- 오클릭 수와 현재 timer만 client-local 즉시 갱신한다.
- FINISHED 공식 기록은 complete API 성공 후에만 표시한다.
- complete retry 동안 동일 payload와 session을 유지한다.
- public ranking skeleton은 실제 row와 높이가 같아 layout shift를 줄인다.
- button async 동작 중 동일 action을 disabled하고 aria-busy를 설정한다.

## 10. 접근성

- 모든 cell은 button element이며 접근 가능한 이름은 숫자 N이다.
- board 앞에 현재 눌러야 할 숫자 N을 text로 표시한다.
- 매 10ms timer를 live region으로 읽지 않는다. aria-live는 완료 결과와 오류에만 사용한다.
- keyboard 사용자는 Tab으로 cell을 이동하고 Enter/Space로 누를 수 있다.
- board의 DOM 순서는 시각 grid 순서와 같다.
- 완료 cell은 색 외에 check mark와 accessible description을 가진다.
- 오클릭 flash는 색 외에 오클릭 count text를 갱신한다.
- 게임 핵심 흐름에는 modal을 사용하지 않는다. 사진 스토리 게시·열람은 native dialog로 focus containment, Escape 닫기와 원래 버튼 focus 복구를 제공한다.
- 스토리는 작성자당 프로필 하나로 표시하며 사진 로드 후 5초 자동 전환과 상단 진행 막대를 제공한다. 사진 좌우 절반의 button과 방향키로 이동하고 일시정지·재생을 제공한다. 숨겨진 탭에서는 재생을 멈춘다. 진행 막대는 live region으로 계속 읽지 않으며 별도 이동 애니메이션 없이 사진을 바꾼다.
- focus를 임의로 매 cell로 이동하지 않는다.
- FINISHED 전환 시 결과 heading에 programmatic focus를 한 번 준다.
- error 전환 시 error heading에 focus한다.
- prefers-reduced-motion과 200% zoom에서 기능 손실이 없어야 한다.

## 11. 지원 browser

지원 기준:

- Chrome/Edge 111 이상
- Firefox 128 이상
- Safari 16.4 이상
- 최신 iOS Safari와 Android Chrome

Tailwind 4와 Next.js의 modern browser 기준에 맞춘다. performance.now, CSS grid, aspect-ratio가 없는 legacy browser polyfill은 제공하지 않는다.

## 12. 반응형·시각 테스트 viewport

최소:

- 320×700
- 390×844
- 768×1024
- 1280×800
- 1440×900

Playwright 필수 E2E는 390×844와 1280×800이다. 320px은 component/visual smoke로 보드 overflow를 확인한다.

## 13. UI Acceptance Criteria

- [ ] 라운지 상단에서 멤버 사진 스토리와 대화 콘텐츠로 진입하며 미니게임은 보조 영역에 있다.
- [ ] 모바일 메뉴가 실제 경로로 이동한 후 닫히며 본문 건너뛰기와 현재 위치 표시를 제공한다.
- [ ] 대화 주제 선택·복사·권한 거부 복구와 기록 조회의 오류·빈 상태 구분을 검증한다.
- [ ] 모든 상태 IDLE, READY, PLAYING, SUBMITTING, FINISHED, ERROR가 시각·입력상 구분된다.
- [ ] 320px에서 board가 가로로 잘리지 않고 cell이 44px 이상이다.
- [ ] 완료한 숫자는 제거되지 않고 완료 상태로 남는다.
- [ ] 공식과 연습 결과를 혼동할 수 없다.
- [ ] 실제 시간, 오클릭, 페널티, 최종 기록이 일관된 formatter로 보인다.
- [ ] 내 ranking row 또는 별도 viewer card가 강조된다.
- [ ] keyboard, focus, live region, reduced motion 기준을 만족한다.
- [ ] async 중복 클릭과 layout shift를 제어한다.
- [ ] 게임 board와 결과 사이에 광고나 불필요한 navigation이 없다.
- [ ] 로그인 사용자는 header와 /me에서 확정 포인트를 확인하고 loading·빈 원장·오류·재시도를 구분한다.
- [ ] 포인트 적립·회수는 부호와 사유 텍스트를 함께 표시하며 게임 기록 점수와 혼동되지 않는다.
