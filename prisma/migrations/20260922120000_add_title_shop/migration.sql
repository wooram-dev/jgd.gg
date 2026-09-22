CREATE TABLE "title_purchase" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title_key" VARCHAR(16) NOT NULL CHECK (title_key IN ('lockdown','overwatch','lol','pubg','minecraft','valorant')),
  "price" INTEGER NOT NULL CHECK (price = 500),
  "request_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, title_key),
  UNIQUE (user_id, request_id),
  UNIQUE (id, user_id)
);
CREATE TABLE "title_equipment" (
  "user_id" TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "configuration_key" VARCHAR(64),
  "desired_title_key" VARCHAR(16),
  "applied_title_key" VARCHAR(16),
  "pending" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  "retry_at" TIMESTAMPTZ(3),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id, desired_title_key) REFERENCES title_purchase(user_id, title_key) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (user_id, applied_title_key) REFERENCES title_purchase(user_id, title_key) ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK (pending OR (desired_title_key IS NOT DISTINCT FROM applied_title_key AND retry_at IS NULL))
);
ALTER TABLE point_transaction ADD COLUMN title_purchase_id UUID UNIQUE REFERENCES title_purchase(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE point_transaction ADD CONSTRAINT point_transaction_purchase_owner_fk
  FOREIGN KEY (title_purchase_id, account_user_id) REFERENCES title_purchase(id, user_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE point_transaction ALTER COLUMN game_record_id DROP NOT NULL;
-- Replace the shape constraint to admit purchases while retaining every earn/reversal invariant.
ALTER TABLE point_transaction DROP CONSTRAINT point_transaction_shape_check;
ALTER TABLE point_transaction ADD CONSTRAINT point_transaction_shape_check CHECK (
  (type = 'EARN' AND reason = 'NUMBER_CLICK_COMPLETION' AND amount > 0
    AND game_record_id IS NOT NULL AND related_transaction_id IS NULL AND title_purchase_id IS NULL)
  OR (type = 'REVERSAL' AND reason = 'GAME_RECORD_INVALIDATION' AND amount < 0
    AND game_record_id IS NOT NULL AND related_transaction_id IS NOT NULL AND title_purchase_id IS NULL)
  OR (type = 'SPEND' AND reason = 'TITLE_PURCHASE' AND amount = -500
    AND game_record_id IS NULL AND related_transaction_id IS NULL AND title_purchase_id IS NOT NULL)
);
