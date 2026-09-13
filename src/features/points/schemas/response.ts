import { z } from "zod";

export const pointOverviewDataSchema = z.object({
  balance: z.number().int().nonnegative(),
  unit: z.literal("P"),
  transactions: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(["EARN", "REVERSAL"]),
      reason: z.enum(["NUMBER_CLICK_COMPLETION", "GAME_RECORD_INVALIDATION"]),
      amount: z.number().int(),
      balanceAfter: z.number().int().nonnegative(),
      policyVersion: z.string().min(1),
      createdAt: z.iso.datetime(),
    }),
  ),
});

export const pointOverviewResponseSchema = z.object({
  data: pointOverviewDataSchema,
  meta: z.object({ requestId: z.string().min(1) }),
});

export type PointOverviewData = z.infer<typeof pointOverviewDataSchema>;
