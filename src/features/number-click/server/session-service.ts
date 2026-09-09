import type { GameSessionStatus, PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http/api-error";

import {
  NUMBER_CLICK_RULES,
  NUMBER_CLICK_RULES_SNAPSHOT,
  NUMBER_CLICK_SLUG,
} from "../domain/rules";
import { challengeDataSchema } from "../schemas/api";
import { createOfficialBoard } from "./board";

type Database = PrismaClient;

export type SessionCreateResult = {
  session: {
    id: string;
    status: GameSessionStatus;
    rulesVersion: number;
    readyExpiresAt: string;
  };
  board: number[];
  rules: {
    boardSize: number;
    maxNumber: number;
    penaltyPerMistakeMs: number;
  };
  idempotentReplay: boolean;
};

async function databaseNow(
  transaction: Pick<Prisma.TransactionClient, "$queryRaw">,
  supplied?: Date,
): Promise<Date> {
  if (supplied) {
    return supplied;
  }
  const rows = await transaction.$queryRaw<{ now: Date }[]>(
    Prisma.sql`SELECT clock_timestamp() AS now`,
  );
  const now = rows[0]?.now;
  if (!now) {
    throw new Error("Database clock did not return a value.");
  }
  return now;
}

function toCreateResult(
  session: {
    id: string;
    status: GameSessionStatus;
    rulesVersion: number;
    readyExpiresAt: Date;
    challengeData: Prisma.JsonValue;
  },
  idempotentReplay: boolean,
): SessionCreateResult {
  const challenge = challengeDataSchema.parse(session.challengeData);
  return {
    session: {
      id: session.id,
      status: session.status,
      rulesVersion: session.rulesVersion,
      readyExpiresAt: session.readyExpiresAt.toISOString(),
    },
    board: challenge.board,
    rules: {
      boardSize: NUMBER_CLICK_RULES.boardSize,
      maxNumber: NUMBER_CLICK_RULES.maxNumber,
      penaltyPerMistakeMs: NUMBER_CLICK_RULES.penaltyPerMistakeMs,
    },
    idempotentReplay,
  };
}

export async function createGameSession(
  database: Database,
  input: { userId: string; idempotencyKey: string; now?: Date },
): Promise<SessionCreateResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await database.$transaction(async (transaction) => {
        const replay = await transaction.gameSession.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: {
            id: true,
            status: true,
            rulesVersion: true,
            readyExpiresAt: true,
            challengeData: true,
          },
        });
        if (replay) {
          return toCreateResult(replay, true);
        }

        const game = await transaction.game.findUnique({ where: { slug: NUMBER_CLICK_SLUG } });
        if (
          !game ||
          game.status !== "ACTIVE" ||
          game.scoreDirection !== "ASC" ||
          game.scoreUnit !== "MILLISECONDS" ||
          game.currentRulesVersion !== NUMBER_CLICK_RULES.version
        ) {
          throw new ApiError(404, "GAME_NOT_AVAILABLE");
        }

        const now = await databaseNow(transaction, input.now);
        await transaction.$queryRaw(
          Prisma.sql`SELECT id FROM "game_session" WHERE "user_id" = ${input.userId} AND "game_id" = ${game.id} AND "status" IN ('READY', 'PLAYING') FOR UPDATE`,
        );
        await transaction.gameSession.updateMany({
          where: {
            userId: input.userId,
            gameId: game.id,
            status: "READY",
            readyExpiresAt: { lte: now },
          },
          data: { status: "EXPIRED", terminalReason: "READY_EXPIRED" },
        });
        await transaction.gameSession.updateMany({
          where: {
            userId: input.userId,
            gameId: game.id,
            status: "PLAYING",
            expiresAt: { lte: now },
          },
          data: { status: "EXPIRED", terminalReason: "PLAYING_EXPIRED" },
        });
        await transaction.gameSession.updateMany({
          where: {
            userId: input.userId,
            gameId: game.id,
            status: { in: ["READY", "PLAYING"] },
          },
          data: { status: "ABANDONED", terminalReason: "REPLACED_BY_NEW_SESSION" },
        });

        const board = createOfficialBoard();
        const session = await transaction.gameSession.create({
          data: {
            userId: input.userId,
            gameId: game.id,
            idempotencyKey: input.idempotencyKey,
            rulesVersion: game.currentRulesVersion,
            rulesSnapshot: NUMBER_CLICK_RULES_SNAPSHOT,
            challengeData: { schemaVersion: 1, board },
            readyExpiresAt: new Date(now.getTime() + NUMBER_CLICK_RULES.readyLifetimeMs),
          },
          select: {
            id: true,
            status: true,
            rulesVersion: true,
            readyExpiresAt: true,
            challengeData: true,
          },
        });

        return toCreateResult(session, false);
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const replay = await database.gameSession.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        select: {
          id: true,
          status: true,
          rulesVersion: true,
          readyExpiresAt: true,
          challengeData: true,
        },
      });
      if (replay) {
        return toCreateResult(replay, true);
      }
    }
  }

  throw new ApiError(409, "SESSION_CREATE_CONFLICT");
}

type StartSuccess = {
  ok: true;
  session: {
    id: string;
    status: "PLAYING";
    startedAt: string;
    expiresAt: string;
  };
  idempotentReplay: boolean;
};

type StartFailure = { ok: false; error: ApiError };

export async function startGameSession(
  database: Database,
  input: { userId: string; sessionId: string; now?: Date },
): Promise<StartSuccess | StartFailure> {
  return database.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "game_session" WHERE id = ${input.sessionId}::uuid AND "user_id" = ${input.userId} FOR UPDATE`,
    );
    if (locked.length === 0) {
      return { ok: false, error: new ApiError(404, "NOT_FOUND") };
    }

    const session = await transaction.gameSession.findUnique({ where: { id: input.sessionId } });
    if (!session) {
      return { ok: false, error: new ApiError(404, "NOT_FOUND") };
    }
    if (session.status === "PLAYING" && session.startedAt && session.expiresAt) {
      return {
        ok: true,
        session: {
          id: session.id,
          status: "PLAYING",
          startedAt: session.startedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        },
        idempotentReplay: true,
      };
    }
    if (session.status === "COMPLETED") {
      return { ok: false, error: new ApiError(409, "SESSION_ALREADY_COMPLETED") };
    }
    if (session.status !== "READY") {
      return { ok: false, error: new ApiError(409, "SESSION_NOT_STARTABLE") };
    }

    const now = await databaseNow(transaction, input.now);
    if (now >= session.readyExpiresAt) {
      await transaction.gameSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED", terminalReason: "READY_EXPIRED" },
      });
      return { ok: false, error: new ApiError(410, "SESSION_EXPIRED") };
    }

    const expiresAt = new Date(now.getTime() + NUMBER_CLICK_RULES.playingLifetimeMs);
    const started = await transaction.gameSession.update({
      where: { id: session.id },
      data: { status: "PLAYING", startedAt: now, expiresAt },
    });
    return {
      ok: true,
      session: {
        id: started.id,
        status: "PLAYING",
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      idempotentReplay: false,
    };
  });
}

export async function abandonGameSession(
  database: Database,
  input: { userId: string; sessionId: string },
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "game_session" WHERE id = ${input.sessionId}::uuid AND "user_id" = ${input.userId} FOR UPDATE`,
    );
    if (locked.length === 0) {
      throw new ApiError(404, "NOT_FOUND");
    }

    await transaction.gameSession.updateMany({
      where: { id: input.sessionId, status: { in: ["READY", "PLAYING"] } },
      data: { status: "ABANDONED", terminalReason: "USER_ABANDONED" },
    });
  });
}
