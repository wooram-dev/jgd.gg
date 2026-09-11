import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http/api-error";

import { getNumberClickRanking } from "../../ranking/server/ranking-service";
import { replayNumberClick } from "../domain/replay";
import { NUMBER_CLICK_RULES, NUMBER_CLICK_SLUG } from "../domain/rules";
import { challengeDataSchema, storedRulesSchema, type CompleteGameInput } from "../schemas/api";

type CompleteSuccess = {
  ok: true;
  recordId: string;
  idempotentReplay: boolean;
};

type CompleteFailure = { ok: false; error: ApiError };

export async function completeGameSessionTransaction(
  database: PrismaClient,
  input: { userId: string; sessionId: string; completion: CompleteGameInput; now?: Date },
): Promise<CompleteSuccess | CompleteFailure> {
  return database.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "game_session" WHERE id = ${input.sessionId}::uuid AND "user_id" = ${input.userId} FOR UPDATE`,
    );
    if (locked.length === 0) {
      return { ok: false, error: new ApiError(404, "NOT_FOUND") };
    }

    const session = await transaction.gameSession.findUnique({
      where: { id: input.sessionId },
      include: {
        game: { select: { slug: true } },
        record: { select: { id: true } },
        user: { select: { status: true } },
      },
    });
    if (!session || session.game.slug !== NUMBER_CLICK_SLUG) {
      return { ok: false, error: new ApiError(404, "NOT_FOUND") };
    }
    if (session.user.status === "BANNED") {
      return { ok: false, error: new ApiError(403, "USER_BANNED") };
    }
    if (session.status === "COMPLETED" && session.record) {
      return { ok: true, recordId: session.record.id, idempotentReplay: true };
    }
    if (session.status !== "PLAYING" || !session.startedAt || !session.expiresAt) {
      return { ok: false, error: new ApiError(409, "SESSION_NOT_PLAYING") };
    }

    const now =
      input.now ??
      (await transaction.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT clock_timestamp() AS now`))[0]
        ?.now;
    if (!now) {
      throw new Error("Database clock did not return a value.");
    }
    if (now > session.expiresAt) {
      await transaction.gameSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED", terminalReason: "PLAYING_EXPIRED" },
      });
      return { ok: false, error: new ApiError(410, "SESSION_EXPIRED") };
    }

    const parsedRules = storedRulesSchema.safeParse(session.rulesSnapshot);
    const parsedChallenge = challengeDataSchema.safeParse(session.challengeData);
    if (
      !parsedRules.success ||
      session.rulesVersion !== parsedRules.data.version ||
      !parsedChallenge.success
    ) {
      const code =
        parsedRules.success && session.rulesVersion === parsedRules.data.version
          ? "RESULT_BOARD_INVALID"
          : "RESULT_RULES_UNSUPPORTED";
      await transaction.gameSession.update({
        where: { id: session.id },
        data: { status: "REJECTED", terminalReason: code },
      });
      return { ok: false, error: new ApiError(422, code) };
    }

    const replay = replayNumberClick({
      board: parsedChallenge.data.board,
      rules: parsedRules.data,
      clientElapsedMs: input.completion.clientElapsedMs,
      events: input.completion.events,
    });

    if (!replay.ok) {
      await transaction.gameSession.update({
        where: { id: session.id },
        data: { status: "REJECTED", terminalReason: replay.code },
      });
      return { ok: false, error: new ApiError(422, replay.code) };
    }

    const serverElapsedMs = Math.max(0, now.getTime() - session.startedAt.getTime());
    if (serverElapsedMs + NUMBER_CLICK_RULES.clockToleranceMs < replay.durationMs) {
      await transaction.gameSession.update({
        where: { id: session.id },
        data: { status: "REJECTED", terminalReason: "RESULT_CLOCK_INVALID" },
      });
      return { ok: false, error: new ApiError(422, "RESULT_CLOCK_INVALID") };
    }

    const boardDigest = createHash("sha256")
      .update(JSON.stringify({ schemaVersion: 1, board: parsedChallenge.data.board }))
      .digest("base64url");
    const record = await transaction.gameRecord.create({
      data: {
        sessionId: session.id,
        userId: session.userId,
        gameId: session.gameId,
        rulesVersion: session.rulesVersion,
        durationMs: replay.durationMs,
        mistakeCount: replay.mistakeCount,
        penaltyMs: replay.penaltyMs,
        scoreValue: replay.finalMs,
        clickCount: replay.clickCount,
        serverElapsedMs,
        resultData: {
          schemaVersion: 1,
          validationVersion: 1,
          clientElapsedMs: replay.durationMs,
          boardDigest,
        },
        achievedAt: now,
      },
    });
    await transaction.gameSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: now },
    });

    return { ok: true, recordId: record.id, idempotentReplay: false };
  });
}

export async function findCompletedRecord(
  database: PrismaClient,
  input: { userId: string; sessionId: string },
): Promise<{ recordId: string } | null> {
  const session = await database.gameSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
      status: "COMPLETED",
      game: { slug: NUMBER_CLICK_SLUG },
    },
    select: { record: { select: { id: true } } },
  });

  return session?.record ? { recordId: session.record.id } : null;
}

export async function buildCompleteResponse(
  database: PrismaClient,
  input: { recordId: string; userId: string; idempotentReplay: boolean; now?: Date },
) {
  const record = await database.gameRecord.findUnique({ where: { id: input.recordId } });
  if (!record) {
    throw new Error("Completed record is missing.");
  }

  const orderedRecords = await database.gameRecord.findMany({
    where: {
      userId: input.userId,
      gameId: record.gameId,
      rulesVersion: record.rulesVersion,
      rankEligible: true,
    },
    orderBy: [{ scoreValue: "asc" }, { mistakeCount: "asc" }, { achievedAt: "asc" }, { id: "asc" }],
    select: { id: true, scoreValue: true },
  });
  const best = orderedRecords[0] ?? null;
  const previousBest = orderedRecords.find((candidate) => candidate.id !== record.id) ?? null;

  let ranks: { today: number | null; week: number | null; all: number | null } = {
    today: null,
    week: null,
    all: null,
  };
  let rankLookupFailed = false;
  try {
    const [today, week, all] = await Promise.all(
      (["today", "week", "all"] as const).map((period) =>
        getNumberClickRanking(database, {
          period,
          limit: 1,
          offset: 0,
          viewerId: input.userId,
          now: input.now,
        }),
      ),
    );
    ranks = {
      today: today?.viewer?.rank ?? null,
      week: week?.viewer?.rank ?? null,
      all: all?.viewer?.rank ?? null,
    };
  } catch (error) {
    rankLookupFailed = true;
    console.error(
      JSON.stringify({
        level: "error",
        event: "ranking.lookup_failed_after_completion",
        userId: input.userId,
        sessionId: record.sessionId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  }

  return {
    data: {
      record: {
        id: record.id,
        gameSlug: "number-click",
        durationMs: record.durationMs,
        mistakeCount: record.mistakeCount,
        penaltyMs: record.penaltyMs,
        finalMs: record.scoreValue,
        achievedAt: record.achievedAt.toISOString(),
      },
      result: {
        isPersonalBest: best?.id === record.id,
        previousPersonalBestMs: previousBest?.scoreValue ?? null,
      },
      ranks,
    },
    meta: {
      idempotentReplay: input.idempotentReplay,
      ...(rankLookupFailed ? { rankLookupFailed: true } : {}),
    },
  };
}
