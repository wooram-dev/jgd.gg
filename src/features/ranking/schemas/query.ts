import { z } from "zod";

const decimalInteger = (minimum: number, maximum: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum));

export const rankingQuerySchema = z
  .object({
    period: z.enum(["today", "week", "all"]).default("today"),
    limit: decimalInteger(1, 100).default(100),
    offset: decimalInteger(0, 1_000).default(0),
  })
  .strict();

export type RankingQuery = z.infer<typeof rankingQuerySchema>;
