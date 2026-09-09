# number-click 기능 명세

문서 책임: number-click의 규칙, 사용자 흐름, 클라이언트 상태 머신, server validation, 예외와 Acceptance Criteria를 정의한다.

## 1. 목적

1부터 25까지 무작위 5×5 보드에서 순서대로 눌러 최대한 빨리 완료하는 10초 안팎의 반복 경쟁 게임이다. 오클릭은 게임을 끝내지 않고 시간 페널티로 반영한다.

내부 식별자:

- game slug: number-click
- rules version: 1
- score unit: MILLISECONDS
- score direction: ASC

## 2. 규칙 버전 1

| 항목 | 값 |
|---|---:|
| 숫자 | 1~25 |
| 보드 | 5×5 |
| 각 숫자 등장 | 정확히 1회 |
| 정답 순서 | 1, 2, 3, …, 25 |
| 오클릭 결과 | 게임 지속, 1회 증가 |
| 1회 페널티 | 500ms |
| 완료 | 25를 올바른 순서에서 누름 |
| 실제 시간 | PLAYING 활성화부터 정답 25 click까지 |
| 공식 최소 실제 시간 | 3000ms |
| 공식 최대 실제 시간 | 300000ms |
| 한 판 최대 입력 | 100회 |
| READY 유효 시간 | 생성 후 60초 |
| PLAYING 유효 시간 | 서버 시작 수락 후 5분 |

점수:

~~~text
penaltyMs = mistakeCount × 500
finalMs = durationMs + penaltyMs
~~~

예:

~~~text
durationMs = 14200
mistakeCount = 2
penaltyMs = 1000
finalMs = 15200
표시 = 15.20초
~~~

공식 저장 값은 모두 서버가 event를 재생해 계산한다.

## 3. 공식과 연습 모드

### 3.1 연습 모드

- 로그인하지 않은 사용자가 선택한다.
- board는 브라우저 Web Crypto 기반 난수로 만든다.
- 브라우저 안에서 같은 규칙으로 계산한다.
- 서버 GameSession을 만들지 않는다.
- 새로고침하면 결과를 잃는다.
- 결과에 연습 기록, 저장되지 않음을 표시한다.
- 로그인 후 방금 결과를 공식 기록으로 전환하지 않는다.

로그인 사용자가 네트워크 장애 중 연습을 선택하는 것도 허용할 수 있으나, 공식 시작 실패를 자동으로 연습으로 바꾸지 않는다. 사용자가 명시적으로 선택해야 한다.

### 3.2 공식 모드

- ACTIVE 로그인 사용자만 시작한다.
- server-generated board와 GameSession을 사용한다.
- start API 성공 이후에만 PLAYING이다.
- complete API 성공 response만 공식 결과다.
- 결과는 GameRecord에 저장되고 랭킹에 반영된다.

## 4. 보드 생성

### 4.1 공식 보드

서버에서 다음 algorithm을 사용한다.

1. [1, 2, …, 25] 배열을 만든다.
2. 뒤에서 앞으로 Fisher-Yates shuffle을 한다.
3. random index는 Node.js crypto의 편향 없는 정수 난수를 사용한다.
4. 결과가 길이 25, 모든 값이 정수 1~25, 중복 없음인지 assertion한다.
5. challengeData에 저장한 뒤 그대로 client에 반환한다.

Math.random은 공식 board 생성에 사용하지 않는다. board가 순위 공정성을 크게 좌우하지는 않지만 session payload의 무결성과 재현을 위해 server 값을 저장한다.

### 4.2 연습 보드

브라우저 crypto.getRandomValues를 이용한 Fisher-Yates를 사용한다. crypto API가 없으면 연습 시작을 막고 지원 browser 안내를 표시한다. Math.random으로 조용히 fallback하지 않는다.

### 4.3 boardDigest

공식 완료 시 challengeData의 canonical JSON을 SHA-256으로 digest해 resultData에 저장한다. digest는 보안 인증 수단이 아니라 audit 연결 확인용이다.

## 5. 클라이언트 상태

제품 기본 상태 4개를 유지하면서 네트워크 중간 상태를 명시한다.

| 상태 | 의미 | board 입력 |
|---|---|---:|
| IDLE | 설명·기록을 보고 시작 전 | 금지 |
| READY | session 생성, countdown, start 요청 | 금지 |
| PLAYING | 입력과 timer 진행 | 허용 |
| SUBMITTING | 마지막 정답 후 서버 검증 대기 | 금지 |
| FINISHED | 확정 결과 표시 | 금지 |
| ERROR | 복구 가능한 또는 terminal 오류 | 금지 |

상태 데이터:

~~~text
mode: practice | official
sessionId: UUID | null
board: number[25]
nextExpected: integer 1..26
completedValues: Set<number>
events: ClickEvent[]
mistakeCount: integer
startedPerformanceMs: number | null
currentElapsedMs: integer
completionPayload: object | null
result: ServerResult | PracticeResult | null
error: UiError | null
~~~

Set은 state 직렬화에 직접 의존하지 말고 reducer 안에서 immutable update가 보장되는 표현을 선택한다.

## 6. 상태 전이

| 현재 | event | 다음 | side effect |
|---|---|---|---|
| IDLE | START_PRACTICE | READY | local board 생성, countdown |
| IDLE | START_OFFICIAL | READY | create session API |
| READY | CREATE_FAILED | ERROR | 오류 표시 |
| READY | COUNTDOWN_DONE practice | PLAYING | performance baseline 설정 |
| READY | COUNTDOWN_DONE official | READY | start API 호출 |
| READY | START_SUCCEEDED | PLAYING | response 수신 직후 baseline 설정 |
| READY | CANCEL | IDLE | official이면 abandon best-effort |
| PLAYING | WRONG_CELL | PLAYING | event 추가, mistake +1 |
| PLAYING | CORRECT_CELL 1~24 | PLAYING | event 추가, nextExpected +1 |
| PLAYING | CORRECT_CELL 25 practice | FINISHED | local result 계산 |
| PLAYING | CORRECT_CELL 25 official | SUBMITTING | payload 고정, complete API |
| PLAYING | ABORT | IDLE | official이면 abandon |
| PLAYING | CLICK_LIMIT_BEFORE_COMPLETE | ERROR | official abandon |
| SUBMITTING | COMPLETE_SUCCEEDED | FINISHED | server result 저장 |
| SUBMITTING | NETWORK_FAILED | ERROR | 같은 payload retry 허용 |
| SUBMITTING | DOMAIN_REJECTED | ERROR | 새 판만 허용 |
| ERROR retryable | RETRY_SUBMIT | SUBMITTING | 저장한 payload 재전송 |
| FINISHED | PLAY_AGAIN | READY | 새 board와 새 session |
| ERROR terminal | PLAY_AGAIN | READY | 새 board와 새 session |

상태 변경은 하나의 reducer 또는 명시적 state machine에 모은다. 여러 useState callback에 전이 규칙을 흩뜨리지 않는다.

## 7. 시작 흐름

### 7.1 공식

1. 사용자가 게임 시작을 누른다.
2. client는 새 UUID idempotency key를 만든다.
3. create session API를 한 번 호출한다.
4. response의 board를 렌더하고 3, 2, 1을 각 500ms 보여준다.
5. countdown 뒤 start API를 호출한다. 응답 전 board는 잠겨 있다.
6. 성공 response를 받은 event loop에서 startedPerformanceMs = performance.now를 먼저 저장한다.
7. nextExpected = 1, elapsed = 0, events = 빈 배열로 PLAYING 전환한다.
8. focus는 board instruction 또는 첫 번째 DOM cell에 강제하지 않는다. 기존 사용자 focus를 보존한다.

create request network retry:

- 같은 idempotency key를 재사용한다.
- response를 받지 못했어도 새 key를 만들지 않는다.
- 사용자가 명시적으로 새 게임을 선택한 경우에만 새 key를 만든다.

### 7.2 연습

1. Web Crypto로 board를 만든다.
2. 같은 countdown을 보여준다.
3. countdown 종료 시 baseline을 설정하고 PLAYING으로 간다.
4. API를 호출하지 않는다.

## 8. 입력 처리

ClickEvent:

~~~json
{
  "value": 7,
  "elapsedMs": 4321
}
~~~

처리 순서:

1. PLAYING이 아니면 입력을 무시한다.
2. now = performance.now를 한 번 읽는다.
3. elapsedMs = Math.round(now - startedPerformanceMs)로 정수화한다.
4. value와 elapsedMs event를 배열에 추가한다.
5. value가 nextExpected와 같으면 correct다.
6. correct면 completed 표시하고 nextExpected를 증가시킨다.
7. 다르면 mistakeCount를 1 증가시키고 120ms feedback을 표시한다.
8. correct 25면 같은 event의 elapsedMs를 clientElapsedMs로 고정한다.

정의:

- board 바깥 click은 오클릭이 아니다.
- READY/SUBMITTING/FINISHED 상태 click은 오클릭이 아니다.
- 이미 완료한 cell을 다시 누르면 value가 nextExpected와 다르므로 오클릭이다.
- 요구 숫자보다 앞선 숫자나 뒤 숫자를 누르면 모두 오클릭이다.
- keyboard Enter/Space activation도 click 한 회와 동일하다.
- browser가 하나의 touch에 중복 event를 만들지 않도록 React onClick 하나만 점수 입력 entrypoint로 사용한다. pointerdown과 click에 동시에 기록하지 않는다.

입력 100번째가 정답 25면 완료를 허용한다. 100번째까지 완료하지 못하면 즉시 ERROR로 전환하고 공식 session을 abandon한다. 101번째 event는 만들지 않는다.

## 9. Timer

- 측정 Source of Truth: performance.now
- 화면 갱신: requestAnimationFrame
- elapsed 계산은 누적 frame delta가 아니라 매 frame performance.now - baseline이다.
- background tab에서 rAF가 느려져도 최종 click 시 직접 performance.now를 읽으므로 기록은 유지된다.
- Date.now는 client duration 계산에 사용하지 않는다.
- 매 10ms를 React state로 무조건 갱신할 필요는 없다. 표시가 바뀌는 10ms 단위에서만 render하도록 최적화할 수 있다.
- component unmount 시 rAF를 취소한다.
- visibility change만으로 game을 중단하지 않는다.
- server expiration은 별도이며 5분 이후 complete는 거부된다.

표시:

- 60초 미만: s.ss초
- 60초 이상: m:ss.SS
- PLAYING timer는 기록 저장 정밀도와 별개로 두 자리 소수까지 표시한다.

## 10. 공식 완료 payload 생성

마지막 정답 25 처리 시 다음 값을 immutable snapshot으로 만든다.

~~~json
{
  "clientElapsedMs": 14200,
  "events": [
    { "value": 1, "elapsedMs": 410 },
    { "value": 3, "elapsedMs": 730 },
    { "value": 2, "elapsedMs": 920 },
    { "value": 25, "elapsedMs": 14200 }
  ]
}
~~~

snapshot 뒤 event 배열이나 elapsed 값을 수정하지 않는다. network retry는 byte-equivalent JSON 의미를 가진 같은 payload를 보낸다.

client가 계산해 화면에 임시로 보여줄 수 있는 mistakeCount는 server result와 같아야 하지만 공식 FINISHED에는 server 값을 사용한다.

## 11. 서버 event replay

순수 함수 입력:

- board
- rulesSnapshot
- clientElapsedMs
- events

순수 함수 출력:

~~~text
success:
  durationMs
  mistakeCount
  penaltyMs
  finalMs
  clickCount

failure:
  stable domain error code
~~~

검증 순서:

1. rulesSnapshot schema/version 지원 여부
2. board 길이 25, 1~25 permutation
3. clientElapsedMs safe integer와 transport 상한 600000
4. events 개수 25~100
5. 각 event field 범위
6. elapsedMs nondecreasing
7. 각 value가 board set에 존재
8. nextExpected = 1로 replay
9. correct 1~25 모두 도달
10. 마지막 event가 correct 25
11. 마지막 elapsedMs === clientElapsedMs
12. mistakeCount <= 75
13. clientElapsedMs >= 3000
14. clientElapsedMs <= 300000
15. penalty와 final 계산이 safe integer

server application validation:

1. session 존재·소유자·game 확인
2. status PLAYING 또는 COMPLETED duplicate
3. rulesVersion 지원
4. DB now <= expiresAt
5. serverElapsedMs = DB now - startedAt
6. serverElapsedMs + 1000 >= clientElapsedMs
7. user ACTIVE

실패 우선순위는 위 순서를 따른다. 한 요청에 여러 오류가 있어도 첫 stable error code만 반환한다.

## 12. 저장과 개인 최고

성공 transaction:

1. score replay 결과를 GameRecord column에 저장한다.
2. session을 COMPLETED로 바꾸고 completedAt을 achievedAt과 같게 둔다.
3. commit 후 개인 최고와 rank를 조회한다.

개인 최고 비교 순서:

1. finalMs 낮음
2. mistakeCount 적음
3. achievedAt 빠름
4. recordId 사전순

isPersonalBest:

- 이전 기록이 없으면 true
- 새 기록이 위 비교에서 이전 최고보다 앞서면 true
- 동일 finalMs와 mistakeCount를 나중에 달성하면 false

previousPersonalBestMs는 완료 전 최고 finalMs다. 첫 기록이면 null이다.

## 13. 세션 수명과 이탈

| 상황 | 처리 |
|---|---|
| READY 중 새로고침·종료 | DB는 READY, 60초 후 만료로 간주 |
| PLAYING 중 새로고침·종료 | DB는 PLAYING, 5분 후 만료로 간주 |
| 중단 button | abandon API 후 IDLE |
| 다시 하기 | 이전 상태가 terminal인지 확인 후 새 session |
| 다른 tab에서 새 공식 시작 | 이전 live session ABANDONED, 새 session만 유효 |
| 이전 tab이 뒤늦게 완료 | SESSION_NOT_PLAYING |
| complete response 유실 | 같은 session/payload retry, 기존 record 반환 |
| complete 2회 동시 | record 한 건, 두 요청 모두 같은 결과 |
| browser offline | SUBMITTING 오류에서 같은 payload retry |
| expiresAt 뒤 reconnect | SESSION_EXPIRED, 새 게임 |

beforeunload에서 abandon 성공을 요구하지 않는다. sendBeacon 사용 여부와 무관하게 서버 만료가 정리 기준이다.

## 14. 현실적인 부정 방지

### 14.1 MVP에서 막는 것

- 존재하지 않는 session
- 타인 session
- start하지 않은 READY session
- 만료·포기·거절 session
- 동일 session 중복 record
- 1~25 완료가 없는 trace
- event 시간이 역행하는 trace
- board에 없는 값
- 3초 미만 기록
- 100회 초과 입력
- client duration이 server 시작 이후 가능한 범위를 초과하는 경우
- client 제공 score, mistake, penalty 조작

### 14.2 MVP에서 완전히 막지 못하는 것

- 개발자 도구로 자동화한 정상 형태 event
- 사람처럼 보이는 scripted click
- session을 기다린 뒤 낮지만 최소치 이상인 가짜 clientElapsed
- 화면 인식·매크로

웹 client는 사용자가 통제하므로 완전 방지는 불가능하다. 이 한계를 숨기지 않는다.

### 14.3 향후 강화 조건

의심 기록이 실제 운영 문제일 때만 다음을 순서대로 검토한다.

1. 통계적 이상치 flag와 운영자 record 무효화
2. 최소 기록 threshold를 실데이터 기반으로 조정
3. correct click 간격의 요약값 저장
4. 상위 기록에 추가 challenge
5. 상위권 수동 검토

CAPTCHA, full replay, browser fingerprint, invasive telemetry는 기본 선택이 아니다.

## 15. 오류와 복구

| 오류 | 재시도 | UI action |
|---|---:|---|
| create network | 같은 key로 가능 | 준비 다시 시도 |
| create auth expired | 로그인 후 새 session | Discord 로그인 |
| start network | 같은 session start 재호출 | 시작 확인 다시 시도 |
| start expired | 불가 | 새 게임 |
| complete network/5xx | 같은 payload 가능 | 기록 다시 전송 |
| complete 400 client bug | 같은 payload 재시도하지 않음 | 새 게임, requestId |
| complete 422 | 불가 | 저장 실패 안내, 새 게임 |
| rank lookup only failed | record 성공 | 랭킹 페이지에서 새로 조회 |

retry button은 진행 중 disabled로 이중 click을 막지만 server idempotency를 대체하지 않는다.

## 16. Unit test 목록

### Shuffle

- 1000회 결과가 모두 길이 25, 1~25 정확히 한 번
- 입력 배열을 mutate하지 않는 계약을 선택했다면 검증
- CSPRNG index 경계 0과 i 처리

무작위 분포 통계 테스트로 test를 flaky하게 만들지 않는다.

### Replay와 score

- 1~25 정상, 0 mistake
- 한 번 wrong 뒤 정상, +500ms
- 완료 cell 재클릭 mistake
- 여러 mistake, 정확한 penalty
- 25 미완료
- 마지막 event가 25 아님
- elapsed 역행
- 마지막 elapsed와 clientElapsed 불일치
- 2999ms 거부, 3000ms 허용
- 300000ms 허용, 300001ms 거부
- 100번째에 완료 허용
- 미완료 100회 오류
- value 0, 26, float 거부

### State machine

- 허용 전이 전부
- PLAYING 외 click 무시
- 마지막 correct에서 payload 한 번 생성
- retry가 동일 snapshot 사용
- PLAY_AGAIN이 board, events, timer를 reset

## 17. Integration test 목록

- create가 READY와 valid board를 저장·반환
- 같은 idempotency key 재요청은 같은 session
- 새 key가 이전 live session ABANDONED
- start가 startedAt/expiresAt 설정
- start duplicate가 최초 시각 유지
- READY 만료
- 정상 complete record와 session COMPLETED
- 오클릭 score 서버 계산
- 다른 user session 404
- READY complete 거부
- expired complete와 record 없음
- malformed payload는 session 유지
- domain-invalid payload는 REJECTED
- duplicate·동시 complete record 한 건
- BANNED user create/complete 거부
- rank lookup 실패가 record를 rollback하지 않음

오탈자 방지: DB enum 값은 COMPLETED이며 test 이름도 동일 철자를 사용한다.

## 18. E2E 목록

- 비로그인: 페이지 → 연습 → 완료 → 저장 안 됨 문구 → 로그인 CTA
- 로그인 desktop: 시작 → countdown → 1~25 → 결과 → 개인 최고 → 다시 하기
- 로그인 mobile: 390×844에서 같은 흐름
- 오클릭: 잘못된 cell → feedback → 완료 → 500ms 반영
- complete network response 유실 simulation → retry → record 한 건
- session 만료 → 새 게임 action
- keyboard-only completion smoke

E2E에서 timer를 실제 3초 기다리도록 강제하지 않는다. test 환경의 server rules를 바꾸지 말고 deterministic clock/fixture를 사용하되 production build에는 test clock이 활성화될 수 없어야 한다.

## 19. Feature Acceptance Criteria

- [ ] 공식 board는 서버 CSPRNG로 만든 1~25 permutation이다.
- [ ] 연습 board는 browser crypto를 사용하고 server에 저장되지 않는다.
- [ ] READY, PLAYING, SUBMITTING, FINISHED, ERROR 전이가 표와 같다.
- [ ] timer는 performance.now 기준이며 마지막 correct event와 duration이 같다.
- [ ] 잘못된 숫자는 종료하지 않고 정확히 500ms penalty를 만든다.
- [ ] 완료 숫자는 제거되지 않고 재클릭 시 오클릭이다.
- [ ] client는 모든 click event만 제출하고 score 구성값은 서버가 재계산한다.
- [ ] minimum duration, event 순서, 완료, session 소유·상태·만료를 서버가 검증한다.
- [ ] duplicate·concurrent complete가 GameRecord 한 건만 만든다.
- [ ] 연습 결과는 로그인 뒤 소급 저장되지 않는다.
- [ ] 다시 하기가 페이지 navigation 없이 새 session과 board로 시작된다.
- [ ] Unit, integration, desktop/mobile E2E가 통과한다.
