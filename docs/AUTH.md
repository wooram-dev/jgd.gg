# JGD.GG 인증·권한·개인정보 설계

문서 책임: Discord OAuth, Better Auth session, 권한, 프로필 동기화, 개인정보와 대상 서버 멤버 정책을 정의한다.

## 1. 결정 요약

- 인증 library: Better Auth 1.7.x + Prisma adapter
- 유일한 로그인 방식: Discord OAuth 2 Authorization Code
- OAuth scope: identify만 사용
- MVP 가입 정책: Discord 계정이면 누구나 가입·공식 플레이 가능
- 실제 Discord 이메일: 요청·저장하지 않음
- Discord access/refresh token: callback 후 영구 저장하지 않음
- auth session: DB-backed opaque cookie session
- account linking, email/password, profile editing: 비활성
- user.status가 BANNED이면 새 session과 게임 mutation 거부

## 2. 왜 Better Auth인가

2026-09-06 기준 Better Auth는 Next.js Route Handler, Discord social provider, Prisma adapter를 공식 문서화한다. 신규 프로젝트에서 인증 protocol과 cookie/session 보안을 직접 구현하는 것보다 library의 검증된 흐름을 사용하고 JGD.GG 정책만 얇게 추가하는 편이 안정적이다.

공식 참고:

- 설치: https://better-auth.com/docs/installation
- Discord: https://better-auth.com/docs/authentication/discord
- OAuth: https://better-auth.com/docs/concepts/oauth
- Prisma adapter: https://better-auth.com/docs/adapters/prisma
- user와 account identity: https://better-auth.com/docs/concepts/users-accounts
- Discord OAuth scope: https://docs.discord.com/developers/platform/oauth2-and-permissions

## 3. Discord application 설정

환경별로 Discord application을 분리한다.

| 환경 | Redirect URI |
|---|---|
| local | http://localhost:3000/api/auth/callback/discord |
| preview/staging | 해당 환경의 고정 HTTPS origin + /api/auth/callback/discord |
| production | production HTTPS origin + /api/auth/callback/discord |

규칙:

- wildcard redirect URI를 사용하지 않는다.
- client secret은 secret manager 또는 배포 환경 변수에만 저장한다.
- secret은 NEXT_PUBLIC 접두사를 사용하지 않는다.
- Discord bot을 MVP에서 생성·초대할 필요가 없다.
- bot, guilds, guilds.members.read, email scope를 요청하지 않는다.
- OAuth consent에는 identify만 보여야 한다.

## 4. Better Auth 필수 설정

아래 동작을 config와 test로 고정한다.

| 설정 | 값 또는 정책 |
|---|---|
| baseURL | BETTER_AUTH_URL |
| basePath | /api/auth |
| database | Prisma PostgreSQL adapter |
| account.identityStrategy | provider-id |
| account.accountLinking.enabled | false |
| account.encryptOAuthTokens | true, callback 중 임시 token 보호 |
| account.updateAccountOnSignIn | true |
| account.storeStateStrategy | database |
| account.storeAccountCookie | false |
| emailAndPassword | disabled |
| socialProviders | discord 하나 |
| Discord default scope | disabled |
| Discord scope | identify 하나 |
| Discord overrideUserInfoOnSignIn | true |
| session expiresIn | 7일 |
| session updateAge | 24시간 |
| trustedOrigins | 환경별 canonical origin만 |

Better Auth가 every-user email을 요구하므로 Discord profile id로 비전달 placeholder를 만든다.

~~~text
{discordUserId}@discord.placeholder.invalid
~~~

placeholder는 로그인 identity나 연락처가 아니다. 이메일 발송 기능, password reset, magic link, 조직 초대에 절대 사용하지 않는다. .invalid 도메인은 외부 전달이 불가능하다.

## 5. 프로필 mapping

Discord identify 응답에서 다음만 사용한다.

| Discord field | 저장 위치 | 변환 |
|---|---|---|
| id | account.account_id | 문자열 그대로 |
| username | user.discord_username | 1~64자 검증 |
| global_name | user.discord_display_name, user.name | null이면 username |
| avatar | user.discord_avatar_hash | null 허용 |
| avatar 또는 id | user.image | Discord CDN HTTPS URL 또는 default avatar URL |

저장하지 않는 field:

- email
- locale
- MFA 여부
- Nitro/premium 정보
- banner, accent color
- linked connections
- guild 목록

프로필은 최초 로그인과 이후 매 로그인에서 갱신한다. display field는 provider에서 온 최신 값으로 덮어쓴다. 사용자가 사이트에서 별도 닉네임이나 avatar를 편집할 수 없다.

### 5.1 provider 전용 field 보호

Better Auth의 mapProfileToUser는 additional field를 provider input으로 처리하므로 discord_username, discord_display_name, discord_avatar_hash는 mapping을 위해 input 허용하되 다음 방어를 함께 둔다.

- email/password signup을 비활성화한다.
- account link와 unlink를 비활성화한다.
- Better Auth의 사용자 주도 update-user endpoint를 global before hook에서 항상 거부한다.
- JGD.GG /api/v1에는 프로필 수정 endpoint를 만들지 않는다.
- user.status는 input false인 server-owned field로 선언한다.
- discord display field는 authorization이나 session 소유권 판단에 사용하지 않는다.
- canonical Discord identity는 library가 검증하고 account의 UNIQUE(issuer, accountId)에 저장한 값만 사용한다.

구현 시 pinned Better Auth 버전의 실제 route id를 type/API 문서에서 확인해 update-user 차단 integration test를 작성한다. route 이름 문자열만 믿지 말고 실제 HTTP 요청이 403 또는 404인지 검증한다.

## 6. Avatar 규칙

- custom avatar가 있으면 Discord CDN의 HTTPS URL을 만든다.
- avatar hash가 a_로 시작하면 지원하는 animated 형식을 쓸 수 있으나 MVP UI는 정적 webp 또는 png를 요청해 애니메이션 부담을 피한다.
- custom avatar가 없으면 Discord 공식 default avatar 규칙으로 URL을 만든다.
- avatar URL은 Discord CDN host allowlist를 통과한 값만 저장·렌더링한다.
- Next.js image remotePatterns에는 cdn.discordapp.com만 허용한다.
- avatar 로드 실패 시 서비스 내 원형 initials fallback을 표시한다.
- 외부 URL을 사용자가 입력할 수 없다.

## 7. 로그인 흐름

1. 사용자가 Discord로 로그인을 누른다.
2. 현재 내부 경로를 안전한 returnTo로 정규화한다.
3. Better Auth social sign-in을 provider discord, callbackURL과 함께 시작한다.
4. Better Auth가 state를 DB에 저장하고 signed state cookie를 설정한다.
5. Discord authorization page에서 identify 동의를 받는다.
6. Discord가 고정 callback URI로 code와 state를 보낸다.
7. Better Auth가 state와 code를 검증하고 provider profile을 가져온다.
8. provider-id identity로 account를 찾거나 새 user/account를 만든다.
9. placeholder email과 최신 profile을 mapping한다.
10. DB session을 만들고 HttpOnly cookie를 설정한다.
11. account에 임시로 저장된 accessToken, refreshToken, 만료시각을 callback 완료 hook에서 null 처리한다.
12. 검증된 내부 returnTo로 이동한다. 실패하면 /auth/error로 이동한다.

OAuth callback 성공을 access token 정리까지 포함해 integration test한다. token 정리에 실패하면 로그인 자체를 무효로 만들 필요는 없지만 error log를 남기고 즉시 재정리 작업을 한 번 시도한다. production DB 점검에서는 non-null Discord token row가 0이어야 한다.

## 8. 안전한 returnTo

- 허용 값은 /로 시작하는 같은 origin 상대 경로뿐이다.
- //, 역슬래시, scheme, host가 포함된 값은 /로 치환한다.
- /api, /api/auth, /auth/error, callback 경로는 returnTo로 허용하지 않는다.
- 길이 상한은 512자다.
- query와 fragment는 상대 경로 검증 뒤 보존할 수 있다.
- 검증 로직은 하나의 server utility와 unit test로 관리한다.

## 9. Session과 cookie

production cookie 기준:

| 속성 | 값 |
|---|---|
| HttpOnly | true |
| Secure | true |
| SameSite | Lax |
| Path | / |
| Domain | 지정하지 않아 host-only |
| Max-Age | Better Auth 7일 session 정책과 일치 |

local HTTP에서만 Secure false를 허용하며 NODE_ENV production에서는 false로 시작할 수 없게 env validation한다.

서버 권한 확인:

- Server Component와 Route Handler는 Better Auth server API로 session을 읽는다.
- client가 전달한 userId를 권한에 사용하지 않는다.
- session의 user.id로 GameSession과 GameRecord를 조회한다.
- mutation마다 DB의 user.status를 확인한다. cookie에 오래된 status가 있어도 DB가 우선이다.

로그아웃:

- Better Auth sign-out을 호출해 server session을 무효화한다.
- cookie를 삭제한다.
- 공식 PLAYING GameSession은 즉시 바꾸지 않고 만료되게 둔다.
- UI는 / 또는 이전 공개 페이지로 이동한다.

## 10. 권한 표

| 기능 | 비로그인 | ACTIVE 로그인 | BANNED 로그인 |
|---|---:|---:|---:|
| 홈·설명 | 허용 | 허용 | 허용 |
| 공개 랭킹 | 허용 | 허용 | 허용하되 본인 기록은 랭킹에서 제외 |
| 연습 플레이 | 허용 | 허용 | 허용 |
| 공식 session 생성 | 거부 | 허용 | 403 |
| 공식 session 시작·완료 | 거부 | 본인 session만 | 403 |
| 개인 통계 | 거부 | 본인만 | 본인 조회 허용 |
| 프로필 수정 | 없음 | 없음 | 없음 |
| 운영자 무효화·ban UI | MVP 없음 | 없음 | 없음 |

BANNED user의 과거 GameRecord는 rank query에서 제외한다. 기록은 감사 목적으로 DB에 남는다.

## 11. 인증 오류 UX

| 내부 상황 | 사용자 문구 | 행동 |
|---|---|---|
| access_denied | Discord 로그인이 취소되었습니다. | 게임으로 돌아가기, 다시 로그인 |
| state/callback invalid | 로그인 요청이 만료되었거나 올바르지 않습니다. | 새 로그인 시작 |
| provider unavailable | Discord 로그인에 일시적인 문제가 있습니다. | 재시도 |
| account blocked | 이 계정은 공식 기록을 등록할 수 없습니다. | 공개 페이지 이동 |
| unknown | 로그인 중 문제가 발생했습니다. | requestId 표시, 재시도 |

Discord 원본 오류나 query 전체를 그대로 표시하지 않는다.

## 12. 대상 Discord 서버 멤버 정책 비교

### 12.1 MVP 선택: 모든 Discord 계정 허용

장점:

- identify 한 scope로 최소 권한을 지킨다.
- bot token, guild API, membership cache가 없다.
- 로그인 실패 지점과 운영 부담이 적다.

단점:

- 대상 서버 밖 사용자가 공식 랭킹에 참여할 수 있다.

MVP 목표에는 이 trade-off가 적합하다.

### 12.2 향후 선택: server-side bot membership 확인

커뮤니티 전용성이 필요하다는 운영 근거가 생기면 다음 방식만 사용한다.

1. 운영자가 JGD.GG bot을 대상 guild에 설치한다.
2. bot token과 TARGET_GUILD_ID를 서버 secret으로 저장한다.
3. OAuth 성공 직전 또는 첫 session 생성 전, 서버가 Discord guild member endpoint로 account.accountId를 조회한다.
4. member면 user의 server-owned membership 상태와 checkedAt을 갱신한다.
5. 404면 공식 플레이를 거부하고 서버 가입 안내를 보여준다.
6. Discord 429/5xx이면 membership 없음으로 영구 저장하지 않고 일시 오류를 반환한다.
7. TTL은 15분부터 시작하고 실제 rate limit을 보고 조정한다.

guilds user scope 방식은 사용자의 전체 서버 목록 접근과 access token 보존이 필요해 개인정보와 복잡성이 커지므로 권장하지 않는다. target guild 하나의 membership만 확인하는 목적에는 bot 조회가 더 좁다.

이 향후 모드에는 별도 요구사항, schema migration, Discord policy 검토가 필요하다. MVP에 빈 membership column이나 bot 코드를 미리 만들지 않는다.

## 13. 개인정보와 보존

수집 목적:

| 데이터 | 목적 |
|---|---|
| 내부 user id | 관계와 권한 |
| Discord account id | 안정된 외부 identity |
| username, display name, avatar | 랭킹과 프로필 표시 |
| 가입·갱신 시각 | 운영과 동기화 |
| 게임 session·record | 기록 검증과 랭킹 |

수집하지 않는 정보:

- 실제 이메일
- guild 목록
- Discord 메시지·친구·연결 계정
- IP와 user agent의 DB 영구 저장
- Discord access/refresh token

공개 정보:

- display name, avatar, 순위, 최종 기록, 오클릭, 달성 시각
- Discord user id와 username은 공개 API에서 반환하지 않는다.

운영자용 개인정보 처리방침에는 수집 항목, 목적, 보존, 삭제 문의 방법을 명시한다. 계정 삭제 UI는 MVP 비범위지만 운영자가 확인된 요청을 처리할 수 있어야 하며 user 삭제 시 관련 auth/session/game 데이터는 DATABASE.md의 cascade 정책을 따른다.

## 14. 위협과 방어

| 위협 | 방어 |
|---|---|
| OAuth CSRF | Better Auth state, signed cookie, database state |
| open redirect | same-origin 상대 returnTo allowlist |
| session 탈취 | HttpOnly, Secure, SameSite, HTTPS, 7일 만료 |
| session fixation | OAuth 성공 시 library가 새 session 발급 |
| 타인 session 제출 | 인증 user.id와 GameSession.userId 비교 |
| display field 변조 | 사용자 update 차단, 권한에 사용 안 함 |
| token 유출 | server-only env, encrypted temporary storage, callback 후 null, redacted log |
| ban 우회 | mutation마다 DB user.status 확인 |
| callback replay | state 일회성 검증과 account unique key |

## 15. 테스트

최소 integration/E2E:

- 첫 Discord 로그인 user/account/session 생성
- phone-only 계정처럼 email이 없는 profile도 placeholder로 성공
- 실제 email이 profile에 있어도 저장하지 않고 placeholder 사용
- 재로그인 시 displayName과 avatar 갱신
- stable Discord id가 같은 경우 user 중복 생성 없음
- user update endpoint 거부
- email/password와 account linking 거부
- 잘못된 state와 callback 오류
- 외부 returnTo가 /로 정규화
- sign-out 후 보호 API 401
- BANNED user mutation 403
- callback 후 account OAuth token null

실제 Discord production API를 CI에서 호출하지 않는다. TESTING.md의 fake provider 또는 fixture를 사용한다.

## 16. Auth Acceptance Criteria

- [ ] OAuth consent scope가 identify 하나다.
- [ ] 실제 email, guild 목록, token, IP, user agent가 DB에 남지 않는다.
- [ ] account identity가 provider-id와 Discord account id로 안정적으로 연결된다.
- [ ] 최초·반복 로그인에서 profile mapping이 갱신된다.
- [ ] 사용자 주도 profile update, account link, email/password가 동작하지 않는다.
- [ ] cookie가 production에서 HttpOnly, Secure, SameSite=Lax, host-only다.
- [ ] 모든 게임 mutation이 auth와 DB user.status를 확인한다.
- [ ] 외부 returnTo와 타인 session 접근이 차단된다.
- [ ] Discord 실제 호출 없이 핵심 auth integration test가 통과한다.
