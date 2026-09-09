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
