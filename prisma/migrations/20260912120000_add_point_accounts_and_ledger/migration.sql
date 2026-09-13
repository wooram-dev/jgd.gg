CREATE TYPE "point_transaction_type" AS ENUM ('EARN', 'REVERSAL');
CREATE TYPE "point_transaction_reason" AS ENUM (
  'NUMBER_CLICK_COMPLETION',
  'GAME_RECORD_INVALIDATION'
);

CREATE TABLE "point_account" (
  "user_id" TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "point_account_balance_check" CHECK ("balance" >= 0)
);

CREATE TABLE "point_transaction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_user_id" TEXT NOT NULL REFERENCES "point_account"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" "point_transaction_type" NOT NULL,
  "reason" "point_transaction_reason" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "game_record_id" UUID NOT NULL REFERENCES "game_record"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "related_transaction_id" UUID REFERENCES "point_transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "policy_version" VARCHAR(64) NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "point_transaction_amount_check" CHECK ("amount" <> 0),
  CONSTRAINT "point_transaction_balance_after_check" CHECK ("balance_after" >= 0),
  CONSTRAINT "point_transaction_policy_version_check" CHECK (char_length("policy_version") BETWEEN 1 AND 64),
  CONSTRAINT "point_transaction_idempotency_key_check" CHECK (char_length("idempotency_key") BETWEEN 1 AND 128),
  CONSTRAINT "point_transaction_shape_check" CHECK (
    (
      "type" = 'EARN'
      AND "reason" = 'NUMBER_CLICK_COMPLETION'
      AND "amount" > 0
      AND "related_transaction_id" IS NULL
    )
    OR
    (
      "type" = 'REVERSAL'
      AND "reason" = 'GAME_RECORD_INVALIDATION'
      AND "amount" < 0
      AND "related_transaction_id" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "point_transaction_account_user_id_idempotency_key_key"
ON "point_transaction"("account_user_id", "idempotency_key");
CREATE UNIQUE INDEX "point_transaction_type_game_record_id_key"
ON "point_transaction"("type", "game_record_id");
CREATE INDEX "point_transaction_account_recent"
ON "point_transaction"("account_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "point_transaction_related_transaction_id_idx"
ON "point_transaction"("related_transaction_id");

INSERT INTO "point_account" ("user_id", "balance", "created_at", "updated_at")
SELECT "id", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user"
ON CONFLICT ("user_id") DO NOTHING;

CREATE FUNCTION "create_point_account_for_user"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "point_account" ("user_id", "balance", "created_at", "updated_at")
  VALUES (NEW."id", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("user_id") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "user_create_point_account"
AFTER INSERT ON "user"
FOR EACH ROW
EXECUTE FUNCTION "create_point_account_for_user"();
