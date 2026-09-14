-- Additive only: originals are retained after visibility expires. No existing data changes.
CREATE TABLE "story" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "upload_key" UUID NOT NULL,
  "original" BYTEA NOT NULL,
  "original_type" VARCHAR(32) NOT NULL,
  "image" BYTEA NOT NULL,
  "thumbnail" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '24 hours'),
  CONSTRAINT "story_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "story_original_size" CHECK (octet_length("original") BETWEEN 1 AND 5242880),
  CONSTRAINT "story_image_size" CHECK (octet_length("image") BETWEEN 1 AND 5242880),
  CONSTRAINT "story_thumbnail_size" CHECK (octet_length("thumbnail") BETWEEN 1 AND 524288),
  CONSTRAINT "story_original_type" CHECK ("original_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "story_visibility_window" CHECK ("expires_at" = "created_at" + interval '24 hours')
);
CREATE UNIQUE INDEX "story_user_id_upload_key_key" ON "story"("user_id", "upload_key");
CREATE INDEX "story_created_at_id_idx" ON "story"("created_at" DESC, "id" DESC);
CREATE INDEX "story_user_id_created_at_idx" ON "story"("user_id", "created_at" DESC);
