# JGD.GG Agent Instructions

적용 범위: 이 파일이 있는 저장소 전체  
목적: 모든 AI agent가 작업을 시작하고 필요한 상세 문서로 이동하기 위한 최상위 진입 지침  
기준일: 2026-09-09

## 1. 작업 시작

1. 사용자의 현재 요청과 완료 조건을 한 문장으로 정리한다.
2. 이 파일을 끝까지 읽는다.
3. [docs/README.md](docs/README.md)를 읽고 현재 작업에 필요한 문서를 선택한다.
4. [docs/STATUS.md](docs/STATUS.md)에서 현재 환경, blocker와 다음 작업을 확인한다.
5. 선택된 문서의 관련 Acceptance Criteria, 기존 코드, test, migration과 저장소 상태를 확인한다.
6. 기존 구현을 검색한 뒤 요청에 필요한 최소 범위로 작업한다.

모든 문서를 매번 읽지 않는다. 여러 영역에 걸친 작업이면 `docs/README.md`의 작업별 문서 목록을 합쳐 읽는다. 문서에 이미 결정된 값은 다시 추측하거나 다른 값으로 바꾸지 않는다.

## 2. 지침과 Source of Truth

- 사용자의 현재 명시적 요청이 최우선이다.
- 제품·보안·DB·API·기능·UI·테스트 규칙의 담당 문서와 충돌 우선순위는 [docs/README.md](docs/README.md)를 따른다.
- 작업 절차와 품질 기준은 [docs/AI_RULES.md](docs/AI_RULES.md)를 따른다.
- 현재 상태와 작업 이력은 요구사항을 변경하지 않는다.
- 코드와 문서가 충돌하면 기존 코드가 자동으로 정답이 아니다. 제품 결정이나 보안 완화가 필요하면 임의로 결정하지 말고 사용자에게 보고한다.

## 3. 모든 작업의 공통 원칙

- 요청받은 결과에 필요한 최소 범위만 변경한다.
- 관련 없는 코드, formatting, dependency와 문서를 건드리지 않는다.
- 기존 사용자 변경을 되돌리거나 덮어쓰지 않는다.
- 명시적 요청 없이 commit, push, PR 생성 또는 배포하지 않는다.
- secret, token, cookie, 개인정보와 전체 connection string을 source, log, fixture, snapshot 또는 응답에 노출하지 않는다.
- 클라이언트 입력을 신뢰하거나 인증·권한·소유권·CSRF·DB 제약을 우회하지 않는다.
- 파괴적 파일 작업과 production/shared DB 변경은 정확한 대상, 데이터 보존과 승인 범위를 먼저 확인한다.
- 실행하지 않은 검증을 PASS로 보고하거나 실패를 test 삭제, skip, assertion 완화로 숨기지 않는다.

## 4. 작업 유형별 원칙

- 설명·분석·리뷰 요청은 읽기 전용으로 수행한다. 단, 저장소 작업 기록을 위한 `docs/WORK_LOG.md` 갱신은 허용한다.
- 구현·수정 요청은 관련 문서와 test를 함께 변경하고 [docs/TESTING.md](docs/TESTING.md)의 해당 완료 게이트를 실행한다.
- 요구사항 변경이면 담당 Source of Truth, 코드, test와 consumer를 같은 작업에서 동기화한다.
- 보안 완화, 데이터 손실, 계약 파괴 또는 결과를 크게 바꾸는 미결정 사항은 위험과 대안을 제시하고 사용자 결정을 기다린다.

## 5. 작업 완료

1. 변경 전체와 범위 밖 변경 여부를 확인한다.
2. 관련 Acceptance Criteria와 실제 검증 결과를 대조한다.
3. [docs/WORK_LOG.md](docs/WORK_LOG.md)에 수행 내용, 검증 결과와 남은 사항을 기록한다.
4. 사용자에게 결과, 중요 파일, 실제 실행한 검증, Acceptance Criteria와 남은 위험만 명확히 보고한다.

세부 절차, 로그 형식과 완료 기준은 [docs/AI_RULES.md](docs/AI_RULES.md)를 따른다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
