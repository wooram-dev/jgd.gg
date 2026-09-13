import { z } from "zod";

import type { CompletionPayload, OfficialResult } from "./game-reducer";

const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
  meta: z.object({ requestId: z.string() }),
});

const createSessionSchema = z.object({
  data: z.object({
    session: z.object({ id: z.string().uuid(), status: z.string() }),
    board: z.array(z.number().int()).length(25),
  }),
  meta: z.object({ requestId: z.string(), idempotentReplay: z.boolean() }),
});

const startSessionSchema = z.object({
  data: z.object({
    session: z.object({
      id: z.string().uuid(),
      status: z.literal("PLAYING"),
      startedAt: z.string(),
      expiresAt: z.string(),
    }),
  }),
  meta: z.object({ requestId: z.string(), idempotentReplay: z.boolean() }),
});

const completeSessionSchema = z.object({
  data: z.object({
    record: z.object({
      id: z.string().uuid(),
      gameSlug: z.literal("number-click"),
      durationMs: z.number().int(),
      mistakeCount: z.number().int(),
      penaltyMs: z.number().int(),
      finalMs: z.number().int(),
      achievedAt: z.string(),
    }),
    result: z.object({
      isPersonalBest: z.boolean(),
      previousPersonalBestMs: z.number().int().nullable(),
    }),
    ranks: z.object({
      today: z.number().int().nullable(),
      week: z.number().int().nullable(),
      all: z.number().int().nullable(),
    }),
    points: z.object({
      status: z.enum(["AWARDED", "DAILY_LIMIT_REACHED", "NOT_ELIGIBLE", "REVERSED"]),
      awarded: z.number().int().nonnegative(),
      balance: z.number().int().nonnegative(),
      dailyLimit: z.number().int().positive(),
      policyVersion: z.string().min(1),
    }),
  }),
  meta: z.object({ requestId: z.string(), idempotentReplay: z.boolean() }),
});

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function readResponse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      response.status,
      "INVALID_RESPONSE",
      "서버 응답을 확인할 수 없습니다.",
    );
  }

  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(body);
    throw new ApiClientError(
      response.status,
      parsed.success ? parsed.data.error.code : "UNKNOWN_ERROR",
      parsed.success ? parsed.data.error.message : "요청을 처리하지 못했습니다.",
      parsed.success ? parsed.data.meta.requestId : undefined,
    );
  }
  return body;
}

export async function createOfficialSession(idempotencyKey: string) {
  const response = await fetch("/api/v1/games/number-click/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: "{}",
  });
  return createSessionSchema.parse(await readResponse(response));
}

export async function startOfficialSession(sessionId: string) {
  const response = await fetch(`/api/v1/game-sessions/${sessionId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return startSessionSchema.parse(await readResponse(response));
}

export async function completeOfficialSession(
  sessionId: string,
  completionPayload: CompletionPayload,
): Promise<OfficialResult> {
  const response = await fetch(`/api/v1/game-sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(completionPayload),
  });
  return completeSessionSchema.parse(await readResponse(response)).data;
}

export async function abandonOfficialSession(sessionId: string): Promise<void> {
  await fetch(`/api/v1/game-sessions/${sessionId}/abandon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    keepalive: true,
  });
}
