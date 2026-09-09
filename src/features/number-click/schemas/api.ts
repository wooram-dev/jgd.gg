import { z } from "zod";

import { NUMBER_CLICK_RULES } from "../domain/rules";

export const emptyBodySchema = z.object({}).strict();

export const completeGameSchema = z
  .object({
    clientElapsedMs: z.number().int().safe().min(0).max(600_000),
    events: z
      .array(
        z
          .object({
            value: z.number().int().min(1).max(NUMBER_CLICK_RULES.maxNumber),
            elapsedMs: z.number().int().safe().min(0).max(600_000),
          })
          .strict(),
      )
      .min(NUMBER_CLICK_RULES.maxNumber)
      .max(NUMBER_CLICK_RULES.maximumClickCount),
  })
  .strict()
  .superRefine((value, context) => {
    value.events.forEach((event, index) => {
      if (event.elapsedMs > value.clientElapsedMs) {
        context.addIssue({
          code: "custom",
          path: ["events", index, "elapsedMs"],
          message: "clientElapsedMs 이하여야 합니다.",
        });
      }
    });
  });

export type CompleteGameInput = z.infer<typeof completeGameSchema>;

export const storedRulesSchema = z
  .object({
    version: z.literal(1),
    boardSize: z.literal(5),
    maxNumber: z.literal(25),
    penaltyPerMistakeMs: z.literal(500),
    minimumDurationMs: z.literal(3_000),
    maximumDurationMs: z.literal(300_000),
    maximumClickCount: z.literal(100),
  })
  .strict();

export const challengeDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    board: z.array(z.number().int().min(1).max(25)).length(25),
  })
  .strict();
