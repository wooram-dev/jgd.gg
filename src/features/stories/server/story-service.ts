import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http/api-error";
import {
  STORY_LIFETIME_MS,
  STORY_UPLOAD_LIMIT,
  type StoryItem,
  type StoryGroup,
} from "../schemas/story";
import { prepareStoryImage } from "./image";

const itemSelect = {
  id: true,
  userId: true,
  createdAt: true,
  expiresAt: true,
  user: { select: { discordDisplayName: true, image: true } },
} as const;

function toItem(
  row: {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
    user: { discordDisplayName: string; image: string | null };
  },
  viewerId: string | null,
): StoryItem {
  return {
    id: row.id,
    displayName: row.user.discordDisplayName,
    avatarUrl: row.user.image,
    isViewer: row.userId === viewerId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function listStories(
  database: PrismaClient,
  viewerId: string | null,
  cursor?: string,
  now?: Date,
) {
  const [clock] = await database.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  const time = now ?? clock.now;
  const anchor = cursor
    ? await database.story.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      })
    : null;
  if (cursor && !anchor) throw new ApiError(400, "VALIDATION_ERROR");
  const pageFilter = anchor
    ? Prisma.sql`WHERE (created_at, id) < (${anchor.createdAt}, ${anchor.id}::uuid)`
    : Prisma.empty;
  // Page authors first, then include every active photo for those authors in one snapshot.
  // Never group by display names/avatars, which different accounts may share.
  const rows = await database.$queryRaw<
    Array<Prisma.StoryGetPayload<{ select: typeof itemSelect }> & { groupId: string }>
  >(Prisma.sql`
    WITH latest AS (
      SELECT DISTINCT ON (s.user_id) s.id, s.user_id, s.created_at
      FROM story s JOIN "user" u ON u.id = s.user_id
      WHERE s.expires_at > ${time} AND s.created_at <= ${time} AND u.status = 'ACTIVE'
      ORDER BY s.user_id, s.created_at DESC, s.id DESC
    ), page AS (
      SELECT * FROM latest ${pageFilter}
      ORDER BY created_at DESC, id DESC LIMIT 31
    )
    SELECT p.id AS "groupId", s.id, s.user_id AS "userId",
      s.created_at AS "createdAt", s.expires_at AS "expiresAt",
      json_build_object('discordDisplayName', u.discord_display_name, 'image', u.image) AS "user"
    FROM page p JOIN story s ON s.user_id = p.user_id JOIN "user" u ON u.id = p.user_id
    WHERE s.expires_at > ${time} AND s.created_at <= ${time}
    ORDER BY p.created_at DESC, p.id DESC, s.created_at ASC, s.id ASC
  `);
  const groups = new Map<string, StoryGroup>();
  for (const row of rows) {
    const item = toItem(row, viewerId);
    const stories = groups.get(row.groupId)?.stories ?? [];
    stories.push(item);
    groups.set(row.groupId, { ...item, stories });
  }
  const items = [...groups.values()].slice(0, 30);
  return {
    items,
    serverNow: time.toISOString(),
    nextCursor: groups.size > 30 ? items[items.length - 1].id : null,
  };
}

export async function createStory(
  database: PrismaClient,
  input: { userId: string; uploadKey: string; original: Buffer; type: string },
) {
  const prepared = await prepareStoryImage(input.original, input.type);
  return database.$transaction(async (tx) => {
    // Serialize uploads per author, including the rolling limit and retries.
    const [user] = await tx.$queryRaw<
      Array<{ status: string }>
    >`SELECT status FROM "user" WHERE id = ${input.userId} FOR UPDATE`;
    if (!user) throw new ApiError(401, "AUTH_SESSION_EXPIRED");
    if (user.status !== "ACTIVE") throw new ApiError(403, "USER_BANNED");
    const previous = await tx.story.findUnique({
      where: { userId_uploadKey: { userId: input.userId, uploadKey: input.uploadKey } },
      select: itemSelect,
    });
    if (previous) return { story: toItem(previous, input.userId), replay: true };
    const [clock] = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
    const count = await tx.story.count({
      where: {
        userId: input.userId,
        createdAt: { gt: new Date(clock.now.getTime() - STORY_LIFETIME_MS) },
      },
    });
    if (count >= STORY_UPLOAD_LIMIT) throw new ApiError(429, "STORY_UPLOAD_LIMIT");
    const row = await tx.story.create({
      data: {
        ...prepared,
        userId: input.userId,
        uploadKey: input.uploadKey,
        createdAt: clock.now,
        expiresAt: new Date(clock.now.getTime() + STORY_LIFETIME_MS),
      },
      select: itemSelect,
    });
    return { story: toItem(row, input.userId), replay: false };
  });
}

export async function readStoryImage(
  database: PrismaClient,
  id: string,
  size: "image" | "thumbnail",
  now?: Date,
) {
  // Expiration and author status are checked in the same query as the bytes.
  const rows =
    size === "thumbnail"
      ? await database.$queryRaw<
          Array<{ bytes: Uint8Array }>
        >`SELECT s.thumbnail AS bytes FROM story s JOIN "user" u ON u.id = s.user_id WHERE s.id = ${id}::uuid AND s.expires_at > COALESCE(${now ?? null}::timestamptz, clock_timestamp()) AND u.status = 'ACTIVE'`
      : await database.$queryRaw<
          Array<{ bytes: Uint8Array }>
        >`SELECT s.image AS bytes FROM story s JOIN "user" u ON u.id = s.user_id WHERE s.id = ${id}::uuid AND s.expires_at > COALESCE(${now ?? null}::timestamptz, clock_timestamp()) AND u.status = 'ACTIVE'`;
  if (!rows[0]) throw new ApiError(404, "NOT_FOUND");
  return rows[0].bytes;
}
