import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { readConfirmedPointBalance, spendTitlePoints } from "@/features/points/server";
import { ApiError } from "@/lib/http/api-error";
import { TITLE_PRICE, type TitleKey } from "../catalog";
import { titleKeySchema, titleShopSchema, type TitleShopData } from "../schemas/shop";
import { TitleRoleUnavailable, type TitleRoleGateway } from "./discord-roles";

type Tx = Prisma.TransactionClient;
async function activeIdentity(tx: Tx, userId: string) {
  const [user] = await tx.$queryRaw<
    { status: string }[]
  >`SELECT status FROM "user" WHERE id = ${userId} FOR SHARE`;
  if (!user) throw new ApiError(401, "AUTH_SESSION_EXPIRED");
  if (user.status !== "ACTIVE") throw new ApiError(403, "USER_BANNED");
  const account = await tx.account.findFirst({
    where: { userId, providerId: "discord", issuer: "local:oauth:discord" },
    select: { accountId: true },
  });
  if (!account || !/^[0-9]{17,20}$/.test(account.accountId))
    throw new ApiError(403, "TITLE_MEMBER_REQUIRED");
  return account.accountId;
}
async function identity(database: PrismaClient, userId: string) {
  return database.$transaction((tx) => activeIdentity(tx, userId));
}
async function lockEquipment(tx: Tx, userId: string) {
  await tx.$executeRaw`INSERT INTO title_equipment (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
  const locked = await tx.$queryRaw<
    { user_id: string }[]
  >`SELECT user_id FROM title_equipment WHERE user_id = ${userId} FOR UPDATE SKIP LOCKED`;
  if (!locked.length) throw new ApiError(409, "TITLE_SYNC_PENDING");
  return tx.titleEquipment.findUniqueOrThrow({ where: { userId } });
}
function requireGateway(gateway: TitleRoleGateway | null): TitleRoleGateway {
  if (!gateway) throw new ApiError(503, "TITLE_SHOP_UNAVAILABLE");
  return gateway;
}
function verifyConfiguration(stored: string | null, gateway: TitleRoleGateway) {
  if (stored !== null && stored !== gateway.configurationKey)
    throw new ApiError(503, "TITLE_SHOP_UNAVAILABLE");
}
async function preflight(gateway: TitleRoleGateway, discordId: string) {
  try {
    await gateway.preflight(discordId);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "TITLE_SHOP_UNAVAILABLE");
  }
}

export async function getTitleShop(
  database: PrismaClient,
  userId: string,
  gateway: TitleRoleGateway | null,
): Promise<TitleShopData> {
  return database.$transaction(
    async (tx) => {
      const balance = await readConfirmedPointBalance(tx, userId);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { status: true },
      });
      const purchases = await tx.titlePurchase.findMany({
        where: { userId },
        select: { titleKey: true },
      });
      const equipment = await tx.titleEquipment.findUnique({ where: { userId } });
      return titleShopSchema.parse({
        balance,
        enabled: Boolean(
          gateway &&
          (!equipment?.configurationKey || equipment.configurationKey === gateway.configurationKey),
        ),
        canModify: user.status === "ACTIVE",
        owned: purchases.map((p) => p.titleKey),
        equipment: {
          desired: equipment?.desiredTitleKey ?? null,
          applied: equipment?.appliedTitleKey ?? null,
          pending: equipment?.pending ?? false,
          revision: equipment?.revision ?? 0,
          retryAt: equipment?.retryAt?.toISOString() ?? null,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function purchaseTitle(
  database: PrismaClient,
  userId: string,
  input: { titleKey: TitleKey; requestId: string },
  gatewayInput: TitleRoleGateway | null,
) {
  const discordId = await identity(database, userId);
  // A lost purchase response remains recoverable even if Discord is now offline.
  const previous = await database.titlePurchase.findUnique({
    where: { userId_requestId: { userId, requestId: input.requestId } },
  });
  if (previous) {
    if (previous.titleKey !== input.titleKey) throw new ApiError(409, "TITLE_REQUEST_CONFLICT");
    return;
  }
  const gateway = requireGateway(gatewayInput);
  await preflight(gateway, discordId);
  await database.$transaction(async (tx) => {
    if ((await activeIdentity(tx, userId)) !== discordId)
      throw new ApiError(403, "TITLE_MEMBER_REQUIRED");
    const equipment = await lockEquipment(tx, userId);
    const replay = await tx.titlePurchase.findUnique({
      where: { userId_requestId: { userId, requestId: input.requestId } },
    });
    if (replay) {
      if (replay.titleKey !== input.titleKey) throw new ApiError(409, "TITLE_REQUEST_CONFLICT");
      return;
    }
    if (
      await tx.titlePurchase.findUnique({
        where: { userId_titleKey: { userId, titleKey: input.titleKey } },
      })
    )
      throw new ApiError(409, "TITLE_ALREADY_OWNED");
    verifyConfiguration(equipment.configurationKey, gateway);
    if (equipment.pending) throw new ApiError(409, "TITLE_SYNC_PENDING");
    const purchase = await tx.titlePurchase.create({
      data: { userId, titleKey: input.titleKey, requestId: input.requestId, price: TITLE_PRICE },
    });
    await spendTitlePoints(tx, { userId, purchaseId: purchase.id, price: TITLE_PRICE });
    await tx.titleEquipment.update({
      where: { userId },
      data: {
        desiredTitleKey: input.titleKey,
        pending: true,
        retryAt: null,
        revision: { increment: 1 },
        configurationKey: gateway.configurationKey,
      },
    });
  });
}

export async function equipTitle(
  database: PrismaClient,
  userId: string,
  input: { titleKey: TitleKey | null; expectedRevision: number },
  gatewayInput: TitleRoleGateway | null,
) {
  const discordId = await identity(database, userId);
  const gateway = requireGateway(gatewayInput);
  await preflight(gateway, discordId);
  await database.$transaction(async (tx) => {
    if ((await activeIdentity(tx, userId)) !== discordId)
      throw new ApiError(403, "TITLE_MEMBER_REQUIRED");
    const equipment = await lockEquipment(tx, userId);
    verifyConfiguration(equipment.configurationKey, gateway);
    // Only the immediate replay of the same intent is accepted. Older tabs cannot undo a later selection.
    if (
      equipment.revision === input.expectedRevision + 1 &&
      equipment.desiredTitleKey === input.titleKey
    )
      return;
    if (equipment.revision !== input.expectedRevision)
      throw new ApiError(409, "TITLE_REQUEST_CONFLICT");
    if (equipment.pending) throw new ApiError(409, "TITLE_SYNC_PENDING");
    if (
      input.titleKey &&
      !(await tx.titlePurchase.findUnique({
        where: { userId_titleKey: { userId, titleKey: input.titleKey } },
      }))
    )
      throw new ApiError(404, "NOT_FOUND");
    await tx.titleEquipment.update({
      where: { userId },
      data: {
        desiredTitleKey: input.titleKey,
        pending: true,
        retryAt: null,
        revision: { increment: 1 },
        configurationKey: gateway.configurationKey,
      },
    });
  });
}

export async function syncTitleRoles(
  database: PrismaClient,
  userId: string,
  gatewayInput: TitleRoleGateway | null,
) {
  const gateway = requireGateway(gatewayInput);
  await database.$transaction(
    async (tx) => {
      const discordId = await activeIdentity(tx, userId);
      const locked = await tx.$queryRaw<
        { user_id: string }[]
      >`SELECT user_id FROM title_equipment WHERE user_id = ${userId} FOR UPDATE SKIP LOCKED`;
      if (!locked.length) return;
      const equipment = await tx.titleEquipment.findUniqueOrThrow({ where: { userId } });
      verifyConfiguration(equipment.configurationKey, gateway);
      if (!equipment.pending || (equipment.retryAt && equipment.retryAt.getTime() > Date.now()))
        return;
      try {
        await gateway.apply(
          discordId,
          equipment.desiredTitleKey === null
            ? null
            : titleKeySchema.parse(equipment.desiredTitleKey),
        );
      } catch (error) {
        if (!(error instanceof TitleRoleUnavailable) && !(error instanceof ApiError)) throw error;
        await tx.titleEquipment.update({
          where: { userId },
          data: {
            retryAt:
              error instanceof TitleRoleUnavailable ? error.retryAt : new Date(Date.now() + 30_000),
          },
        });
        return;
      }
      await tx.titleEquipment.update({
        where: { userId },
        data: { appliedTitleKey: equipment.desiredTitleKey, pending: false, retryAt: null },
      });
    },
    { timeout: 50_000, maxWait: 5_000 },
  );
}
