# JGD.GG 데이터베이스 설계

문서 책임: PostgreSQL 논리 모델, 필드, 관계, 제약, 인덱스, 트랜잭션 불변식을 정의한다.

## 1. 기본 규칙

- DBMS는 PostgreSQL 18을 기준으로 한다.
- ORM은 Prisma 7.x다.
- Prisma model은 PascalCase, TypeScript field는 camelCase, 실제 table과 column은 snake_case로 map한다.
- 시각은 모두 PostgreSQL timestamptz로 UTC 저장한다.
- ID는 Better Auth가 요구하는 auth id는 text, 애플리케이션 entity는 UUID를 사용한다.
- millisecond, 횟수, 점수는 integer를 사용한다. number-click 값은 32-bit signed integer 범위를 넘지 않는다.
- API 요청 값은 DB 제약 전에 검증하지만 DB 제약을 생략하지 않는다.
- schema 변경은 migration으로만 수행한다. production에서 prisma db push를 사용하지 않는다.
- raw SQL은 parameterized query만 허용한다.

## 2. 관계 개요

~~~text
AuthUser 1 ─── N AuthSession
   │
   ├── N AuthAccount
   ├── N GameSession N ─── 1 Game
   └── N GameRecord  N ─── 1 Game
                   1 ─── 1 GameSession
~~~

Better Auth의 User를 서비스 User로 사용한다. 별도 중복 사용자 테이블을 만들지 않는다.

## 3. enum

### 3.1 UserStatus

| 값 | 의미 |
|---|---|
| ACTIVE | 정상 사용 가능 |
| BANNED | 새 공식 session 생성과 완료 제출 금지 |

### 3.2 GameStatus

| 값 | 의미 |
|---|---|
| ACTIVE | 목록 노출과 공식 플레이 가능 |
| HIDDEN | 새 플레이 금지, 기존 기록과 직접 랭킹 조회는 유지 가능 |

게임 row는 삭제하지 않고 HIDDEN으로 전환한다.

### 3.3 ScoreDirection

| 값 | 의미 |
|---|---|
| ASC | 낮은 scoreValue가 우수 |
| DESC | 높은 scoreValue가 우수 |

number-click은 ASC다.

### 3.4 ScoreUnit

| 값 | 의미 |
|---|---|
| MILLISECONDS | 시간 기반 점수 |
| POINTS | 점수 |
| COUNT | 횟수 |

number-click은 MILLISECONDS다.

### 3.5 GameSessionStatus

| 값 | 의미 | 종료 상태 |
|---|---|---|
| READY | 보드를 발급했고 시작 호출 대기 | 아니오 |
| PLAYING | 서버가 시작을 수락함 | 아니오 |
| COMPLETED | 유효한 기록이 정확히 한 건 생성됨 | 예 |
| ABANDONED | 사용자가 포기했거나 새 session이 대체함 | 예 |
| EXPIRED | 제한 시각을 넘김 | 예 |
| REJECTED | 완료 payload가 도메인 검증에 실패함 | 예 |

## 4. 인증 테이블

Better Auth 1.7.x CLI가 Prisma adapter용 schema를 생성한 결과를 기준으로 한다. library upgrade 때 생성 schema를 임의 덮어쓰지 말고 migration diff를 리뷰한다.

### 4.1 user

Better Auth core field와 JGD.GG 확장 field를 함께 둔다.

| 필드 | DB 타입 | null | 규칙 |
|---|---|---:|---|
| id | text | N | PK. UUID 문자열 생성 전략을 auth config에서 고정 |
| name | text | N | Discord displayName. 없으면 username |
| email | text | N | Better Auth 필수값. 실제 이메일 대신 discordId@discord.placeholder.invalid |
| email_verified | boolean | N | false. 이메일 기능에 사용하지 않음 |
| image | text | Y | HTTPS Discord avatar URL 또는 null |
| discord_username | text | N | 최신 Discord username, 표시 보조용 |
| discord_display_name | text | N | global_name, 없으면 username |
| discord_avatar_hash | text | Y | 최신 avatar hash |
| status | UserStatus | N | default ACTIVE |
| profile_updated_at | timestamptz | N | Discord profile을 마지막 반영한 시각 |
| created_at | timestamptz | N | DB default now |
| updated_at | timestamptz | N | auth/profile 변경 시 갱신 |

제약:

- PK: id
- UNIQUE: email
- CHECK: email LIKE '%@discord.placeholder.invalid'
- CHECK: length(discord_username) BETWEEN 1 AND 64
- CHECK: length(discord_display_name) BETWEEN 1 AND 64
- 실제 Discord user id의 canonical 저장 위치는 account.account_id다. user에 중복 저장하지 않는다.
- display field는 권한 판정에 사용하지 않는다.

Better Auth의 provider mapper가 로그인 때 name, image와 Discord 확장 field를 갱신한다. 사용자 입력으로 이 확장 field를 수정하는 API는 제공하지 않는다. 자세한 규칙은 AUTH.md를 따른다.

### 4.2 session

Better Auth 생성 schema를 따른다. 최소 요구사항:

| 필드 | 규칙 |
|---|---|
| id | PK |
| token | UNIQUE, cookie에는 원문을 안전한 속성으로 저장 |
| user_id | FK user.id ON DELETE CASCADE |
| expires_at | 필수 |
| ip_address | 저장하지 않도록 auth config에서 비활성 또는 null |
| user_agent | 저장하지 않도록 auth config에서 비활성 또는 null |
| created_at, updated_at | 필수 |

인덱스:

- UNIQUE(token)
- INDEX(user_id)
- INDEX(expires_at)

### 4.3 account

Discord provider 계정의 안정 ID를 저장한다.

| 필드 | 규칙 |
|---|---|
| id | PK |
| user_id | FK user.id ON DELETE CASCADE |
| provider_id | Discord는 discord |
| account_id | Discord snowflake 문자열 |
| issuer | provider-id 전략에서 local:oauth:discord |
| access_token | OAuth callback 처리 후 null |
| refresh_token | 저장하지 않고 null |
| access_token_expires_at | token이 null이면 null |
| scope | 저장할 경우 identify만 허용 |
| created_at, updated_at | 필수 |

제약과 인덱스:

- UNIQUE(issuer, account_id): 외부 identity canonical key
- INDEX(user_id)
- 한 user에 Discord account 하나만 허용하는 partial UNIQUE(user_id) WHERE provider_id = 'discord'
- account identity strategy는 provider-id로 고정한다.

JGD.GG는 callback 이후 Discord API를 호출하지 않으므로 provider token을 지속 저장하지 않는다. auth library가 callback 중 임시 저장하면 callback 완료 hook에서 null로 지운다.

### 4.4 verification

Better Auth OAuth state 등 일회성 검증 데이터에 사용한다. generated schema를 따른다.

- identifier lookup index와 expires_at index를 둔다.
- 만료 row는 운영 cleanup 대상이다.
- 값이나 token을 log하지 않는다.

## 5. game

게임 catalog와 랭킹 해석에 필요한 최소 metadata다.

| 필드 | DB 타입 | null | 규칙 |
|---|---|---:|---|
| id | uuid | N | PK, DB gen_random_uuid |
| slug | varchar(64) | N | URL·내부 식별자 |
| display_name | varchar(100) | N | 사용자 표시명 |
| description | text | N | 짧은 설명 |
| status | GameStatus | N | default ACTIVE |
| score_direction | ScoreDirection | N | number-click ASC |
| score_unit | ScoreUnit | N | number-click MILLISECONDS |
| current_rules_version | integer | N | 새 session에 사용 |
| ranked_rules_version | integer | N | 현재 랭킹에 포함할 버전 |
| created_at | timestamptz | N | default now |
| updated_at | timestamptz | N | 갱신 시각 |

제약:

- PK(id)
- UNIQUE(slug)
- CHECK slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
- CHECK current_rules_version >= 1
- CHECK ranked_rules_version >= 1

number-click row는 migration 또는 idempotent seed로 한 건 생성한다.

| 필드 | 값 |
|---|---|
| slug | number-click |
| display_name | 숫자 순서대로 누르기 |
| status | ACTIVE |
| score_direction | ASC |
| score_unit | MILLISECONDS |
| current_rules_version | 1 |
| ranked_rules_version | 1 |

규칙 자체는 code와 features/number-click.md가 Source of Truth다. DB에서 운영자가 penalty를 즉석 변경하지 않는다. 규칙 변경은 code, rulesVersion, test, migration/seed를 한 변경으로 처리한다.

## 6. game_session

공식 플레이의 서버 발급 수명 주기를 표현한다.

| 필드 | DB 타입 | null | 규칙 |
|---|---|---:|---|
| id | uuid | N | PK, 예측 불가능한 UUID |
| user_id | text | N | FK user.id ON DELETE CASCADE |
| game_id | uuid | N | FK game.id ON DELETE RESTRICT |
| status | GameSessionStatus | N | 초기 READY |
| idempotency_key | uuid | N | start-create 요청 멱등성 key |
| rules_version | integer | N | 생성 시 game.currentRulesVersion snapshot |
| rules_snapshot | jsonb | N | version, boardSize, maxNumber, penaltyPerMistakeMs |
| challenge_data | jsonb | N | schemaVersion과 server-generated board |
| created_at | timestamptz | N | server 생성 시각 |
| ready_expires_at | timestamptz | N | createdAt + 60초 |
| started_at | timestamptz | Y | start endpoint가 최초 수락된 시각 |
| expires_at | timestamptz | Y | startedAt + 5분 |
| completed_at | timestamptz | Y | 유효 완료 최초 수락 시각 |
| terminal_reason | varchar(64) | Y | EXPIRED, ABANDONED, REJECTED 이유 code |

number-click rules_snapshot version 1:

~~~json
{
  "version": 1,
  "boardSize": 5,
  "maxNumber": 25,
  "penaltyPerMistakeMs": 500,
  "minimumDurationMs": 3000,
  "maximumDurationMs": 300000,
  "maximumClickCount": 100
}
~~~

number-click challenge_data version 1:

~~~json
{
  "schemaVersion": 1,
  "board": [17, 1, 9, 25, 4, 12, 6, 20, 3, 14, 8, 23, 2, 19, 11, 24, 7, 15, 21, 5, 18, 10, 22, 16, 13]
}
~~~

제약:

- UNIQUE(user_id, idempotency_key)
- CHECK jsonb_typeof(rules_snapshot) = 'object'
- CHECK jsonb_typeof(challenge_data) = 'object'
- CHECK rules_version >= 1
- CHECK ready_expires_at > created_at
- CHECK started_at IS NULL OR started_at >= created_at
- CHECK expires_at IS NULL OR expires_at > started_at
- CHECK completed_at IS NULL OR completed_at >= started_at
- 상태별 CHECK는 다음 표를 만족해야 한다.

| status | startedAt | expiresAt | completedAt |
|---|---:|---:|---:|
| READY | null | null | null |
| PLAYING | not null | not null | null |
| COMPLETED | not null | not null | not null |
| ABANDONED | 어떤 값도 가능 | 어떤 값도 가능 | null |
| EXPIRED | 어떤 값도 가능 | 어떤 값도 가능 | null |
| REJECTED | not null | not null | null |

partial unique index:

~~~sql
CREATE UNIQUE INDEX game_session_one_live_per_user_game
ON game_session (user_id, game_id)
WHERE status IN ('READY', 'PLAYING');
~~~

조회 인덱스:

- INDEX(user_id, game_id, created_at DESC)
- partial INDEX(status, ready_expires_at) WHERE status = 'READY'
- partial INDEX(status, expires_at) WHERE status = 'PLAYING'

Prisma schema가 partial index와 복합 CHECK를 표현하지 못하면 생성 migration에 검토된 SQL을 추가한다.

## 7. game_record

유효하게 완료된 공식 기록만 저장한다. 실패·거절 제출은 GameSession terminal 상태로 남고 GameRecord를 만들지 않는다.

| 필드 | DB 타입 | null | 규칙 |
|---|---|---:|---|
| id | uuid | N | PK |
| session_id | uuid | N | FK game_session.id ON DELETE CASCADE |
| user_id | text | N | FK user.id ON DELETE CASCADE |
| game_id | uuid | N | FK game.id ON DELETE RESTRICT |
| rules_version | integer | N | session 값과 동일 |
| duration_ms | integer | N | 실제 플레이 시간 |
| mistake_count | integer | N | 서버 재계산 오클릭 수 |
| penalty_ms | integer | N | mistakeCount × rules snapshot penalty |
| score_value | integer | N | number-click에서는 durationMs + penaltyMs |
| click_count | integer | N | 수락된 전체 입력 event 수 |
| server_elapsed_ms | integer | N | completedAt - startedAt |
| result_data | jsonb | N | schemaVersion, boardDigest, validationVersion |
| achieved_at | timestamptz | N | 서버가 최초 유효 완료를 수락한 시각 |
| rank_eligible | boolean | N | default true |
| invalidated_at | timestamptz | Y | 운영자 무효화 시각 |
| invalidated_reason | varchar(255) | Y | 내부 사유, 공개 API 미노출 |
| created_at | timestamptz | N | default now |

제약:

- UNIQUE(session_id): 한 session당 기록 최대 한 건
- CHECK rules_version >= 1
- CHECK duration_ms BETWEEN 1 AND 300000
- CHECK mistake_count BETWEEN 0 AND 75
- CHECK penalty_ms >= 0
- CHECK score_value >= duration_ms
- CHECK click_count BETWEEN 25 AND 100
- CHECK server_elapsed_ms >= 0
- CHECK jsonb_typeof(result_data) = 'object'
- CHECK (rank_eligible AND invalidated_at IS NULL AND invalidated_reason IS NULL) OR (NOT rank_eligible)
- number-click application invariant: penaltyMs = mistakeCount × 500
- number-click application invariant: scoreValue = durationMs + penaltyMs
- user_id, game_id, rules_version는 연결 session의 값과 같아야 한다.

마지막 세 불변식은 완료 transaction에서 강제하고 integration test로 검증한다. 중복 field는 랭킹 query가 session join 없이 동작하도록 의도적으로 둔다.

result_data version 1 예:

~~~json
{
  "schemaVersion": 1,
  "validationVersion": 1,
  "clientElapsedMs": 14200,
  "boardDigest": "sha256-base64url"
}
~~~

전체 클릭 trace는 저장하지 않는다. 리플레이 시스템은 MVP 비범위이며 불필요한 데이터 증가를 피한다.

## 8. GameRecord 인덱스

### 8.1 개인 최근 기록

~~~sql
CREATE INDEX game_record_user_recent
ON game_record (user_id, game_id, achieved_at DESC);
~~~

### 8.2 사용자별 최고 기록 선택

~~~sql
CREATE INDEX game_record_best_per_user
ON game_record (
  game_id,
  rules_version,
  user_id,
  score_value,
  mistake_count,
  achieved_at,
  id
)
WHERE rank_eligible = true;
~~~

### 8.3 기간 필터

~~~sql
CREATE INDEX game_record_period
ON game_record (
  game_id,
  rules_version,
  achieved_at,
  user_id
)
INCLUDE (score_value, mistake_count, id)
WHERE rank_eligible = true;
~~~

초기 데이터에서도 위 세 인덱스는 둔다. 추가 인덱스는 실제 EXPLAIN ANALYZE 근거 없이 만들지 않는다.

## 9. 삭제와 보존

| 데이터 | 정책 |
|---|---|
| GameRecord | 사용자가 존재하는 동안 보존. user 삭제 시 CASCADE |
| COMPLETED GameSession | 기록 audit를 위해 보존 |
| ABANDONED, EXPIRED, REJECTED GameSession | 90일 보존 후 운영 cleanup 가능 |
| READY/PLAYING GameSession | 요청 시 lazy expiration. 운영 cleanup으로도 terminal 전환 가능 |
| Better Auth verification | 만료 후 7일 이내 cleanup |
| OAuth access/refresh token | callback 완료 후 저장하지 않음 |
| 실제 이메일, IP, user agent | 수집하지 않음 |

MVP에 상시 background worker를 추가하지 않는다. cleanup은 배포 플랫폼 scheduled job이 실제로 필요해졌을 때 별도 승인한다. cleanup 부재가 correctness에 영향을 주면 안 된다.

## 10. 핵심 트랜잭션

### 10.1 session 생성

SERIALIZABLE까지 올리지 않고 기본 READ COMMITTED와 partial unique index를 사용한다.

1. 같은 user와 idempotencyKey row가 있으면 그대로 반환한다.
2. 같은 user/game의 READY 또는 PLAYING을 row lock 후 ABANDONED로 바꾼다.
3. 새 READY row를 만든다.
4. partial unique 충돌 시 idempotency row를 재조회하거나 한 번 재시도한다.

### 10.2 session 시작

1. session row를 FOR UPDATE 한다.
2. 소유자와 상태를 확인한다.
3. READY이며 readyExpiresAt 이전이면 PLAYING, startedAt = DB now, expiresAt = now + 5분으로 갱신한다.
4. 이미 PLAYING이면 기존 값으로 200을 반환한다.
5. READY가 만료됐으면 EXPIRED로 바꾸고 오류를 반환한다.

### 10.3 완료

1. session row를 FOR UPDATE 한다.
2. COMPLETED이고 연결 record가 있으면 기존 결과를 반환한다.
3. PLAYING이 아니거나 만료됐으면 적절한 terminal 상태와 오류를 반환한다.
4. event replay와 시간 검증을 application service가 수행한다.
5. 도메인 검증 실패면 REJECTED로 갱신하고 record는 만들지 않는다.
6. 성공이면 GameRecord를 insert한다.
7. GameSession을 COMPLETED로 갱신한다.
8. commit한다.

GameRecord UNIQUE(session_id)와 row lock이 동시에 들어온 완료 요청을 최종 방어한다.

## 11. 랭킹 query 계약

정확한 query 결과 규칙은 features/ranking.md를 따른다. DB 구현은 두 단계 window query를 사용한다.

1. eligible_records에서 game, rankedRulesVersion, period, rankEligible, ACTIVE user를 필터한다.
2. ROW_NUMBER OVER (PARTITION BY userId ORDER BY scoreValue ASC, mistakeCount ASC, achievedAt ASC, id ASC)로 사용자 최고를 선택한다.
3. best_per_user의 rn = 1만 대상으로 ROW_NUMBER OVER (ORDER BY 같은 기준)를 rank로 계산한다.

scoreDirection DESC 게임을 추가할 때 query builder는 방향을 allowlist에서 선택해야 한다. 사용자 입력을 SQL keyword로 삽입하지 않는다. MVP number-click query는 ASC로 고정해도 된다.

## 12. Migration과 seed

- migration 이름은 의도를 나타낸다. 예: init_auth_and_game_models, add_ranking_indexes.
- migration SQL 생성 후 destructive operation과 table lock 영향을 리뷰한다.
- partial index와 CHECK를 삭제하거나 재생성한 이유를 migration 주석에 남긴다.
- seed는 number-click Game row를 slug 기준 upsert한다.
- seed는 임의 사용자나 production 기록을 만들지 않는다.
- integration test DB는 prisma migrate deploy 후 fixture를 넣는다.
- migration 수정 금지: 공유되거나 적용된 migration은 고치지 않고 새 migration을 추가한다.

## 13. Database Acceptance Criteria

- [ ] user, account, session, verification은 pinned Better Auth schema와 호환된다.
- [ ] 실제 Discord 이메일, OAuth token, IP, user agent를 영구 저장하지 않는다.
- [ ] number-click Game row가 idempotent seed로 생성된다.
- [ ] 한 user/game에는 READY 또는 PLAYING session이 최대 하나다.
- [ ] 한 GameSession에는 GameRecord가 최대 하나다.
- [ ] 완료 transaction이 session lock과 record unique 제약을 모두 사용한다.
- [ ] 기록 점수 구성요소가 별도 column에 저장된다.
- [ ] 랭킹용 partial index와 기간 index가 migration SQL에 존재한다.
- [ ] 모든 기간 시각은 timestamptz UTC다.
- [ ] integration test가 CHECK, FK, UNIQUE, CASCADE를 검증한다.

