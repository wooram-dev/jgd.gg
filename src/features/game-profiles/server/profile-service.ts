import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { isTargetGuildMember } from "@/lib/auth/guild-membership";
import { ApiError } from "@/lib/http/api-error";
import {
  gameProfileSchema,
  PROFILE_GAMES,
  type GameProfileCardData,
  type ProfileGame,
  type SaveGameProfile,
} from "../schemas/profile";

const profileSelect = {
  id: true,
  userId: true,
  updatedAt: true,
  games: { select: { game: true, nickname: true, tier: true } },
  user: { select: { discordDisplayName: true, image: true } },
} as const;

function toCard(
  row: Prisma.GameProfileGetPayload<{ select: typeof profileSelect }>,
  viewerId: string,
): GameProfileCardData {
  return gameProfileSchema.parse({
    id: row.id,
    displayName: row.user.discordDisplayName,
    avatarUrl: row.user.image,
    isViewer: row.userId === viewerId,
    source: "SELF_REPORTED",
    updatedAt: row.updatedAt.toISOString(),
    games: PROFILE_GAMES.flatMap((game) => row.games.filter((entry) => entry.game === game.id)),
  });
}

export async function requireProfileMember(database: PrismaClient, userId: string): Promise<void> {
  const account = await database.account.findFirst({
    where: { userId, providerId: "discord", issuer: "local:oauth:discord" },
    select: { accountId: true },
  });
  if (!account || !(await isTargetGuildMember(account.accountId)))
    throw new ApiError(403, "GUILD_MEMBER_REQUIRED");
}

export async function getMyGameProfile(database: PrismaClient, userId: string) {
  const row = await database.gameProfile.findUnique({ where: { userId }, select: profileSelect });
  return { profile: row ? toCard(row, userId) : null };
}

export async function saveGameProfile(
  database: PrismaClient,
  userId: string,
  input: SaveGameProfile,
) {
  return database.$transaction(async (tx) => {
    // Serialize whole-card replacements and deletion; two tabs cannot mix their game entries.
    await lockActiveUser(tx, userId);
    const profile = await tx.gameProfile.upsert({
      where: { userId },
      create: { userId },
      update: { updatedAt: new Date() },
      select: { id: true },
    });
    await tx.gameProfileEntry.deleteMany({ where: { profileId: profile.id } });
    await tx.gameProfileEntry.createMany({
      data: input.games.map((entry) => ({ ...entry, profileId: profile.id })),
    });
    const row = await tx.gameProfile.findUniqueOrThrow({
      where: { id: profile.id },
      select: profileSelect,
    });
    return { profile: toCard(row, userId) };
  });
}

export async function deleteGameProfile(database: PrismaClient, userId: string) {
  await database.$transaction(async (tx) => {
    await lockActiveUser(tx, userId);
    await tx.gameProfile.deleteMany({ where: { userId } });
  });
  return { profile: null };
}

async function lockActiveUser(tx: Prisma.TransactionClient, userId: string) {
  const [user] = await tx.$queryRaw<
    Array<{ status: string }>
  >`SELECT status FROM "user" WHERE id = ${userId} FOR UPDATE`;
  if (!user) throw new ApiError(401, "AUTH_SESSION_EXPIRED");
  if (user.status !== "ACTIVE") throw new ApiError(403, "USER_BANNED");
}

export async function listGameProfiles(
  database: PrismaClient,
  viewerId: string,
  query: { cursor?: string; game?: ProfileGame },
) {
  const anchor = query.cursor
    ? await database.gameProfile.findUnique({
        where: { id: query.cursor },
        select: { id: true, createdAt: true },
      })
    : null;
  if (query.cursor && !anchor) throw new ApiError(400, "VALIDATION_ERROR");
  const rows = await database.gameProfile.findMany({
    where: {
      user: { status: "ACTIVE" },
      games: { some: query.game ? { game: query.game } : {} },
      ...(anchor
        ? {
            OR: [
              { createdAt: { lt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { lt: anchor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 13,
    select: {
      ...profileSelect,
      user: {
        select: {
          ...profileSelect.user.select,
          accounts: {
            where: { providerId: "discord", issuer: "local:oauth:discord" },
            select: { accountId: true },
          },
        },
      },
    },
  });
  const page = rows.slice(0, 12);
  const items: GameProfileCardData[] = [];
  // Bound requests to Discord and exclude former members, pending members and guests.
  for (let start = 0; start < page.length; start += 3) {
    const batch = page.slice(start, start + 3);
    const memberships = await Promise.all(
      batch.map(async (row) => {
        const account = row.user.accounts[0];
        return account ? isTargetGuildMember(account.accountId) : false;
      }),
    );
    batch.forEach((row, index) => {
      if (memberships[index]) items.push(toCard(row, viewerId));
    });
  }
  return { items, nextCursor: rows.length > 12 ? page[page.length - 1].id : null };
}
