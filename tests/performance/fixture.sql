-- Synthetic identities only. All statements run in the runner's isolated schema.
INSERT INTO "user" (id, name, email, discord_username, discord_display_name, status, updated_at)
SELECT 'perf-user-' || lpad(n::text, 6, '0'),
       'Performance ' || n, 'perf-' || n || '@discord.placeholder.invalid',
       'perf-' || n, 'Performance ' || n,
       CASE WHEN n % 100 = 0 THEN 'BANNED' ELSE 'ACTIVE' END::user_status,
       CURRENT_TIMESTAMP
FROM generate_series(1, $1::int) AS n;

-- The script sends each statement separately so positional parameters remain bound.
CREATE TABLE fixture_record AS
SELECT n,
       md5('perf-session-' || n)::uuid AS session_id,
       md5('perf-record-' || n)::uuid AS record_id,
       'perf-user-' || lpad((((n - 1) / 10) + 1)::text, 6, '0') AS user_id,
       CASE WHEN n % 10 >= 8 THEN 2 ELSE 1 END AS rules_version,
       5000 + (((n - 1) / 10) % 200000) + (n % 10) * 31 AS duration_ms,
       n % 3 AS mistake_count,
       $2::timestamptz - interval '1 hour' -
         (CASE n % 10 WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 4
          WHEN 5 THEN 10 WHEN 6 THEN 30 WHEN 7 THEN 90 WHEN 8 THEN 180 ELSE 365 END) * interval '1 day' AS achieved_at,
       n % 17 <> 0 AS rank_eligible
FROM generate_series(1, $1::int) AS n;

INSERT INTO game_session (id, user_id, game_id, status, idempotency_key, rules_version,
  rules_snapshot, challenge_data, created_at, ready_expires_at, started_at, expires_at, completed_at)
SELECT f.session_id, f.user_id, g.id, 'COMPLETED', f.session_id, f.rules_version,
       jsonb_set($1::jsonb, '{version}', to_jsonb(f.rules_version)), $2::jsonb,
       f.achieved_at - interval '5 minutes', f.achieved_at - interval '4 minutes',
       f.achieved_at - f.duration_ms * interval '1 millisecond',
       f.achieved_at + interval '1 minute', f.achieved_at
FROM fixture_record f CROSS JOIN game g WHERE g.slug = 'number-click';

INSERT INTO game_record (id, session_id, user_id, game_id, rules_version, duration_ms,
  mistake_count, penalty_ms, score_value, click_count, server_elapsed_ms, result_data, achieved_at, rank_eligible)
SELECT f.record_id, f.session_id, f.user_id, g.id, f.rules_version, f.duration_ms,
       f.mistake_count, f.mistake_count * 500, f.duration_ms + f.mistake_count * 500,
       25 + f.mistake_count, f.duration_ms, '{"schemaVersion":1,"validationVersion":1}',
       f.achieved_at, f.rank_eligible
FROM fixture_record f CROSS JOIN game g WHERE g.slug = 'number-click';

INSERT INTO point_transaction (account_user_id, type, reason, amount, balance_after,
  game_record_id, policy_version, idempotency_key, created_at)
SELECT f.user_id, 'EARN', 'NUMBER_CLICK_COMPLETION', 10,
       (row_number() OVER (PARTITION BY f.user_id ORDER BY f.achieved_at, f.record_id) * 10)::int,
       f.record_id, $1, 'game-record:' || f.record_id || ':earn', f.achieved_at
FROM fixture_record f JOIN "user" u ON u.id = f.user_id
WHERE f.rank_eligible AND u.status = 'ACTIVE' AND f.rules_version = 1 AND f.achieved_at >= $2::timestamptz;

UPDATE point_account a SET balance = ledger.balance
FROM (SELECT account_user_id, sum(amount)::int AS balance FROM point_transaction GROUP BY account_user_id) ledger
WHERE a.user_id = ledger.account_user_id;

DROP TABLE fixture_record;
