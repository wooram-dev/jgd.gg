import { z } from "zod";

export const rankingPeriodKeySchema = z.enum(["today", "week", "all"]);

export const rankingItemSchema = z.object({
  rank: z.number().int().positive(),
  displayName: z.string().min(1),
  avatarUrl: z.string().nullable(),
  finalMs: z.number().int().nonnegative(),
  mistakeCount: z.number().int().nonnegative(),
  achievedAt: z.iso.datetime(),
  isViewer: z.boolean(),
});

export const rankingDataSchema = z.object({
  gameSlug: z.literal("number-click"),
  period: z.object({
    key: rankingPeriodKeySchema,
    timeZone: z.literal("Asia/Seoul"),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
  }),
  items: z.array(rankingItemSchema),
  viewer: rankingItemSchema.nullable(),
  pagination: z.object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
});

export const rankingResponseSchema = z.object({
  data: rankingDataSchema,
  meta: z.object({ requestId: z.string().min(1) }),
});

export type RankingData = z.infer<typeof rankingDataSchema>;
export type RankingItem = z.infer<typeof rankingItemSchema>;
