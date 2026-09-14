import { z } from "zod";

export const MAX_STORY_BYTES = 5 * 1024 * 1024;
export const STORY_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const STORY_UPLOAD_LIMIT = 10;
export const STORY_DISPLAY_MS = 5_000;

export const storySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  isViewer: z.boolean(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export const storyGroupSchema = storySchema.extend({ stories: z.array(storySchema).min(1) });
export const storyFeedSchema = z.object({
  items: z.array(storyGroupSchema),
  serverNow: z.iso.datetime(),
  nextCursor: z.string().uuid().nullable(),
});
export type StoryItem = z.infer<typeof storySchema>;
export type StoryGroup = z.infer<typeof storyGroupSchema>;
export type StoryFeed = z.infer<typeof storyFeedSchema>;

export const storyQuerySchema = z.object({ cursor: z.string().uuid().optional() }).strict();
export const storyImageQuerySchema = z
  .object({ size: z.enum(["image", "thumbnail"]).default("image") })
  .strict();
