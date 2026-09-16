-- Additive only: existing auth, records, points and stories are untouched.
CREATE TABLE "game_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "game_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "game_profile_user_id_key" ON "game_profile"("user_id");
CREATE INDEX "game_profile_created_at_id_idx" ON "game_profile"("created_at" DESC, "id" DESC);

CREATE TABLE "game_profile_entry" (
    "profile_id" UUID NOT NULL,
    "game" VARCHAR(16) NOT NULL,
    "nickname" VARCHAR(64) NOT NULL,
    "tier" VARCHAR(32),
    CONSTRAINT "game_profile_entry_pkey" PRIMARY KEY ("profile_id", "game"),
    CONSTRAINT "game_profile_entry_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "game_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_profile_entry_game_check" CHECK ("game" IN ('lol', 'pubg', 'overwatch')),
    CONSTRAINT "game_profile_entry_nickname_check" CHECK (
        char_length(btrim("nickname")) BETWEEN 1 AND 64 AND "nickname" = btrim("nickname") AND "nickname" !~ '[[:cntrl:]<>]'
    ),
    CONSTRAINT "game_profile_entry_tier_check" CHECK (
        "tier" IS NULL OR (char_length(btrim("tier")) BETWEEN 1 AND 32 AND "tier" = btrim("tier") AND "tier" !~ '[[:cntrl:]<>]')
    )
);
