import { z } from "zod";
import { TITLE_KEYS } from "../catalog";
export const titleKeySchema = z.enum(TITLE_KEYS);
export const purchaseTitleSchema = z
  .object({ titleKey: titleKeySchema, requestId: z.string().uuid() })
  .strict();
export const equipTitleSchema = z
  .object({
    titleKey: titleKeySchema.nullable(),
    expectedRevision: z.number().int().nonnegative().max(2_147_483_646),
  })
  .strict();
export const titleShopSchema = z.object({
  balance: z.number().int().nonnegative(),
  enabled: z.boolean(),
  canModify: z.boolean(),
  owned: z.array(titleKeySchema),
  equipment: z.object({
    desired: titleKeySchema.nullable(),
    applied: titleKeySchema.nullable(),
    pending: z.boolean(),
    revision: z.number().int().nonnegative(),
    retryAt: z.iso.datetime().nullable(),
  }),
});
export const titleShopResponseSchema = z.object({
  data: titleShopSchema,
  meta: z.object({ requestId: z.string() }),
});
export type TitleShopData = z.infer<typeof titleShopSchema>;
