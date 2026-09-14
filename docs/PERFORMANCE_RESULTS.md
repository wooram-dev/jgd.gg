# 로컬 성능·복원 검증 — 2026-09-14

판정: **LOCAL_SMOKE_PASS**. 합성 사용자 10만 명·GameRecord 100만 건에서 랭킹 서비스의 p95 500ms 목표를 통과했다. 운영 환경의 HTTP 지연·동시 부하·PITR 검증은 아직 수행하지 않았다. 재현 및 복구 절차는 [DB_OPERATIONS.md](DB_OPERATIONS.md)를 따른다.

## 환경과 방법

- Windows 10.0.26200, Ryzen 7 9800X3D, 논리 CPU 16개, 메모리 31GiB, Node.js 24.20.0, PostgreSQL 18.6.
- shared_buffers 128MiB, work_mem 4MiB, effective_cache_size 4GiB, max_parallel_workers_per_gather 2, max_connections 100, fsync/synchronous_commit on. DB 설정은 변경하지 않았다.
- 로컬 `jgd_test`의 실행별 격리 스키마에서 현재 migration 3개를 적용했다. 개발 DB와 테스트 DB의 public 데이터는 측정·복원 대상으로 사용하지 않았다.
- 사용자당 10개 기록, 현재/비활성 합성 규칙, 오늘·주간·과거 분포, 차단 사용자 1%, 무효 기록을 포함한다. 적립 원장 465,881건과 보관된 만료 스토리 1건을 넣었다. fixture 기준 시각은 실제 측정일과 별개인 `2026-09-17T06:00:00Z`다.
- 시나리오별 warmup 2회 후 20회, nearest-rank p95. 최초 호출과 EXPLAIN ANALYZE BUFFERS도 별도 저장했다. 작은 표본의 로컬 warm-cache 관측이며 운영 지연을 보증하지 않는다.
- 재현 명령: `pnpm test:performance`. 도구 점검용 `pnpm test:performance --quick`도 통과했다.

## 측정 결과

단위는 ms다. 로그인 시나리오는 top 100 밖 사용자의 내 순위를 포함한다.

| 시나리오 | 수정 전 p95 | 수정 후 p50 | 수정 후 p95 | 수정 후 SQL 수 | 판정 |
|---|---:|---:|---:|---:|---|
| 오늘 / 비로그인 | 416.4 | 142.3 | 148.2 | 2 | PASS ≤500 |
| 오늘 / 로그인 | 592.5 | 155.7 | 160.6 | 2 | PASS ≤500 |
| 주간 / 비로그인 | 441.3 | 326.3 | 335.1 | 2 | PASS ≤500 |
| 주간 / 로그인 | 982.1 | 328.6 | 341.9 | 2 | PASS ≤500 |
| 전체 / 비로그인 | 341.3 | 389.8 | 403.9 | 2 | PASS ≤500 |
| 전체 / 로그인 | 608.0 | 372.2 | 383.7 | 2 | PASS ≤500 |
| 개인 통계 | 2.4 | 1.1 | 2.5 | 6 | 관측 |
| 포인트 조회 | 1.9 | 1.3 | 1.6 | 4 | 관측 |
| 포인트 포함 완료 transaction | 7.0 | 5.4 | 6.2 | 16 | 부분 예산 PASS ≤800 |
| 완료 commit 후 응답 생성 | 1247.0 | 380.8 | 405.6 | 11 | 관측 |

수정 전·후는 각각 별도 실행이다. 전체 기간 비로그인은 오히려 느려졌으며 모든 시나리오가 개선됐다는 결론은 내리지 않는다. 변경 후 완료 응답 생성의 최대값은 908.1ms였고 p95와 별도로 관찰해야 한다. transaction과 응답 생성의 개별 p95를 더해 전체 API p95로 취급하지 않는다. 인증·HTTP·네트워크 비용을 포함한 800ms 목표는 별도 검증 대상이다.

## 수정과 실행 계획

기존 로그인 조회는 페이지와 내 순위를 얻기 위해 전체 순위 CTE를 두 번 실행했다. 이제 하나의 순위 결과에서 페이지·다음 페이지 확인용 한 행·내 순위를 함께 가져온다. 전체 SQL은 게임 조회 포함 3회에서 2회로 줄었다. 정렬·필터·응답 계약은 유지하고 새 인덱스나 migration은 추가하지 않았다.

주간 로그인 EXPLAIN에서 표시 이름을 가져오는 마지막 user join은 수정 전 99,000행에서 수정 후 102행으로 줄었다. 수정 전에는 기간 partial index의 index-only scan, 수정 후에는 병렬 sequential scan과 Gather Merge를 선택했다. 기존 인덱스를 없애거나 강제하지 않았으며 선택은 데이터 분포와 planner 비용에 따른다. 수정 후에도 work_mem 4MiB에서 external merge와 임시 디스크 사용이 남아 있으므로 장기 기록 증가·동시 조회 부하를 별도로 측정해야 한다.

원본 SQL·계획·최초/최대 지연·DB 설정은 Git 제외된 로컬 보고서에 있다.

- 수정 전: `.performance/jgd_perf_5b0f0c1d339e414998a47a574e3f41f1/report.json` — TARGET_EXCEEDED.
- 수정 후: `.performance/jgd_perf_b6a59c07c15e4c90865b9a1762947403/report.json` — LOCAL_SMOKE_PASS.

## 백업·복원과 정확성

- 합성 스키마 custom dump 16.3초, 복원 42.8초. migration 이력을 포함한 전체 테이블 행 수·행 해시 합계와 인덱스 정의가 일치했다. 만료된 스토리의 원본·파생 이미지 bytea도 비교에 포함했다.
- 복원 후 신규 사용자 생성으로 0P 계정 trigger를 확인했다. 측정한 공식 완료 22건의 기록·EARN 증가량이 일치하고, 동시 재전송 후 추가 적립이 없었다.
- 성공 후 해당 실행의 스키마와 임시 dump만 정리했다. 위 시간은 로컬 합성 스키마의 도구 실행 시간이며 운영 서비스 RTO가 아니다. 실제 인증 세션 데이터·서버 역할·provider 설정·대용량 사진 누적은 복원 fixture에 포함하지 않았다.

| 수락 기준 | 대응 검증 | 결과 |
|---|---|---|
| 기간 경계·최고 기록·정렬·제외 규칙·top 밖 viewer 유지 | `tests/integration/ranking/number-click-ranking.integration.test.ts` | PASS |
| 페이지 앞/안/다음 행/뒤 viewer가 items·hasMore를 변경하지 않음 | 같은 파일의 페이지 viewer 회귀 test | PASS |
| 완료·적립 정확히 한 번과 원장 정합성 | PostgreSQL integration 및 performance runner replay 검사 | PASS |
| 테스트 대상·개발 DB 별칭·정리 범위 제한, URL 오류 비밀정보 숨김 | `tests/performance/safety.test.ts` | PASS |
| 실제 규모의 계획·랭킹 서비스 지연·격리 복원 | `tests/performance/run.ts` | 로컬 PASS |

최종 회귀 검증: `pnpm test:coverage` 138개 및 coverage gate PASS, PostgreSQL integration 31개 PASS, `E2E_PORT=3109 pnpm test:e2e` 21개 PASS/기존 비대상 조합 6개 skip, lint·format·typecheck·build PASS. pg 8의 기존 동시 query deprecation 경고는 남아 있으며 이 작업에서 dependency major upgrade를 수행하지 않았다.

출시 전 남은 검증: 실제 배포 사양·pool·네트워크와 장기 사용자/원장/사진 분포를 반영한 HTTP 동시 부하, 운영 backup/PITR 활성화 및 격리 DB 복원, 운영자의 RPO/RTO·보존 기간·담당자 확정.
