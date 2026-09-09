CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'BANNED');
CREATE TYPE "game_status" AS ENUM ('ACTIVE', 'HIDDEN');
CREATE TYPE "score_direction" AS ENUM ('ASC', 'DESC');
CREATE TYPE "score_unit" AS ENUM ('MILLISECONDS', 'POINTS', 'COUNT');
CREATE TYPE "game_session_status" AS ENUM (
  'READY',
  'PLAYING',
  'COMPLETED',
  'ABANDONED',
  'EXPIRED',
  'REJECTED'
);

CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "discord_username" TEXT NOT NULL,
  "discord_display_name" TEXT NOT NULL,
  "discord_avatar_hash" TEXT,
  "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
  "profile_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_email_placeholder_check" CHECK ("email" LIKE '%@discord.placeholder.invalid'),
  CONSTRAINT "user_discord_username_length_check" CHECK (char_length("discord_username") BETWEEN 1 AND 64),
  CONSTRAINT "user_discord_display_name_length_check" CHECK (char_length("discord_display_name") BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_user_id_idx" ON "session"("user_id");
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMPTZ(3),
  "refresh_token_expires_at" TIMESTAMPTZ(3),
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);

CREATE UNIQUE INDEX "account_issuer_account_id_key" ON "account"("issuer", "account_id");
CREATE INDEX "account_user_id_idx" ON "account"("user_id");
CREATE UNIQUE INDEX "account_one_discord_per_user" ON "account"("user_id") WHERE "provider_id" = 'discord';

CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);

CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
CREATE INDEX "verification_expires_at_idx" ON "verification"("expires_at");

CREATE TABLE "game" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" VARCHAR(64) NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "description" TEXT NOT NULL,
  "status" "game_status" NOT NULL DEFAULT 'ACTIVE',
  "score_direction" "score_direction" NOT NULL,
  "score_unit" "score_unit" NOT NULL,
  "current_rules_version" INTEGER NOT NULL,
  "ranked_rules_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "game_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT "game_current_rules_version_check" CHECK ("current_rules_version" >= 1),
  CONSTRAINT "game_ranked_rules_version_check" CHECK ("ranked_rules_version" >= 1)
);

CREATE UNIQUE INDEX "game_slug_key" ON "game"("slug");

CREATE TABLE "game_session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "game_id" UUID NOT NULL REFERENCES "game"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" "game_session_status" NOT NULL DEFAULT 'READY',
  "idempotency_key" UUID NOT NULL,
  "rules_version" INTEGER NOT NULL,
  "rules_snapshot" JSONB NOT NULL,
  "challenge_data" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_expires_at" TIMESTAMPTZ(3) NOT NULL,
  "started_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "terminal_reason" VARCHAR(64),
  CONSTRAINT "game_session_rules_snapshot_object_check" CHECK (jsonb_typeof("rules_snapshot") = 'object'),
  CONSTRAINT "game_session_challenge_data_object_check" CHECK (jsonb_typeof("challenge_data") = 'object'),
  CONSTRAINT "game_session_rules_version_check" CHECK ("rules_version" >= 1),
  CONSTRAINT "game_session_ready_expiry_check" CHECK ("ready_expires_at" > "created_at"),
  CONSTRAINT "game_session_started_at_check" CHECK ("started_at" IS NULL OR "started_at" >= "created_at"),
  CONSTRAINT "game_session_expires_at_check" CHECK ("expires_at" IS NULL OR "expires_at" > "started_at"),
  CONSTRAINT "game_session_completed_at_check" CHECK ("completed_at" IS NULL OR "completed_at" >= "started_at"),
  CONSTRAINT "game_session_status_fields_check" CHECK (
    ("status" = 'READY' AND "started_at" IS NULL AND "expires_at" IS NULL AND "completed_at" IS NULL) OR
    ("status" = 'PLAYING' AND "started_at" IS NOT NULL AND "expires_at" IS NOT NULL AND "completed_at" IS NULL) OR
    ("status" = 'COMPLETED' AND "started_at" IS NOT NULL AND "expires_at" IS NOT NULL AND "completed_at" IS NOT NULL) OR
    ("status" IN ('ABANDONED', 'EXPIRED') AND "completed_at" IS NULL) OR
    ("status" = 'REJECTED' AND "started_at" IS NOT NULL AND "expires_at" IS NOT NULL AND "completed_at" IS NULL)
  )
);

CREATE UNIQUE INDEX "game_session_user_id_idempotency_key_key" ON "game_session"("user_id", "idempotency_key");
CREATE UNIQUE INDEX "game_session_one_live_per_user_game" ON "game_session"("user_id", "game_id") WHERE "status" IN ('READY', 'PLAYING');
CREATE INDEX "game_session_user_game_created_idx" ON "game_session"("user_id", "game_id", "created_at" DESC);
CREATE INDEX "game_session_ready_expiry_idx" ON "game_session"("status", "ready_expires_at") WHERE "status" = 'READY';
CREATE INDEX "game_session_playing_expiry_idx" ON "game_session"("status", "expires_at") WHERE "status" = 'PLAYING';

CREATE TABLE "game_record" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL REFERENCES "game_session"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "game_id" UUID NOT NULL REFERENCES "game"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "rules_version" INTEGER NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "mistake_count" INTEGER NOT NULL,
  "penalty_ms" INTEGER NOT NULL,
  "score_value" INTEGER NOT NULL,
  "click_count" INTEGER NOT NULL,
  "server_elapsed_ms" INTEGER NOT NULL,
  "result_data" JSONB NOT NULL,
  "achieved_at" TIMESTAMPTZ(3) NOT NULL,
  "rank_eligible" BOOLEAN NOT NULL DEFAULT true,
  "invalidated_at" TIMESTAMPTZ(3),
  "invalidated_reason" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_record_rules_version_check" CHECK ("rules_version" >= 1),
  CONSTRAINT "game_record_duration_check" CHECK ("duration_ms" BETWEEN 1 AND 300000),
  CONSTRAINT "game_record_mistake_count_check" CHECK ("mistake_count" BETWEEN 0 AND 75),
  CONSTRAINT "game_record_penalty_check" CHECK ("penalty_ms" >= 0),
  CONSTRAINT "game_record_score_check" CHECK ("score_value" >= "duration_ms"),
  CONSTRAINT "game_record_click_count_check" CHECK ("click_count" BETWEEN 25 AND 100),
  CONSTRAINT "game_record_server_elapsed_check" CHECK ("server_elapsed_ms" >= 0),
  CONSTRAINT "game_record_result_data_object_check" CHECK (jsonb_typeof("result_data") = 'object'),
  CONSTRAINT "game_record_invalidation_check" CHECK (
    ("rank_eligible" AND "invalidated_at" IS NULL AND "invalidated_reason" IS NULL) OR NOT "rank_eligible"
  )
);

CREATE UNIQUE INDEX "game_record_session_id_key" ON "game_record"("session_id");
CREATE INDEX "game_record_user_recent" ON "game_record"("user_id", "game_id", "achieved_at" DESC);
CREATE INDEX "game_record_best_per_user" ON "game_record"(
  "game_id", "rules_version", "user_id", "score_value", "mistake_count", "achieved_at", "id"
) WHERE "rank_eligible" = true;
CREATE INDEX "game_record_period" ON "game_record"(
  "game_id", "rules_version", "achieved_at", "user_id"
) INCLUDE ("score_value", "mistake_count", "id") WHERE "rank_eligible" = true;

INSERT INTO "game" (
  "slug",
  "display_name",
  "description",
  "status",
  "score_direction",
  "score_unit",
  "current_rules_version",
  "ranked_rules_version",
  "updated_at"
) VALUES (
  'number-click',
  '숫자 순서대로 누르기',
  '1부터 25까지 순서대로 최대한 빠르게 누르세요.',
  'ACTIVE',
  'ASC',
  'MILLISECONDS',
  1,
  1,
  CURRENT_TIMESTAMP
);
