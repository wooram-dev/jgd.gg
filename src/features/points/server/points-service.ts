import { z } from "zod";

import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http/api-error";

import {
  POINTS_DAILY_EARN_LIMIT,
  POINTS_POLICY_VERSION,
  decideOfficialCompletionAward,
  getPointEarningDay,
  type PointAwardDecision,
} from "../domain/policy";

type PointTransactionClient = Prisma.TransactionClient;

const storedPointDecisionSchema = z.object({
  status: z.enum(["AWARDED", "DAILY_LIMIT_REACHED", "NOT_ELIGIBLE"]),
  amount: z.number().int().nonnegative(),
  policyVersion: z.literal(POINTS_POLICY_VERSION),
});

export class PointLedgerIntegrityError extends Error {
  constructor() {
    super("Point account balance does not match its ledger.");
    this.name = "PointLedgerIntegrityError";
  }
}

export async function readConfirmedPointBalance(
  transaction: PointTransactionClient,
  userId: string,
): Promise<number> {
  const account = await transaction.pointAccount.findUnique({ where: { userId } });
  const ledger = await transaction.pointTransaction.aggregate({
    where: { accountUserId: userId },
    _sum: { amount: true },
  });
  if (!account || account.balance !== (ledger._sum.amount ?? 0)) {
    throw new PointLedgerIntegrityError();
  }
  return account.balance;
}

export async function getConfirmedPointBalance(
  database: PrismaClient,
  userId: string,
): Promise<number> {
  return database.$transaction((transaction) => readConfirmedPointBalance(transaction, userId), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

async function lockAndVerifyAccount(transaction: PointTransactionClient, userId: string) {
  const locked = await transaction.$queryRaw<{ user_id: string }[]>(
    Prisma.sql`SELECT "user_id" FROM "point_account" WHERE "user_id" = ${userId} FOR UPDATE`,
  );
  if (locked.length === 0) {
    throw new PointLedgerIntegrityError();
  }

  return { balance: await readConfirmedPointBalance(transaction, userId) };
}

export async function spendTitlePoints(
  transaction: PointTransactionClient,
  input: { userId: string; purchaseId: string; price: number },
): Promise<void> {
  const account = await lockAndVerifyAccount(transaction, input.userId);
  if (account.balance < input.price) throw new ApiError(409, "TITLE_BALANCE_INSUFFICIENT");
  const balanceAfter = account.balance - input.price;
  await transaction.pointAccount.update({
    where: { userId: input.userId },
    data: { balance: balanceAfter },
  });
  await transaction.pointTransaction.create({
    data: {
      accountUserId: input.userId,
      type: "SPEND",
      reason: "TITLE_PURCHASE",
      amount: -input.price,
      balanceAfter,
      titlePurchaseId: input.purchaseId,
      policyVersion: "title-shop-v1",
      idempotencyKey: `title-purchase:${input.purchaseId}`,
    },
  });
}

export async function awardOfficialCompletionPoints(
  transaction: PointTransactionClient,
  input: { userId: string; gameRecordId: string; achievedAt: Date; now: Date },
): Promise<PointAwardDecision> {
  const account = await lockAndVerifyAccount(transaction, input.userId);
  const existing = await transaction.pointTransaction.findFirst({
    where: { type: "EARN", gameRecordId: input.gameRecordId },
  });
  if (existing) {
    return {
      status: "AWARDED",
      amount: existing.amount,
      policyVersion: POINTS_POLICY_VERSION,
    };
  }

  const day = getPointEarningDay(input.achievedAt);
  const daily = await transaction.pointTransaction.aggregate({
    where: {
      accountUserId: input.userId,
      type: "EARN",
      reason: "NUMBER_CLICK_COMPLETION",
      gameRecord: { achievedAt: { gte: day.startsAt, lt: day.endsAt } },
    },
    _sum: { amount: true },
  });
  const decision = decideOfficialCompletionAward({
    achievedAt: input.achievedAt,
    dailyEarned: daily._sum.amount ?? 0,
  });
  if (decision.amount === 0) return decision;

  const balanceAfter = account.balance + decision.amount;
  await transaction.pointAccount.update({
    where: { userId: input.userId },
    data: { balance: balanceAfter, updatedAt: input.now },
  });
  await transaction.pointTransaction.create({
    data: {
      accountUserId: input.userId,
      type: "EARN",
      reason: "NUMBER_CLICK_COMPLETION",
      amount: decision.amount,
      balanceAfter,
      gameRecordId: input.gameRecordId,
      policyVersion: decision.policyVersion,
      idempotencyKey: `game-record:${input.gameRecordId}:earn`,
      createdAt: input.now,
    },
  });
  return decision;
}

export async function getPointOverview(database: PrismaClient, input: { userId: string }) {
  return database.$transaction(
    async (transaction) => {
      const balance = await readConfirmedPointBalance(transaction, input.userId);
      const transactions = await transaction.pointTransaction.findMany({
        where: { accountUserId: input.userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          type: true,
          reason: true,
          amount: true,
          balanceAfter: true,
          policyVersion: true,
          createdAt: true,
        },
      });

      return {
        balance,
        unit: "P" as const,
        transactions: transactions.map((pointTransaction) => ({
          ...pointTransaction,
          createdAt: pointTransaction.createdAt.toISOString(),
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function getCompletionPointSummary(
  database: PrismaClient,
  input: { userId: string; gameRecordId: string },
) {
  const [balance, record, reversal] = await Promise.all([
    getConfirmedPointBalance(database, input.userId),
    database.gameRecord.findFirst({
      where: { id: input.gameRecordId, userId: input.userId },
      select: { resultData: true },
    }),
    database.pointTransaction.findFirst({
      where: { gameRecordId: input.gameRecordId, accountUserId: input.userId, type: "REVERSAL" },
      select: { id: true },
    }),
  ]);
  if (!record) throw new PointLedgerIntegrityError();

  const resultData = z
    .object({ pointAward: storedPointDecisionSchema.optional() })
    .passthrough()
    .safeParse(record.resultData);
  const decision = resultData.success ? resultData.data.pointAward : undefined;

  return {
    status: reversal ? ("REVERSED" as const) : (decision?.status ?? ("NOT_ELIGIBLE" as const)),
    awarded: reversal ? 0 : (decision?.amount ?? 0),
    balance,
    dailyLimit: POINTS_DAILY_EARN_LIMIT,
    policyVersion: decision?.policyVersion ?? POINTS_POLICY_VERSION,
  };
}

async function reverseGameRecordPoints(
  transaction: PointTransactionClient,
  input: { userId: string; gameRecordId: string; now: Date },
): Promise<void> {
  const account = await lockAndVerifyAccount(transaction, input.userId);
  const earned = await transaction.pointTransaction.findFirst({
    where: { type: "EARN", gameRecordId: input.gameRecordId },
  });
  if (!earned) return;

  const existing = await transaction.pointTransaction.findFirst({
    where: { type: "REVERSAL", gameRecordId: input.gameRecordId },
  });
  if (existing) return;

  const balanceAfter = account.balance - earned.amount;
  if (balanceAfter < 0) throw new PointLedgerIntegrityError();
  await transaction.pointAccount.update({
    where: { userId: input.userId },
    data: { balance: balanceAfter, updatedAt: input.now },
  });
  await transaction.pointTransaction.create({
    data: {
      accountUserId: input.userId,
      type: "REVERSAL",
      reason: "GAME_RECORD_INVALIDATION",
      amount: -earned.amount,
      balanceAfter,
      gameRecordId: input.gameRecordId,
      relatedTransactionId: earned.id,
      policyVersion: earned.policyVersion,
      idempotencyKey: `game-record:${input.gameRecordId}:reversal`,
      createdAt: input.now,
    },
  });
}

export async function invalidateGameRecord(
  database: PrismaClient,
  input: { gameRecordId: string; reason: string; now?: Date },
): Promise<{ idempotentReplay: boolean }> {
  return database.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<
      { id: string; user_id: string; rank_eligible: boolean }[]
    >(
      Prisma.sql`SELECT id, "user_id", "rank_eligible" FROM "game_record" WHERE id = ${input.gameRecordId}::uuid FOR UPDATE`,
    );
    const record = locked[0];
    if (!record) throw new ApiError(404, "NOT_FOUND");
    if (!record.rank_eligible) {
      return { idempotentReplay: true };
    }

    const now =
      input.now ??
      (await transaction.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT clock_timestamp() AS now`))[0]
        ?.now;
    if (!now) throw new Error("Database clock did not return a value.");

    await transaction.gameRecord.update({
      where: { id: record.id },
      data: {
        rankEligible: false,
        invalidatedAt: now,
        invalidatedReason: input.reason.slice(0, 255),
      },
    });
    await reverseGameRecordPoints(transaction, {
      userId: record.user_id,
      gameRecordId: record.id,
      now,
    });
    return { idempotentReplay: false };
  });
}
