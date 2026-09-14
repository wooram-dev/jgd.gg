# DB 성능 검증과 migration 복구 절차

이 문서는 출시 전 실행 절차다. 데이터 불변식은 [DATABASE.md](DATABASE.md), 보안·보존은 [AUTH.md](AUTH.md), 성능 목표는 [ARCHITECTURE.md](ARCHITECTURE.md)를 따른다. 실제 production 대상의 변경·복원은 대상과 데이터 보존 범위를 확인하고 승인받은 운영자가 수행한다.

최근 로컬 측정과 복원 결과는 [PERFORMANCE_RESULTS.md](PERFORMANCE_RESULTS.md)에 기록한다. 도구는 기존 pg/Prisma를 사용하고 `@types/pg`만 개발 타입 의존성으로 명시했다.

## 로컬 성능·복원 검증

~~~text
pnpm test:performance --quick
pnpm test:performance
~~~

- `--quick`은 도구 검증용 사용자 1,000명·기록 10,000건, 시나리오당 warmup 2회와 측정 3회다. 출시 성능 게이트를 대신하지 않는다.
- 기본 실행은 합성 사용자 100,000명·기록 1,000,000건, warmup 2회 뒤 측정 20회다. p95는 nearest-rank 방식이며 최초 실행 시간도 별도로 남긴다.
- 실제 `getNumberClickRanking`의 오늘·주간·전체 top 100과 top 100 밖 로그인 사용자, 개인 통계, 포인트 조회, 포인트를 포함한 공식 완료 transaction과 후속 응답 생성을 측정한다. 서비스가 실제 실행한 SELECT를 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`으로 다시 실행해 계획을 저장한다.
- 랭킹 서비스는 p95 500ms를 검사한다. 완료 transaction은 전체 완료 API의 800ms 예산을 넘는지 먼저 검사한다. **transaction 통과만으로 전체 완료 API 통과라고 판단하지 않는다.** 후속 응답 시간과 인증·HTTP·네트워크 비용도 별도로 확인해야 한다.
- 결과는 Git 제외된 `.performance/jgd_perf_<실행 ID>/report.json`에 저장한다. SQL에는 합성 데이터만 사용하며 연결 문자열·암호·실제 계정은 기록하지 않는다.

격리와 실행 조건:

1. `.env.local` 또는 `.env`의 `DATABASE_URL_TEST`, `ALLOW_TEST_DATABASE_RESET=true`가 필요하다. 스크립트는 loopback 호스트의 `_test` DB만 허용하고 개발 DB와 같은 대상이면 주소 별칭도 거부한다.
2. 매 실행마다 새 `jgd_perf_<UUID>` 스키마를 생성한다. Prisma schema 옵션과 PostgreSQL search_path를 모두 고정한 뒤 실제 current_database/current_schema를 검사한다. `public`, 기존 테스트 fixture와 개발 데이터는 정리하지 않는다.
3. 현재 migration을 이 스키마에 적용하고 모든 제약·인덱스·신규 사용자 포인트 trigger를 유지한 채 합성 데이터를 적재한다. 일반 unit/integration/E2E와 분리해서 실행한다.
4. 현재 데이터는 사용자당 10개 기록이며 오늘·주간·과거 날짜, 활성 규칙 1/비활성 합성 규칙 2, 차단 사용자 1%, 무효 기록을 섞는다. 포인트는 정책 적용 이후 유효 기록에만 넣고 계정 잔액과 원장 합계를 대조한다. 실제 장기 사용자 분포나 읽기 동시 부하는 재현하지 않는다.
5. PostgreSQL 18의 `pg_dump`/`pg_restore`가 필요하다. Windows 기본 위치는 `C:/Program Files/PostgreSQL/18/bin`, 그 외는 PATH를 사용하며 `PG_BIN_DIR`로 지정할 수 있다. 실행 시간과 디스크 여유를 확보한다.
6. 스크립트가 만든 합성 스키마만 custom-format으로 백업하고 정확한 DB·스키마를 다시 확인한 뒤 삭제·복원한다. 만료된 합성 사진의 원본·파생 이미지도 포함해 모든 테이블 행 수·행 해시 합계, 인덱스 정의, 신규 사용자 0P trigger를 확인한다. 성공하면 임시 dump와 이 실행의 스키마만 제거하고 보고서를 남긴다.
7. 오류가 나면 종료 코드가 0이 아니며 단계·오류 종류만 보고한다. 복원 실패 시 남아 있는 dump와 부분 스키마를 보존하고, 보고서의 정확한 실행 ID와 로컬 DB를 대조한 뒤 처리한다. 임의의 이름이나 `public`을 cleanup 대상으로 지정하는 옵션은 없다.

이 결과는 로컬 warm-cache의 서비스/DB 측정이다. 배포 환경의 CPU·메모리·스토리지·pool 제한·네트워크, 실제 record/원장 분포, HTTP p95를 대체하지 않는다. production 유사 환경의 최종 검증은 운영 대상과 fixture 주입 범위를 별도로 승인한 뒤 수행한다.

## 출시 전 백업 준비

- 배포할 애플리케이션 revision, migration 목록·checksum, 대상 DB와 direct migration 연결을 확인한다. 암호나 전체 연결 문자열을 작업 기록이나 셸 명령 인자로 남기지 않는다.
- managed DB의 자동 backup/PITR 기능을 실제 활성화하고, 보관 기간·허용 데이터 손실 시간(RPO)·복구 목표 시간(RTO)·담당자는 서비스 운영자가 결정한다. 현재 저장소에는 이 값이 확정돼 있지 않다.
- migration 직전 복구 지점의 시각·backup ID·정상 완료 상태를 기록한다. 배포와 별개로 새 격리 DB에 복원할 수 있는지 사전에 검증한다. live DB에 덮어써서 복원 연습을 하지 않는다.
- 스토리 원본·파생 이미지도 DB bytea이므로 DB backup에 포함된다. 만료된 원본도 보관되므로 DB/backup 용량, backup 접근 제어·암호화, 삭제 요청과 backup 보존 정책을 함께 운영한다.
- 일반 logical dump에는 서버 전체 역할·외부 인증 설정·provider 설정이 모두 들어있다고 가정하지 않는다. 환경 변수와 역할 권한은 별도 보안 구성으로 복구하고 검증한다.

## migration 적용 순서

1. 테스트 환경에서 동일 migration을 적용하고 integration과 성능 보고서를 검토한다. 대상 DB에 이미 적용된 migration을 편집하지 않는다.
2. 운영자의 승인 범위와 복구 지점을 확인한 뒤 direct 연결에서 `prisma migrate status`를 확인한다. pending/failed 항목, 예상 table lock과 데이터 증가량을 검토한다.
3. 포인트 migration은 기존 사용자 backfill과 user INSERT trigger/FK를 추가한다. 사용자 가입·공식 완료 트래픽이 적은 시간에 진행하고 긴 lock 대기 시 강행하지 않는다. 스토리 migration은 새 테이블·FK·인덱스만 추가하지만 원본 보관량은 이후 계속 늘어난다.
4. 승인된 실행 환경에서 `pnpm db:deploy`로 적용한다. 적용 전후 migration 상태와 애플리케이션/DB 오류율을 확인한다. production에서 `db push`, reset, 테스트 seed를 실행하지 않는다.
5. 새 사용자 0P 계정, 실제 공식 완료 한 건과 재전송, 포인트 원장·잔액, 랭킹과 스토리 권한·만료를 점검한다. 실제 계정 작업은 해당 사용자/운영자의 승인 범위로 제한한다.

## 실패 시 forward-fix

- 먼저 오류 단계와 실제 DB 상태를 확인한다. migration 실행 실패와 애플리케이션 배포 실패를 구분하고, 실패 migration이 아무것도 변경하지 않았다고 가정하지 않는다.
- 애플리케이션만 문제라면 호환되는 이전 버전으로 되돌리는 방안을 우선 검토한다. 추가된 포인트·스토리 테이블을 drop하거나 원장을 수정해 이전 코드에 맞추지 않는다.
- 이미 적용한 migration의 schema 문제가 확인되면 기존 파일을 바꾸지 않고 새 corrective migration을 만든다. 기존 원장·사진을 보존하는 수정이어야 하며 격리 복원본에서 검증한 후 적용한다.
- Prisma의 failed migration 표시를 처리할 때 `migrate resolve --rolled-back`은 실제 중간 변경의 처리 상태를 확인한 경우에만, `--applied`는 해당 migration 전체 결과가 DB에 존재하고 검증됐을 때만 사용한다. 오류를 숨기기 위해 적용됐다고 표시하지 않는다.
- 잔액과 원장이 다르면 새 적립을 계속하지 않는다. 원본 EARN을 덮어쓰거나 삭제하지 않고 원인과 영향 기록을 확인한다. 기록 무효화는 기존 서버의 원자적 REVERSAL 절차를 사용한다.
- 데이터 손상이 의심되면 승인된 backup/PITR를 **새 DB**로 복원하고 테이블·제약·포인트 정합성·로그인·스토리 보관을 검증한다. 실제 전환 전 복구 지점 이후의 누락 가능 데이터와 처리 방법을 운영자가 승인한다. 복원·전환 후에도 원래 DB를 즉시 삭제하지 않는다.

## 복구 확인 항목

- 모든 migration의 상태와 테이블·enum·FK·CHECK·unique/partial index가 기대한 상태다.
- 사용자별 PointAccount가 하나이고 balance가 원장 합계와 일치하며 음수가 없다.
- 같은 GameRecord의 EARN/REVERSAL은 각 최대 한 건이다. 신규 사용자 INSERT가 0P 계정을 생성한다.
- GameSession당 GameRecord 한 건, 세션 상태별 필드와 기록 점수 불변식을 유지한다.
- 차단/무효/규칙 버전/기간 필터와 top 밖 내 순위가 복구 전 계약대로 동작한다.
- 인증 DB session과 OAuth 구성은 정상이며 callback 이후 provider token을 영구 보관하지 않는다.
- 스토리 원본과 파생 이미지가 보존되고 로그인·만료 검사가 정상이다. 만료 사진을 공개 경로로 되살리지 않는다.
- 실제 수행한 항목·소요 시간·미검증 범위를 [STATUS.md](STATUS.md)에 갱신한다.
