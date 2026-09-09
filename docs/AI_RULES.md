# JGD.GG AI 작업 규칙

문서 책임: AI가 JGD.GG를 구현·수정·리뷰할 때 지킬 작업 절차, 범위 통제, 검증과 보고 기준을 정의한다. 제품·보안·DB·API·기능별 값은 [README.md](README.md)가 안내하는 담당 Source of Truth에서 관리한다.

## 1. 규칙의 효력

우선순위는 현재 사용자의 명시적 요청, [README.md](README.md)의 Source of Truth 우선순위, 이 문서, 기존 코드 관례 순이다. 보안 완화나 데이터 손실 위험이 생기면 실행 전에 영향과 대안을 보고한다.

코드가 문서와 다르다는 이유만으로 문서를 무시하지 않는다. 동일 규칙을 이 문서와 담당 설계 문서에 중복 정의하지 않는다.

## 2. 작업 전

1. 사용자 요청의 범위와 완료 조건을 한 문장으로 정리한다.
2. 저장소 root, package manager, Git 상태와 기존 변경을 확인한다.
3. [README.md](README.md)에서 작업별 필수 문서를 선택하고 끝까지 읽는다.
4. [STATUS.md](STATUS.md)에서 현재 환경, blocker와 다음 작업을 확인한다.
5. 대상 feature, API, DB model, migration, test와 동일 기능의 기존 구현을 검색한다.
6. 기존 사용자 변경과 겹치는 파일을 구분한다.
7. 영향을 받는 Acceptance Criteria와 실행할 test를 정한다.

문서에 이미 결정된 값은 다시 질문하지 않는다. 결과가 크게 달라지는 미결정 사항은 임의 선택하지 않고 사용자에게 질문한다.

## 3. 범위와 구현

- 요청 결과에 필요한 최소 변경만 한다.
- 관련 없는 bug, refactor, formatting, dependency upgrade는 작업에 섞지 않는다.
- 기존 사용자 변경을 되돌리거나 덮어쓰지 않는다.
- 동일 기능이나 utility를 중복 구현하지 않는다.
- 실제 두 번째 사용처가 없는 abstraction과 명시적 비범위 기능의 stub을 만들지 않는다.
- 같은 계층의 기존 구조, naming, error mapping과 test helper를 우선 사용한다.
- 기존 패턴이 문서나 보안 규칙과 충돌하면 그대로 답습하지 말고 충돌을 해소한다.
- 작은 검증 가능한 단위로 변경하고 pure domain rule과 side effect를 분리한다.
- TypeScript strict를 유지하고 `any`, `ts-ignore`, 근거 없는 type assertion으로 문제를 숨기지 않는다.
- 실패를 빈 catch로 숨기거나 임시 debug log, `skip`, `only`를 남기지 않는다.
- bug 수정에는 수정 전 실패하고 수정 후 통과하는 regression test를 추가한다.

## 4. Dependency와 프레임워크

- [ARCHITECTURE.md](ARCHITECTURE.md)에 승인된 dependency와 현재 package manager를 우선 사용한다.
- 표준 API나 기존 package로 충분하면 새 dependency를 추가하지 않는다.
- 새 production dependency는 해결할 문제, 대안, bundle/runtime 영향, maintenance와 license를 확인한 뒤 추가한다.
- dependency 변경 시 manifest와 lockfile을 함께 변경하고, major upgrade를 기능 작업에 섞지 않는다.
- Next.js 코드를 쓰기 전에 루트 `AGENTS.md`의 자동 생성 규칙에 따라 설치된 버전의 관련 문서를 읽는다.

## 5. 담당 문서 준수

- 아키텍처와 runtime 경계는 [ARCHITECTURE.md](ARCHITECTURE.md)를 따른다.
- 인증, 권한, cookie와 개인정보는 [AUTH.md](AUTH.md)를 따른다.
- schema, migration, constraint와 transaction은 [DATABASE.md](DATABASE.md)를 따른다.
- endpoint, validation, 오류와 멱등성은 [API.md](API.md)를 따른다.
- 화면, 상태, 반응형과 접근성은 [UI_GUIDE.md](UI_GUIDE.md)를 따른다.
- 기능 동작과 규칙 버전은 [features](features)의 담당 문서를 따른다.
- 테스트 환경, 필수 시나리오와 품질 게이트는 [TESTING.md](TESTING.md)를 따른다.

담당 문서의 보안 검사, 데이터 제약, 공개 계약을 제거하거나 완화해야 한다면 이유, 위험과 보완책을 먼저 제시하고 사용자 승인을 받는다.

## 6. 검증과 실패 처리

1. 변경 전체를 읽고 범위 밖 변경을 제거한다.
2. 관련 Acceptance Criteria를 구현과 test에 대조한다.
3. [TESTING.md](TESTING.md)의 해당 gate를 실제로 실행한다.
4. migration과 generated diff가 있으면 별도로 검토한다.
5. secret, debug log, `skip`, `only`, 미해결 TODO, `any`, `ts-ignore`를 검색한다.
6. 문서와 코드의 path, enum, 숫자와 error code를 대조한다.
7. 최종 변경 파일과 남은 미검증 범위를 확인한다.

- 실행하지 않은 command를 PASS로 표시하지 않는다.
- 실패를 assertion 완화, test 삭제·skip 또는 mock으로 숨기지 않는다.
- 기존 실패라고 판단하면 변경 전 상태에서도 재현한 근거를 남긴다.
- 환경 때문에 실행하지 못한 command는 BLOCKED 또는 NOT RUN으로 기록하고 영향을 설명한다.
- test나 build가 실패하면 완료로 보고하지 않는다.

## 7. 문서 동기화

동작이나 계약을 바꾸면 [README.md](README.md)의 문서 책임에 따라 담당 Source of Truth, 코드, consumer와 test를 같은 작업에서 갱신한다. 규칙을 다른 문서에 복제하지 않고 링크와 필요한 맥락만 남긴다.

[STATUS.md](STATUS.md)는 현재 환경·blocker·다음 작업이 바뀔 때 갱신한다. [WORK_LOG.md](WORK_LOG.md)는 모든 저장소 작업의 실제 수행 이력을 기록한다.

## 8. Git과 파일 안전

- 작업 전후 Git 상태를 확인하고 관련 없는 수정과 untracked file을 보존한다.
- `git reset --hard`, `git clean`, `git checkout --` 등으로 사용자 변경을 삭제하지 않는다.
- generated file을 수동 편집하지 않는다.
- secret, `.env`, database dump와 test artifact를 저장소 이력에 넣지 않는다.
- formatting은 대상 파일로 제한하고 삭제·rename 전에 참조를 검색한다.
- 명시적 요청 없이 commit, push, PR 생성 또는 배포하지 않는다.

## 9. 작업 로그

모든 저장소 관련 작업은 완료 전에 [WORK_LOG.md](WORK_LOG.md)의 최신 항목 위에 기록한다. 코드·설계 문서 변경이 없는 분석과 리뷰도 제품 파일은 읽기 전용으로 유지하되 로그에는 확인 범위와 결론을 남긴다.

과거 기록을 삭제하거나 조용히 다시 쓰지 않는다. 사실 오류 정정은 원문을 보존하거나 정정 날짜와 이유를 명시한다. secret, token, cookie, 개인정보와 전체 connection string을 기록하지 않는다.

각 항목은 다음 구조를 사용한다.

~~~text
## YYYY-MM-DD — 작업 제목

요청
- 사용자가 요구한 결과

수행
- 구현·수정·분석 내용

주요 파일
- 변경하거나 집중 검토한 파일

검증
- command: PASS | FAIL | BLOCKED | NOT RUN — 필요한 세부 결과

Acceptance Criteria
- 확인한 AC와 결과

남은 사항
- 미완료, 위험, blocker, 다음 우선 작업
~~~

## 10. 최종 보고

사용자에게 다음을 간결히 보고한다.

1. 구현하거나 수정한 결과
2. 중요한 파일과 결정
3. 실제 실행한 검증 command와 PASS·FAIL·BLOCKED·NOT RUN
4. Acceptance Criteria 대응 결과
5. 남은 위험, 미실행 검증과 blocker

## 11. 완료 기준

- 사용자 요청 범위를 충족했다.
- 관련 Source of Truth와 일치한다.
- 보안·데이터 불변식과 외부 계약을 유지한다.
- 필요한 test와 품질 게이트가 통과했다.
- 필요한 문서, [STATUS.md](STATUS.md)와 [WORK_LOG.md](WORK_LOG.md)를 갱신했다.
- 범위 밖 변경과 숨긴 실패가 없다.
- 남은 사항을 정확히 보고했다.
