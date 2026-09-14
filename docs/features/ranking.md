# 랭킹 기능 명세

문서 책임: 랭킹 기간, 사용자별 최고 선정, 전체 정렬, 조회, 성능, UI 상태와 Acceptance Criteria를 정의한다.

## 1. 범위

MVP는 number-click에 다음 랭킹을 제공한다.

- 오늘
- 이번 주
- 전체

각 랭킹에는 한 사용자의 해당 기간 최고 GameRecord 한 건만 포함한다. 모든 시도 목록을 랭킹에 표시하지 않는다.

## 2. 후보 기록

기록이 랭킹 후보가 되려면 모두 참이어야 한다.

- game.slug = number-click
- record.rulesVersion = game.rankedRulesVersion
- record.rankEligible = true
- record.user.status = ACTIVE
- 기간형 랭킹이면 achievedAt >= startsAt
- 기간형 랭킹이면 achievedAt < endsAt

GameSession.startedAt이나 clientElapsed 시각을 기간 판정에 사용하지 않는다. 서버가 유효 완료를 수락한 GameRecord.achievedAt만 사용한다.

실행 중 자정이나 주 경계를 넘은 게임은 완료된 기간에 들어간다.

## 3. 시간대와 기간

기본 zone은 Asia/Seoul이다. DB는 UTC다. period utility가 사용자에게 받은 timezone을 사용하지 않고 고정 zone으로 경계를 계산한 뒤 UTC Instant로 반환한다.

모든 구간은 [startsAt, endsAt)이다.

### 3.1 오늘

- KST 해당 날짜 00:00:00.000 포함
- KST 다음 날짜 00:00:00.000 제외

2026-09-06 KST 예:

| 값 | UTC |
|---|---|
| startsAt | 2026-09-05T15:00:00.000Z |
| endsAt | 2026-09-06T15:00:00.000Z |

### 3.2 이번 주

- KST 월요일 00:00:00.000 포함
- 다음 월요일 00:00:00.000 제외
- ISO week처럼 월요일 시작이지만 week number 자체는 API에 필요 없다.

2026-09-06 일요일 KST 예:

| 값 | UTC |
|---|---|
| startsAt | 2026-08-30T15:00:00.000Z |
| endsAt | 2026-09-06T15:00:00.000Z |

### 3.3 전체

- startsAt null
- endsAt null
- 기간 조건 없음

### 3.4 계산 규칙

- 서버의 OS local timezone에 의존하지 않는다.
- date-fns와 @date-fns/tz를 사용해 zone을 명시한다.
- Date 문자열을 수동으로 잘라 offset을 더하는 구현을 여러 곳에 복사하지 않는다.
- utility는 now Instant를 argument로 받아 unit test에서 clock을 고정한다.

## 4. 사용자별 최고 선택

한 사용자 안에서 다음 순서로 가장 앞선 record 한 건을 선택한다.

1. scoreValue 오름차순
2. mistakeCount 오름차순
3. achievedAt 오름차순
4. record id 오름차순

number-click에서 scoreValue는 finalMs다.

설명:

- 최종 기록이 낮을수록 우수하다.
- 최종 기록이 같으면 오클릭이 적은 기록이 우수하다.
- 둘 다 같으면 먼저 달성한 기록이 우수하다.
- DB timestamp까지 같으면 UUID 사전순을 최종 결정자로 사용해 pagination과 test를 결정적으로 만든다.

이 비교 함수는 개인 최고와 랭킹 모두 같은 domain utility 또는 같은 ordering definition을 사용한다.

## 5. 전체 순위

사용자별 최고 한 건을 만든 뒤 같은 정렬 기준으로 전체를 정렬하고 1부터 ROW_NUMBER를 붙인다.

최종 tie-breaker까지 포함하므로 두 사용자에게 같은 순위를 부여하지 않는다. RANK나 DENSE_RANK가 아니라 ROW_NUMBER다.

예:

| 사용자 | finalMs | mistake | achievedAt | 순위 |
|---|---:|---:|---|---:|
| A | 10000 | 0 | 10:00 | 1 |
| B | 10000 | 1 | 09:00 | 2 |
| C | 10000 | 1 | 10:00 | 3 |
| D | 10500 | 0 | 08:00 | 4 |

## 6. Query 구조

PostgreSQL window function을 사용한다. 아래는 의미를 보여주는 구조이며 실제 column mapping은 DATABASE.md를 따른다.

~~~sql
WITH eligible AS (
  SELECT
    r.*,
    ROW_NUMBER() OVER (
      PARTITION BY r.user_id
      ORDER BY
        r.score_value ASC,
        r.mistake_count ASC,
        r.achieved_at ASC,
        r.id ASC
    ) AS user_best_no
  FROM game_record r
  JOIN "user" u ON u.id = r.user_id
  WHERE r.game_id = $1
    AND r.rules_version = $2
    AND r.rank_eligible = true
    AND u.status = 'ACTIVE'
    AND ($3::timestamptz IS NULL OR r.achieved_at >= $3)
    AND ($4::timestamptz IS NULL OR r.achieved_at < $4)
),
ranked AS (
  SELECT
    eligible.*,
    ROW_NUMBER() OVER (
      ORDER BY
        score_value ASC,
        mistake_count ASC,
        achieved_at ASC,
        id ASC
    ) AS rank
  FROM eligible
  WHERE user_best_no = 1
)
SELECT *
FROM ranked
ORDER BY rank
LIMIT $5 OFFSET $6;
~~~

실제 구현:

- Prisma의 parameterized query API를 사용한다.
- 문자열 연결 raw query와 unsafe API를 금지한다.
- startsAt/endsAt이 null일 때 OR 조건이 index 사용을 방해하면 all과 bounded query를 두 개의 정적 SQL로 나눈다.
- ranking list query와 viewer query가 ordering definition을 다르게 쓰지 않는다.
- 실제 서비스는 한 번 계산한 ranked 결과에서 요청 페이지와 viewer를 함께 반환한다. 다음 페이지 판정용 한 행과 페이지 밖 viewer를 구분해 hasMore와 items에 viewer가 섞이지 않게 한다.

## 7. 조회 결과

각 row:

- rank
- Discord avatar URL 또는 fallback
- Discord display name
- finalMs
- mistakeCount
- achievedAt
- isViewer

공개하지 않는 값:

- 내부 user id
- Discord user id
- Discord username
- durationMs와 penaltyMs는 랭킹 목록에서 기본 미노출
- invalidation 사유

로그인 사용자의 record:

- 상위 items 안에 있든 없든 viewer field로 반환한다.
- 해당 기간 후보 record가 없으면 null이다.
- items 안에 있으면 isViewer true다.

## 8. Pagination

- 기본 100개
- limit 1~100
- offset 0~1000
- 정렬은 완전히 deterministic하다.
- 새 기록이 들어오면 offset 페이지 사이에 중복·누락이 생길 수 있으며 MVP에서는 허용한다.
- UI 기본 화면은 첫 100개만 표시한다.
- 무한 scroll은 MVP에 없다.
- 1000명 이후 탐색 요구가 실제로 생기면 cursor 또는 검색을 별도 설계한다.

## 9. 즉시 반영

유효 GameRecord commit 직후 같은 query는 새 기록을 볼 수 있어야 한다.

- ranking application cache 없음
- Redis 없음
- materialized view 없음
- Next.js static cache 없음
- GET response는 no-store

complete response의 rank 조회만 실패해도 record commit은 유지한다. 랭킹 페이지 재조회로 복구한다.

## 10. 성능

DATABASE.md의 두 ranking partial index와 최근 기록 index를 사용한다.

목표:

- 100만 GameRecord 이하, 후보 사용자 10만 이하에서 top 100 p95 500ms 이내
- 실제 production 유사 데이터에서 측정

측정 순서:

1. query count 확인
2. EXPLAIN ANALYZE BUFFERS 실행
3. period와 per-user-best index 사용 확인
4. user join과 sort memory 확인
5. 필요한 경우 query와 index 조정

Redis나 사전 집계를 추가할 조건:

- index와 query 조정 후에도 p95가 500ms를 지속 초과
- 실제 read traffic이 DB 병목임이 측정됨
- record invalidation, ban, rulesVersion 변경을 포함한 cache invalidation 설계가 승인됨

그 전에는 추가하지 않는다.

## 11. 규칙 변경

game.rankedRulesVersion과 record.rulesVersion이 같아야 한다.

number-click penalty나 board 규칙을 비교 불가능하게 변경할 경우:

1. code rulesVersion을 증가한다.
2. 새 session은 currentRulesVersion 새 값을 snapshot한다.
3. 기존 session 처리 정책을 정한다.
4. rankedRulesVersion을 새 값으로 전환한다.
5. 기존 버전 기록은 DB에 남지만 기본 랭킹에서 제외된다.
6. 과거 버전 랭킹 UI는 별도 승인 없이는 만들지 않는다.

오탈자나 점수 비교에 영향을 주지 않는 UI 변경은 rulesVersion을 올리지 않는다.

## 12. 무효화와 ban

- 의심 record는 삭제 대신 rankEligible false, invalidatedAt, invalidatedReason으로 바꾼다.
- 관리 UI는 MVP 비범위다. 운영자 DB 작업도 audit 가능한 절차로만 한다.
- user.status BANNED는 해당 사용자의 모든 기록을 모든 랭킹에서 제외한다.
- 무효화·ban 후 다음 no-store ranking 요청부터 반영된다.
- 개인 최근 기록에는 본인 record가 남을 수 있으나 공개 순위에는 없다.

## 13. UI 동작

- 기본 tab은 오늘이다.
- URL query period=today|week|all과 동기화한다.
- invalid period는 today로 조용히 바꾸지 않고 API는 400, page navigation은 today canonical URL로 redirect할 수 있다.
- 기간 label에 KST 기준을 명시한다.
- loading, empty, error는 UI_GUIDE.md를 따른다.
- 오늘/주간 boundary 근처에서 열린 페이지는 자동 실시간 rollover하지 않는다. tab 변경·새로고침·새 완료 후 조회 시 새 경계를 쓴다.
- 현재 KST 날짜가 바뀐 뒤 사용자가 장시간 열린 페이지에서 완료하면 complete response의 rank가 새 기간 기준이고 UI도 period data를 재조회한다.

## 14. Unit test

### 기간

- KST 00:00 직전/정각
- 월요일 00:00 직전/정각
- UTC 날짜와 KST 날짜가 다른 시각
- 연말·윤년 경계
- all null boundary
- OS timezone을 UTC와 다른 값으로 실행해도 동일

### ordering

- finalMs 차이
- final 동일, mistake 차이
- final/mistake 동일, achievedAt 차이
- 모두 동일, id 차이
- 사용자 다중 기록에서 최고 하나

## 15. Integration test

- 기간 안/경계 직전/endsAt 정확히 위치한 record
- user당 한 row
- 오늘, 주간, 전체에서 서로 다른 best
- BANNED user 제외
- rankEligible false 제외
- old rulesVersion 제외
- viewer top 100 안과 밖
- 비로그인 viewer null
- 빈 ranking
- offset/limit validation
- 동일 score 결정적 순서
- 10만~100만 fixture 또는 별도 performance fixture에서 query plan 확인

성능 test는 일반 unit suite에 거대한 fixture를 매번 만들지 않고 CI nightly 또는 release candidate gate로 분리할 수 있다. correctness test는 항상 실행한다.

## 16. E2E test

- 오늘 기본 tab과 KST label
- tab 변경 시 URL과 목록 변경
- 공식 완료 후 내 row와 순위 반영
- 내 순위가 top 100 밖일 때 viewer card
- 기간 기록 없는 사용자 CTA
- mobile row가 overflow 없이 표시

## 17. Ranking Acceptance Criteria

- [ ] 오늘은 KST 하루, 주간은 KST 월요일 시작 반개구간이다.
- [ ] achievedAt만 기간 판단에 사용한다.
- [ ] user당 기간 최고 한 record만 나온다.
- [ ] finalMs, mistakeCount, achievedAt, id 순으로 결정적으로 정렬한다.
- [ ] 순위는 ROW_NUMBER로 1부터 고유하게 붙는다.
- [ ] ACTIVE user, rankEligible, rankedRulesVersion만 포함한다.
- [ ] 비로그인 공개 조회와 로그인 viewer 조회가 모두 동작한다.
- [ ] top 100 밖 viewer도 별도 field와 UI에서 찾을 수 있다.
- [ ] 완료 commit 뒤 cache 없이 즉시 반영된다.
- [ ] boundary, ordering, exclusion, query plan test가 통과한다.
