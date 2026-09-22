# JGD.GG HTTP API 명세

문서 책임: 애플리케이션 HTTP endpoint, 인증, 요청·응답 schema, 오류와 멱등성 계약을 정의한다.

## 1. 공통 규약

- Base path: /api/v1
- 인증 경로: /api/auth 아래는 Better Auth가 소유하며 v1 규약을 적용하지 않는다.
- Content-Type: application/json; charset=utf-8
- JSON field: camelCase
- DB entity를 그대로 serialize하지 않고 명시한 DTO만 반환한다.
- timestamp: UTC ISO 8601 문자열. 예: 2026-09-06T03:12:45.123Z
- duration/score: 정수 millisecond
- ID: UUID 문자열 또는 auth user text ID. 공개 응답에는 내부 userId를 반환하지 않는다.
- mutation 응답은 Cache-Control: no-store다.
- ranking, 개인 통계와 포인트 조회도 Cache-Control: no-store다.
- 알 수 없는 request field는 Zod strict schema로 거부한다.
- request body 최대 크기는 완료 endpoint 16KB, 그 외 JSON endpoint 4KB다.

## 2. 공통 envelope

성공:

~~~json
{
  "data": {},
  "meta": {
    "requestId": "018f..."
  }
}
~~~

실패:

~~~json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 값이 올바르지 않습니다.",
    "details": [
      {
        "path": "events.0.value",
        "reason": "정수 1~25여야 합니다."
      }
    ]
  },
  "meta": {
    "requestId": "018f..."
  }
}
~~~

규칙:

- production message는 사용자에게 안전한 한국어 문구다.
- details는 validation 오류에서만 안전한 field 정보로 제한한다.
- stack, SQL, OAuth 응답, token, 내부 invalidation 사유를 반환하지 않는다.
- 예상하지 못한 오류는 INTERNAL_ERROR와 requestId만 반환한다.

## 3. 인증과 공통 오류

| 상황 | HTTP | code |
|---|---:|---|
| 로그인 필요 | 401 | AUTH_REQUIRED |
| session 만료 | 401 | AUTH_SESSION_EXPIRED |
| BANNED user | 403 | USER_BANNED |
| 허용되지 않은 Origin | 403 | ORIGIN_NOT_ALLOWED |
| 리소스를 찾을 수 없거나 타인 소유 | 404 | NOT_FOUND |
| JSON/schema 오류 | 400 | VALIDATION_ERROR |
| 지원하지 않는 media type | 415 | UNSUPPORTED_MEDIA_TYPE |
| body 초과 | 413 | PAYLOAD_TOO_LARGE |
| 예상하지 못한 서버 오류 | 500 | INTERNAL_ERROR |

타인의 session 여부를 추측하지 못하게 존재하지 않는 session과 타인 소유 session은 모두 404 NOT_FOUND다.

모든 POST·PUT·DELETE는 same-origin Origin 검사를 통과해야 한다. production에서 Origin이 없거나 BETTER_AUTH_URL origin과 다르면 거부한다. cookie는 AUTH.md의 SameSite 정책을 따른다.

## 4. Endpoint 요약

| Method | Path | 인증 | 목적 |
|---|---|---|---|
| GET | /api/v1/games/number-click | 선택 | 규칙과 공개·개인 요약 |
| POST | /api/v1/games/number-click/sessions | 필수 | READY 공식 session 생성 |
| POST | /api/v1/game-sessions/{sessionId}/start | 필수 | READY를 PLAYING으로 전환 |
| POST | /api/v1/game-sessions/{sessionId}/complete | 필수 | 결과 검증과 기록 생성 |
| POST | /api/v1/game-sessions/{sessionId}/abandon | 필수 | 미완료 session 포기 |
| GET | /api/v1/games/number-click/rankings | 선택 | 기간 랭킹 |
| GET | /api/v1/me/games/number-click/stats | 필수 | 개인 기록 요약 |
| GET | /api/v1/me/titles | 로그인 | 본인 소장·장착·잔액 조회 |
| POST | /api/v1/me/titles/purchase | ACTIVE·대상 서버 멤버 | 500P 칭호 구매 |
| POST | /api/v1/me/titles/equipment | ACTIVE·대상 서버 멤버 | 무료 장착·해제·재적용 요청 |
| POST | /api/v1/me/titles/sync | ACTIVE | 대기 중 역할 적용 재시도, 외부 멤버 확인 실패 시 대기 유지 |
| GET | /api/v1/me/points | 필수 | 본인 확정 포인트 잔액과 최근 원장 |
| GET·PUT·DELETE | /api/v1/me/game-profile | ACTIVE·대상 서버 멤버 | 본인 게임 프로필 조회·전체 저장·삭제 |
| GET | /api/v1/game-profiles | ACTIVE·대상 서버 멤버 | 멤버 게임 프로필 목록 |

연습 플레이는 서버 API를 호출하지 않는다.

## 5. GET /api/v1/games/number-click

게임 화면 초기화용 규칙과 요약을 반환한다.

### Query

없음. query string이 있으면 알려지지 않은 field는 무시하지 않고 400으로 거부한다.

### 인증

선택. 유효 session이면 viewer 데이터를 포함하고, 없으면 viewer는 null이다. 잘못된 cookie가 있어도 공개 조회는 401이 아니라 viewer null로 동작한다.

### 200 response

~~~json
{
  "data": {
    "game": {
      "slug": "number-click",
      "name": "숫자 순서대로 누르기",
      "status": "ACTIVE",
      "rules": {
        "version": 1,
        "boardSize": 5,
        "maxNumber": 25,
        "penaltyPerMistakeMs": 500,
        "minimumDurationMs": 3000,
        "maximumDurationMs": 300000
      }
    },
    "todayBest": {
      "displayName": "JGD User",
      "avatarUrl": "https://cdn.discordapp.com/...",
      "finalMs": 14370,
      "mistakeCount": 0
    },
    "viewer": {
      "displayName": "My Name",
      "avatarUrl": "https://cdn.discordapp.com/...",
      "personalBest": {
        "finalMs": 15200,
        "durationMs": 14200,
        "mistakeCount": 2,
        "penaltyMs": 1000,
        "achievedAt": "2026-09-05T11:00:00.000Z"
      }
    }
  },
  "meta": {
    "requestId": "018f..."
  }
}
~~~

기록이 없으면 todayBest 또는 personalBest는 null이다. HIDDEN 게임은 404 GAME_NOT_AVAILABLE을 반환한다.

## 6. POST /api/v1/games/number-click/sessions

공식 게임을 위한 READY session과 server-generated board를 만든다.

### Headers

| 이름 | 필수 | 규칙 |
|---|---:|---|
| Content-Type | 예 | application/json |
| Idempotency-Key | 예 | UUID, 같은 user에서 재사용 시 같은 session 반환 |

### Request

body는 정확히 빈 object다.

~~~json
{}
~~~

### 처리

- user가 ACTIVE인지 확인한다.
- Game이 ACTIVE인지 확인한다.
- 같은 user와 Idempotency-Key session이 있으면 상태와 무관하게 그 session DTO를 반환한다.
- 새 key면 기존 READY/PLAYING session을 ABANDONED로 바꾸고 새 READY를 만든다.
- board는 CSPRNG 기반 Fisher-Yates로 1~25를 정확히 한 번씩 섞는다.

### 201 response

~~~json
{
  "data": {
    "session": {
      "id": "6fd7c33f-...",
      "status": "READY",
      "rulesVersion": 1,
      "readyExpiresAt": "2026-09-06T03:13:45.123Z"
    },
    "board": [17, 1, 9, 25, 4, 12, 6, 20, 3, 14, 8, 23, 2, 19, 11, 24, 7, 15, 21, 5, 18, 10, 22, 16, 13],
    "rules": {
      "boardSize": 5,
      "maxNumber": 25,
      "penaltyPerMistakeMs": 500
    }
  },
  "meta": {
    "requestId": "018f...",
    "idempotentReplay": false
  }
}
~~~

같은 key 재요청은 200이고 idempotentReplay true다.

### 오류

| HTTP | code | 조건 |
|---:|---|---|
| 400 | IDEMPOTENCY_KEY_INVALID | header 누락 또는 UUID 아님 |
| 404 | GAME_NOT_AVAILABLE | 게임 미존재 또는 HIDDEN |
| 409 | SESSION_CREATE_CONFLICT | DB unique 충돌 재시도 후에도 해결되지 않음 |

## 7. POST /api/v1/game-sessions/{sessionId}/start

READY session을 PLAYING으로 바꾸며 서버 측 시작 시각을 고정한다.

### Request

path sessionId는 UUID, body는 정확히 빈 object다.

~~~json
{}
~~~

### 200 response

~~~json
{
  "data": {
    "session": {
      "id": "6fd7c33f-...",
      "status": "PLAYING",
      "startedAt": "2026-09-06T03:13:02.000Z",
      "expiresAt": "2026-09-06T03:18:02.000Z"
    }
  },
  "meta": {
    "requestId": "018f...",
    "idempotentReplay": false
  }
}
~~~

클라이언트는 성공 response를 받은 직후 performance.now를 기준점으로 저장하고 보드를 활성화한다.

### 멱등성

- 이미 PLAYING이면 최초 startedAt과 expiresAt을 200으로 반환하고 idempotentReplay true다.
- COMPLETED이면 409 SESSION_ALREADY_COMPLETED다.
- READY 만료면 transaction에서 EXPIRED로 바꾸고 410 SESSION_EXPIRED다.
- ABANDONED, EXPIRED, REJECTED면 409 SESSION_NOT_STARTABLE이다.

## 8. POST /api/v1/game-sessions/{sessionId}/complete

클라이언트 event를 검증하고 서버가 점수를 계산해 GameRecord를 하나 만든다.

### Request schema

~~~json
{
  "clientElapsedMs": 14200,
  "events": [
    { "value": 1, "elapsedMs": 410 },
    { "value": 3, "elapsedMs": 730 },
    { "value": 2, "elapsedMs": 920 }
  ]
}
~~~

| field | 규칙 |
|---|---|
| clientElapsedMs | safe integer, 0~600000. 게임 규칙의 공식 허용 범위는 server domain validation이 판정 |
| events | array, 25~100개 |
| events[].value | integer, 1~25 |
| events[].elapsedMs | safe integer, 0~clientElapsedMs, 최대 600000 |

추가 도메인 validation:

- elapsedMs는 이전 event 이상인 nondecreasing 순서다.
- event value는 session board에 존재해야 한다.
- nextExpected를 1에서 시작해 event를 재생한다.
- value가 nextExpected이면 correct이고 nextExpected를 1 올린다.
- 그 외 event는 오클릭 1회다.
- 마지막 event가 correct 25여야 하며 그 elapsedMs는 clientElapsedMs와 정확히 같아야 한다.
- correct 1~25가 모두 있어야 한다.
- 오클릭은 최대 75회다.
- clientElapsedMs는 최소 3000ms다.
- clientElapsedMs는 최대 300000ms다.
- serverElapsedMs + 1000ms가 clientElapsedMs보다 작으면 불가능한 시계 관계로 거부한다.
- session expiresAt 이후 도착한 요청은 거부한다. 완료 event가 만료 전이라고 주장해도 서버 도착 시각을 기준으로 한다.

client가 mistakeCount, penaltyMs, finalMs를 보내는 것은 schema 오류다.

### 200 response

~~~json
{
  "data": {
    "record": {
      "id": "a3eb3f88-...",
      "gameSlug": "number-click",
      "durationMs": 14200,
      "mistakeCount": 2,
      "penaltyMs": 1000,
      "finalMs": 15200,
      "achievedAt": "2026-09-06T03:13:16.450Z"
    },
    "result": {
      "isPersonalBest": true,
      "previousPersonalBestMs": 15840
    },
    "ranks": {
      "today": 7,
      "week": 21,
      "all": 48
    },
    "points": {
      "status": "AWARDED",
      "awarded": 10,
      "balance": 40,
      "dailyLimit": 50,
      "policyVersion": "number-click-completion-v1"
    }
  },
  "meta": {
    "requestId": "018f...",
    "idempotentReplay": false
  }
}
~~~

rank가 없을 수 없지만 후속 rank query가 일시 실패하면 완료 기록 자체를 rollback하지 않는다. 이 경우 ranks 값은 null이고 meta에 rankLookupFailed true를 포함하며 200을 반환한다. 클라이언트는 랭킹 링크를 제공한다.

points.status는 다음 중 하나다.

| 값 | 의미 |
|---|---|
| AWARDED | 이 기록에 awarded 10P를 적립함 |
| DAILY_LIMIT_REACHED | KST 당일 50P 한도로 awarded 0 |
| NOT_ELIGIBLE | 정책 적용 시작 이전 기록이어서 awarded 0 |
| REVERSED | 이 기록의 기존 적립이 무효화 회수돼 awarded 0 |

balance는 응답 생성 시 DB에서 확인한 현재 확정 잔액이다. 동일 완료 replay는 최초 transaction에서 GameRecord.resultData에 기록한 포인트 결정을 반환하며 적립을 다시 실행하지 않는다.

### 멱등성

- 최초 유효 완료만 record를 만든다.
- 같은 소유자가 COMPLETED session에 다시 요청하면 body를 다시 평가하지 않고 기존 record와 현재 best/rank를 200으로 반환한다.
- meta.idempotentReplay는 true다.
- 동시에 들어온 요청도 row lock과 UNIQUE(session_id)로 한 record만 만든다.

### 도메인 오류

| HTTP | code | session 결과 | 조건 |
|---:|---|---|---|
| 409 | SESSION_NOT_PLAYING | 변경 없음 | READY 또는 ABANDONED |
| 410 | SESSION_EXPIRED | EXPIRED | expiresAt 경과 |
| 422 | RESULT_INCOMPLETE | REJECTED | 25까지 정상 완료 안 됨 |
| 422 | RESULT_TOO_FAST | REJECTED | 3000ms 미만 |
| 422 | RESULT_TOO_LONG | REJECTED | 300000ms 초과 |
| 422 | RESULT_EVENT_ORDER_INVALID | REJECTED | elapsed 순서 또는 마지막 event 불일치 |
| 422 | RESULT_CLICK_LIMIT_EXCEEDED | REJECTED | domain click 최대 초과 |
| 422 | RESULT_CLOCK_INVALID | REJECTED | 서버 시작보다 불가능하게 긴 client 시간 |
| 422 | RESULT_BOARD_INVALID | REJECTED | session board와 맞지 않는 value |

Zod 구조 오류는 transaction 전에 400이며 session을 REJECTED로 바꾸지 않는다. 구조는 맞지만 게임 규칙을 위반한 payload만 REJECTED로 소비한다.

## 9. POST /api/v1/game-sessions/{sessionId}/abandon

페이지에서 명시적으로 나가거나 다시 하기를 시작하기 전에 현재 session을 포기할 때 사용한다. 브라우저 종료 시 성공을 보장하지 않으므로 correctness는 만료 처리에 의존한다.

### Request

body는 빈 object다.

### Response

- READY 또는 PLAYING: ABANDONED로 바꾸고 204 No Content
- 이미 terminal: 상태를 바꾸지 않고 204
- 미존재 또는 타인 소유: 404 NOT_FOUND

204에는 JSON body가 없다.

## 10. GET /api/v1/games/number-click/rankings

기간 안의 사용자별 최고 기록을 정렬한다.

### Query

| 이름 | 필수 | 기본 | 규칙 |
|---|---:|---|---|
| period | 아니오 | today | today, week, all 중 하나 |
| limit | 아니오 | 100 | integer 1~100 |
| offset | 아니오 | 0 | integer 0~1000 |

### 200 response

~~~json
{
  "data": {
    "gameSlug": "number-click",
    "period": {
      "key": "today",
      "timeZone": "Asia/Seoul",
      "startsAt": "2026-09-05T15:00:00.000Z",
      "endsAt": "2026-09-06T15:00:00.000Z"
    },
    "items": [
      {
        "rank": 1,
        "displayName": "Player",
        "avatarUrl": "https://cdn.discordapp.com/...",
        "finalMs": 9830,
        "mistakeCount": 0,
        "achievedAt": "2026-09-06T01:00:00.000Z",
        "isViewer": false
      }
    ],
    "viewer": {
      "rank": 152,
      "displayName": "Me",
      "avatarUrl": "https://cdn.discordapp.com/...",
      "finalMs": 18020,
      "mistakeCount": 1,
      "achievedAt": "2026-09-06T02:00:00.000Z",
      "isViewer": true
    },
    "pagination": {
      "limit": 100,
      "offset": 0,
      "returned": 100,
      "hasMore": true
    }
  },
  "meta": {
    "requestId": "018f..."
  }
}
~~~

규칙:

- all의 startsAt과 endsAt은 null이다.
- 로그인하지 않았거나 해당 기간 기록이 없으면 viewer는 null이다.
- viewer가 items 안에 있어도 viewer field에 같은 row를 반환한다.
- items가 비면 빈 array다.
- user.status BANNED 또는 record.rankEligible false는 제외한다.
- pagination 중 새 기록으로 순위가 변할 수 있다. snapshot 일관성을 보장하지 않는다.

## 11. GET /api/v1/me/games/number-click/stats

로그인 사용자의 number-click 요약이다.

### 200 response

~~~json
{
  "data": {
    "gameSlug": "number-click",
    "completedPlayCount": 42,
    "best": {
      "all": {
        "finalMs": 15200,
        "durationMs": 14200,
        "mistakeCount": 2,
        "penaltyMs": 1000,
        "achievedAt": "2026-09-05T11:00:00.000Z"
      },
      "today": null,
      "week": {
        "finalMs": 15200,
        "durationMs": 14200,
        "mistakeCount": 2,
        "penaltyMs": 1000,
        "achievedAt": "2026-09-05T11:00:00.000Z"
      }
    },
    "recent": [
      {
        "finalMs": 16110,
        "durationMs": 15610,
        "mistakeCount": 1,
        "penaltyMs": 500,
        "achievedAt": "2026-09-06T03:00:00.000Z"
      }
    ]
  },
  "meta": {
    "requestId": "018f..."
  }
}
~~~

recent는 achievedAt 내림차순 최대 10개이며 rankEligible 여부와 무관하게 본인 기록을 보여준다. 무효화 사유는 노출하지 않고 invalidated true만 필요할 때 추가할 수 있으나 MVP UI에는 표시하지 않는다.

## 12. GET /api/v1/me/points

로그인한 본인의 확정 포인트 잔액과 최근 append-only 변동 원장 최대 20개를 반환한다. BANNED 사용자의 조회도 허용한다. userId path나 query를 받지 않으므로 타인 계정을 지정할 수 없다.

### 200 response

~~~json
{
  "data": {
    "balance": 40,
    "unit": "P",
    "transactions": [
      {
        "id": "b4ce91a4-...",
        "type": "EARN",
        "reason": "NUMBER_CLICK_COMPLETION",
        "amount": 10,
        "balanceAfter": 40,
        "policyVersion": "number-click-completion-v1",
        "createdAt": "2026-09-12T03:00:00.000Z"
      }
    ]
  },
  "meta": {
    "requestId": "018f..."
  }
}
~~~

규칙:

- transaction은 createdAt DESC, id DESC 순이며 최대 20개다.
- 내역이 없으면 transactions는 빈 array이고 balance는 0이다.
- amount는 EARN이면 양수, REVERSAL이면 음수다.
- 내부 invalidatedReason, userId와 GameRecord id는 반환하지 않는다.
- 계정 누락이나 잔액·원장 불일치는 정상값으로 보정하지 않고 500 INTERNAL_ERROR다.

## 12.1 스토리 API

| Method | Path | 인증 / 계약 |
|---|---|---|
| GET | /api/v1/stories | 공개 프로필 목록, 로그인은 선택. 선택 query `cursor` UUID 외 field 거부 |
| POST | /api/v1/stories | ACTIVE·same-origin 필수. `Idempotency-Key` UUID와 raw image body |
| GET | /api/v1/stories/{storyId}/image | 로그인 필수. 선택 query `size=image\|thumbnail` (기본 image) |

목록의 data는 `{ items, serverNow, nextCursor }`다. 단일 사진 DTO는 `{ id, displayName, avatarUrl, isViewer, createdAt, expiresAt }`이며 avatarUrl은 작성자의 Discord 프로필 URL 또는 null이다. items는 이 DTO에 `stories: 단일 사진 DTO[]`를 추가한 작성자별 묶음이다. 묶음의 최상위 id/시각은 해당 작성자의 최신 유효 사진을 가리키며 stories는 `(createdAt ASC, id ASC)` 순 전체 유효 사진이다. 서버는 내부 작성자 키로 묶고 브라우저에 userId를 공개하지 않는다.

작성자별 최신 사진 `(createdAt DESC, id DESC)` 순 30명씩 페이지를 나누고 각 작성자의 사진은 같은 페이지에 전부 포함한다. cursor는 이전 페이지 마지막 묶음의 최신 사진 UUID이며 다음 페이지가 없으면 nextCursor는 null이다. 비로그인은 isViewer가 false이며 사진 byte·내부 userId는 반환하지 않는다. 만료되거나 BANNED 작성자의 스토리는 제외한다. 클라이언트는 serverNow 기준으로 각 사진의 만료를 갱신한다.

게시 Content-Type은 image/jpeg, image/png, image/webp 중 하나이며 JSON 공통 body 제한의 예외로 최대 5MiB raw image를 받는다. 원본 파일명·userId·displayName·createdAt·expiresAt은 입력받지 않는다. 실제 stream 크기와 이미지 디코딩을 검사한다. 최초 성공은 201, 같은 사용자/키 replay는 200이며 data는 `{ story: 단일 사진 DTO }`, meta.idempotentReplay를 제공한다. 재전송은 처음 수락한 사진/시각을 유지한다.

오류: 부적절한 게시 키 400 STORY_UPLOAD_KEY_INVALID, 손상/위장/빈/과대 픽셀/애니메이션 사진 400 STORY_IMAGE_INVALID, 지원하지 않는 Content-Type 415 STORY_IMAGE_INVALID, raw body 초과 413 PAYLOAD_TOO_LARGE, 직전 24시간 내 10장 초과 429 STORY_UPLOAD_LIMIT. 공통 AUTH_REQUIRED, USER_BANNED, ORIGIN_NOT_ALLOWED도 적용한다.

이미지 조회는 만료·미존재·차단 작성자를 404 NOT_FOUND로 처리한다. **원본 조회 옵션은 없다.** 성공만 JSON envelope 예외로 image/jpeg byte와 X-Request-Id, Cache-Control: private, no-store, Vary: Cookie, X-Content-Type-Options: nosniff, Cross-Origin-Resource-Policy: same-origin을 반환한다. 실패는 기존 JSON 오류 envelope다. 목록과 게시도 no-store다.

## 12.2 게임 프로필 API

공통 인증에 더해 [AUTH.md](AUTH.md)의 대상 서버 멤버 검사를 적용한다. 비멤버는 403 `GUILD_MEMBER_REQUIRED`, 확인 장애·설정 누락은 503 `GUILD_MEMBERSHIP_UNAVAILABLE`다. BANNED는 조회도 403이며 기존 포인트·기록 조회 정책은 변경하지 않는다. 성공·실패 모두 no-store다.

`GET /api/v1/me/game-profile`은 query를 받지 않고 `{ profile: 카드|null }`을 반환한다.

`PUT /api/v1/me/game-profile`은 4KB 이하의 strict JSON `{ games: [{ game, nickname, tier }] }`로 전체 카드를 저장한다. game은 `lol|pubg|overwatch`, games는 중복 없는 1~3개, nickname은 trim 후 1~64자, tier는 null 또는 trim 후 1~32자다. 제어·숨은 문자와 꺾쇠는 거부한다. 티어 생략은 허용하지 않고 미입력을 null로 보낸다. userId, profileId, displayName, 검증 상태 등 추가 field와 query는 거부한다. 성공은 200 `{ profile: 카드 }`다. 같은 요청을 반복해도 카드는 중복 생성되지 않으며 마지막 직렬 처리된 전체 저장이 남는다.

`DELETE /api/v1/me/game-profile`은 query 없이 strict JSON `{}`를 받아 본인 전체 카드와 항목을 삭제한다. 존재하지 않아도 200 `{ profile: null }`로 반복 가능하다. PUT·DELETE 모두 same-origin 검사를 통과해야 한다.

카드 DTO: `{ id, displayName, avatarUrl, isViewer, source: "SELF_REPORTED", games, updatedAt }`. id는 카드 UUID이며 내부 userId·Discord ID·token은 포함하지 않는다. games는 LoL·PUBG·Overwatch 순이다.

`GET /api/v1/game-profiles`의 선택 query는 `game`과 `cursor`(카드 UUID)뿐이며 추가·중복 query를 거부한다. 반환은 `{ items: 카드[], nextCursor: UUID|null }`이다. 생성 시각 DESC·id DESC로 12개 후보씩 조회하고 해당 페이지 작성자의 멤버 여부를 확인한다. 탈퇴·차단 작성자는 숨긴다. 게임 필터에 일치하는 멤버의 카드에는 그 멤버의 전체 등록 게임을 포함한다. cursor는 마지막 검사한 카드 ID여서 빈 페이지에도 다음 페이지가 있을 수 있다. 삭제된 cursor는 400이며 처음부터 다시 조회한다. 수정은 생성 순서를 바꾸지 않는다. 중간 생성·삭제에 대한 전체 목록 snapshot은 보장하지 않는다.

## 13. Better Auth 경로

다음은 library가 소유한다.

- /api/auth/sign-in/social
- /api/auth/callback/discord
- /api/auth/get-session
- /api/auth/sign-out
- OAuth state와 관련 내부 경로

정확한 path와 method는 pinned Better Auth 1.7.x 공식 문서를 따른다. 애플리케이션은 /api/v1 아래에 로그인 wrapper endpoint를 중복 만들지 않는다.

MVP UI에서 허용하는 auth 행위는 Discord sign-in, current session read, sign-out뿐이다. email/password, Discord identity profile update, account link/unlink, account delete 기능을 활성화하지 않는다. 게임 프로필은 별도 v1 데이터다.

## 14. 입력과 보안 규칙

- object schema는 strict다.
- UUID는 canonical 형식으로 parse한다.
- 숫자는 JSON number 중 safe integer만 받는다.
- query의 숫자는 10진수 문자열만 허용한다.
- HTML이나 markdown을 API에서 받지 않는다.
- displayName과 avatar는 request에서 받지 않고 DB profile을 사용한다.
- client IP를 사용자 식별이나 점수 검증에 사용·저장하지 않는다.
- CORS 허용 origin 목록은 canonical same origin 하나다. wildcard를 사용하지 않는다.
- GET은 상태를 변경하지 않는다.

## 15. API Acceptance Criteria

- [ ] 모든 /api/v1 response가 공통 envelope와 requestId를 사용한다. 204만 body가 없다.
- [ ] mutation은 인증, ACTIVE user, Origin, strict schema를 검증한다.
- [ ] 클라이언트가 finalMs, penaltyMs, mistakeCount, userId를 제출할 수 없다.
- [ ] create와 complete의 멱등성 결과가 명세와 같다.
- [ ] 타인 소유 session은 404로 숨긴다.
- [ ] domain-invalid 완료는 session을 REJECTED로 만들고 record를 만들지 않는다.
- [ ] duplicate/concurrent 완료는 record 한 건과 동일 결과를 반환한다.
- [ ] 공개 ranking은 비로그인에도 동작하고 viewer는 선택적이다.
- [ ] 모든 오류 code에 integration test가 있다.
- [ ] 완료 응답은 확정된 포인트 적립 상태와 잔액을 반환하고 replay에서 같은 기록을 다시 적립하지 않는다.
- [ ] 본인 포인트 API는 ACTIVE·BANNED 로그인 사용자만 자신의 잔액과 최근 원장을 조회한다.


## 칭호 상점 API

모든 endpoint는 query를 거부하고 no-store와 공통 envelope를 사용한다. mutation은 same-origin·strict JSON·4KB 제한이다.

- GET `/api/v1/me/titles`: body 없음. BANNED도 본인 조회 허용.
- POST `purchase`: `{titleKey, requestId}`. titleKey는 catalog의 여섯 key, requestId는 UUID. 같은 키·같은 상품은 기존 구매를 반환하며 장착 의도를 다시 만들지 않는다. 같은 키·다른 상품은 409.
- POST `equipment`: `{titleKey: key|null, expectedRevision: integer}`. null은 해제. 소유하지 않은 칭호는 404. 직전 동일 의도의 재전송 외에는 revision이 다르면 409.
- POST `sync`: `{}`. 대기 중인 동일 의도만 재적용하며 포인트를 사용하지 않는다. 재시도 시각 이전 또는 다른 적용 진행 중이면 현재 상태를 반환한다.

성공 data는 `{balance, enabled, canModify, owned: titleKey[], equipment: {desired, applied, pending, revision, retryAt}}`이다. desired·applied는 key 또는 null, retryAt은 UTC ISO 또는 null이다. canModify는 ACTIVE 계정 여부이며 서버 멤버 판정은 mutation에서 별도 수행한다. enabled는 서버 역할 설정의 유효한 형식·기존 연결 일치를 뜻하며 실제 Discord 상태는 구매 직전 다시 검증한다. 원장 GET의 type에는 SPEND, reason에는 TITLE_PURCHASE를 추가한다.

역할 지급 미완료도 구매가 확정됐다면 200과 pending=true로 반환한다. 5xx/네트워크 응답 유실은 구매 실패 확정을 뜻하지 않으며 같은 키로 재시도한다. Discord·서버·역할 ID, 원본 외부 응답은 DTO에 넣지 않는다.

| HTTP | code | 의미 |
|---|---|---|
| 403 | TITLE_MEMBER_REQUIRED | canonical Discord identity 또는 실제 멤버 자격 없음 |
| 503 | TITLE_SHOP_UNAVAILABLE | 설정·역할 권한·Discord 조회 실패, 연결 변경 |
| 409 | TITLE_BALANCE_INSUFFICIENT | 500P 미만 |
| 409 | TITLE_ALREADY_OWNED | 다른 구매 요청으로 이미 소장 |
| 409 | TITLE_REQUEST_CONFLICT | 구매 키 충돌·오래된 장착 revision |
| 409 | TITLE_SYNC_PENDING | 먼저 기존 역할 적용을 완료해야 함 |
