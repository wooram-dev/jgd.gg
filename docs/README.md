# JGD.GG 문서 안내

문서 상태: MVP 구현 기준선  
기준일: 2026-09-09  
서비스 기본 시간대: Asia/Seoul  
저장 시간대: UTC

이 문서는 JGD.GG 문서 체계의 진입점이다. 상세 규칙을 복제하지 않고 작업 유형에 맞는 Source of Truth를 안내한다.

## 1. 읽기 순서

1. 저장소 최상단의 [AGENTS.md](../AGENTS.md)를 읽는다.
2. [STATUS.md](STATUS.md)에서 현재 환경과 blocker를 확인한다.
3. 아래 작업별 문서 표에서 현재 작업에 필요한 문서를 선택한다.
4. 구현·수정·리뷰 작업이면 [AI_RULES.md](AI_RULES.md)를 읽는다.
5. 선택한 문서의 관련 Acceptance Criteria와 기존 구현·test를 대조한다.

모든 설계 문서를 매번 읽지 않는다. 여러 영역에 걸친 작업이면 필요한 문서 목록을 합쳐 읽는다. 과거 변경은 Git 이력과 diff로 확인한다.

## 2. Source of Truth 우선순위

현재 사용자의 명시적 요청 다음으로 아래 순위를 적용한다.

1. 보안·개인정보: [AUTH.md](AUTH.md)
2. 데이터 불변식·제약: [DATABASE.md](DATABASE.md)
3. HTTP 계약: [API.md](API.md)
4. 기능 동작: [features](features)
5. 제품 범위: [PRODUCT.md](PRODUCT.md)
6. 구조·기술: [ARCHITECTURE.md](ARCHITECTURE.md)
7. UI·반응형: [UI_GUIDE.md](UI_GUIDE.md)
8. 검증: [TESTING.md](TESTING.md)
9. 작업 절차: [AI_RULES.md](AI_RULES.md)
10. 기존 코드 관례

[STATUS.md](STATUS.md)와 Git 이력은 운영 상태와 이력이며 요구사항의 Source of Truth가 아니다. 충돌이 실제 요구사항 변경을 뜻하면 담당 문서, 코드와 test를 같은 작업에서 갱신한다.

## 3. 문서 책임

| 문서 | 단일 책임 | 여기서 관리하지 않는 내용 |
|---|---|---|
| [PRODUCT.md](PRODUCT.md) | 목표, 사용자, MVP 범위, 성공 기준, 비범위 | 테이블 필드, HTTP 스키마 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 기술 스택, 런타임 경계, 디렉터리와 의존 방향 | 필드별 DB 제약, 화면 세부 치수 |
| [DATABASE.md](DATABASE.md) | 테이블, 관계, 타입, 제약, 인덱스, 트랜잭션 불변식 | HTTP 응답 모양 |
| [API.md](API.md) | 엔드포인트, 인증, 요청·응답, 오류, 멱등성 | 화면 배치 |
| [AUTH.md](AUTH.md) | Discord OAuth, 세션, 권한, 개인정보, 계정 정책 | 게임 점수 공식 |
| [UI_GUIDE.md](UI_GUIDE.md) | 정보 구조, 화면, 반응형, 접근성, 디자인 토큰 | API 내부 구현 |
| [TESTING.md](TESTING.md) | 테스트 계층, 격리, 필수 시나리오, 품질 게이트 | 기능 요구사항의 원본 |
| [AI_RULES.md](AI_RULES.md) | AI 개발자의 작업·검증·보고 절차 | 제품·기술 요구사항 자체 |
| [STATUS.md](STATUS.md) | 현재 구현·환경·blocker·다음 우선순위 | 요구사항과 과거 작업 상세 |
| [features/number-click.md](features/number-click.md) | number-click 규칙, 상태 머신, 검증, 수락 기준 | 공통 인증 구현 |
| [features/ranking.md](features/ranking.md) | 기간, 최고 기록 선정, 정렬, 조회 UX, 수락 기준 | 게임 플레이 상태 |

## 4. 작업별 필수 문서

| 작업 | 반드시 읽을 문서 |
|---|---|
| 프로젝트 초기 구성 | [PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [AUTH.md](AUTH.md), [TESTING.md](TESTING.md) |
| 제품 범위·사용자 흐름 | [PRODUCT.md](PRODUCT.md), [UI_GUIDE.md](UI_GUIDE.md) |
| Next.js 구조·dependency | [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md), 관련 `node_modules/next/dist/docs/` 문서 |
| DB schema·migration·seed | [DATABASE.md](DATABASE.md), [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md) |
| API | [API.md](API.md), [DATABASE.md](DATABASE.md), [AUTH.md](AUTH.md), [TESTING.md](TESTING.md) |
| Discord 로그인·권한 | [AUTH.md](AUTH.md), [DATABASE.md](DATABASE.md), [API.md](API.md), [TESTING.md](TESTING.md) |
| number-click | [features/number-click.md](features/number-click.md), [API.md](API.md), [DATABASE.md](DATABASE.md), [UI_GUIDE.md](UI_GUIDE.md), [TESTING.md](TESTING.md) |
| 랭킹 | [features/ranking.md](features/ranking.md), [API.md](API.md), [DATABASE.md](DATABASE.md), [UI_GUIDE.md](UI_GUIDE.md), [TESTING.md](TESTING.md) |
| UI·반응형·접근성 | [UI_GUIDE.md](UI_GUIDE.md), 관련 feature 문서, [TESTING.md](TESTING.md) |
| bug 수정 | 관련 feature 및 API·DB·Auth 문서, [TESTING.md](TESTING.md) |
| 코드 리뷰 | 변경 영역의 모든 담당 문서와 Acceptance Criteria |
| Agent 지침·문서 체계 | 이 문서, [AI_RULES.md](AI_RULES.md), [STATUS.md](STATUS.md), 관련 Git 이력 |

## 5. 변경 절차

1. 변경할 규칙의 담당 Source of Truth를 찾는다.
2. 데이터·API 호환성과 기존 기록 처리 영향을 확인한다.
3. 담당 문서를 먼저 또는 코드와 같은 변경에서 갱신한다.
4. 관련 Acceptance Criteria와 테스트 목록을 갱신한다.
5. [TESTING.md](TESTING.md)의 해당 품질 게이트를 실행한다.
6. [STATUS.md](STATUS.md)에 영향을 주는 현재 상태가 있으면 갱신한다.
7. 변경 내용과 검증 결과를 commit 또는 PR 설명에 정확히 기록한다.

동일 규칙을 여러 문서에 복사하지 않는다. 다른 문서에서 언급해야 하면 담당 문서를 링크하고, 원래 값을 재정의하지 않는 짧은 설명만 둔다.

## 6. 디렉터리 구조

~~~text
/docs
├─ README.md
├─ PRODUCT.md
├─ ARCHITECTURE.md
├─ DATABASE.md
├─ API.md
├─ AUTH.md
├─ UI_GUIDE.md
├─ TESTING.md
├─ AI_RULES.md
├─ STATUS.md
└─ features/
   ├─ number-click.md
   └─ ranking.md
~~~
