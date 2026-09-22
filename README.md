# JGD.GG

Discord 계정으로 공식 기록을 남기고 경쟁하는 미니게임 서비스의 MVP입니다. 첫 게임은 1부터 25까지 순서대로 누르는 `number-click`입니다.

## 요구 환경

- Node.js 24.20.x LTS
- pnpm 12.3.4
- PostgreSQL 18
- Discord OAuth application

## 로컬 실행

1. `.env.example`을 `.env.local`로 복사하고 실제 로컬 값을 입력합니다.
2. Discord application의 Redirect URI를 `http://localhost:3000/api/auth/callback/discord`로 등록합니다.
3. 패키지와 데이터베이스를 준비한 뒤 앱을 시작합니다.

```text
pnpm install
pnpm db:deploy
pnpm db:seed
pnpm dev
```

공식 플레이와 랭킹은 PostgreSQL 및 Discord 설정이 필요합니다. 환경 변수가 없는 development 실행에서는 비로그인 연습 UI만 확인할 수 있습니다.

## Linux 개발 환경

저장소에서 nvm을 로드한 shell로 고정 버전을 선택합니다.

```sh
nvm use
pnpm install --frozen-lockfile
```

`compose.dev.yaml`은 개발 전용 PostgreSQL을 `127.0.0.1:5432`에 제공합니다. 최초 초기화 전에 `JGD_POSTGRES_PASSWORD`와 `JGD_DATABASE_PASSWORD`를 안전한 환경 변수로 주입합니다. 기존 볼륨에서는 환경 변수 변경만으로 DB 비밀번호가 바뀌지 않습니다.

```sh
docker compose -f compose.dev.yaml up -d
```

새 볼륨을 처음 시작할 때만 `scripts/init-dev-db.sh`가 비관리자 `jgd` 역할과 개발용 `jgd`, 테스트 전용 `jgd_test` DB를 만듭니다. Git에서 제외된 `.env`에 DB URL·Discord OAuth 설정을 넣고 권한을 `chmod 600 .env`로 제한합니다. 개발 DB URL은 `jgd`, `DATABASE_URL_TEST`는 `jgd_test`를 가리켜야 합니다. 초기 개발 DB 준비는 위 로컬 실행의 migration·seed 명령을 따릅니다. 기존 데이터가 있는 볼륨은 보존합니다.

테스트 DB 초기화가 허용된 환경에서만 `ALLOW_TEST_DATABASE_RESET=true`를 설정합니다. integration은 `.env`를 읽으며, E2E는 mock OAuth 설정과 별도 `.next-e2e` 출력을 사용합니다. 실행 중인 웹 서비스와 다른 포트를 사용합니다.

```sh
pnpm exec playwright install chromium
pnpm test:integration
E2E_PORT=3109 pnpm test:e2e
```

현재 PC의 웹·Tunnel user service는 다음 읽기 전용 명령으로 확인합니다. 공개 서비스 주소와 실제 검증 범위는 [현재 상태](docs/STATUS.md)를 따릅니다.

```sh
systemctl --user is-active jgd-web.service jgd-cloudflared.service
systemctl --user is-enabled jgd-web.service jgd-cloudflared.service
loginctl show-user "$USER" -p Linger
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001
curl -sS -o /dev/null -w '%{http_code}\n' https://jgd.wooram.online
```

빌드 전환 시에는 현재 서비스의 `.next`를 덮어쓰며 빌드하지 않습니다. 별도 복사본에서 빌드·검증한 뒤 기존 `.next`를 복구용으로 보존하고 웹 서비스를 전환합니다. Turbopack의 `.next/node_modules`에는 상대 symlink가 있으므로 `cp -a` 또는 `shutil.copytree(..., symlinks=True)`처럼 링크를 보존해야 합니다. 링크를 일반 파일로 풀어 복사하면 Prisma 등의 런타임 의존성이 누락될 수 있습니다. 전환 전에 운영 저장소와 같은 의존성 배치의 별도 포트에서 새 빌드를 실행해 확인합니다. 현재 배포·복구 경로는 [현재 상태](docs/STATUS.md)를 따릅니다.

게임 프로필에는 OAuth 설정 외에 `DISCORD_BOT_TOKEN`과 `TARGET_GUILD_ID`가 필요합니다. 설정 대응 관계와 실제 멤버·비멤버 확인 절차는 [게임 프로필 설정](docs/features/game-profiles.md#설정과-적용)을 따릅니다.

칭호 상점은 여섯 상품을 각 500P에 판매하며, 역할 설정이 없으면 판매 준비 중으로 표시합니다. `DISCORD_BOT_TOKEN`·`TARGET_GUILD_ID`와 상품별 역할 JSON `DISCORD_TITLE_ROLE_IDS`를 서버에 설정해야 합니다. 상품·역할 검증·migration·실패 복구 절차는 [칭호 상점](docs/features/title-shop.md#역할-설정)을 따릅니다.

## 검증

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:integration
pnpm test:e2e
pnpm build
```

PostgreSQL integration test에는 이름이 `_test`로 끝나는 전용 `DATABASE_URL_TEST`와 `ALLOW_TEST_DATABASE_RESET=true`가 필요합니다. Production 또는 개발 DB URL을 test reset 대상으로 사용할 수 없습니다.

설계와 계약의 Source of Truth는 [docs/README.md](docs/README.md)에서 확인합니다.
