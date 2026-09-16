import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { saveGameProfile } from "@/features/game-profiles/server/profile-service";
import {
  gameProfileListResponseSchema,
  myGameProfileResponseSchema,
} from "@/features/game-profiles/schemas/profile";
import { ApiError } from "@/lib/http/api-error";
import { cleanApplicationData, createTestDatabase, createTestUser } from "../../helpers/database";

const database = createTestDatabase();
const auth = vi.hoisted(() => ({ userId: null as string | null }));
const membership = vi.hoisted(() => vi.fn<(id: string) => Promise<boolean>>());
vi.mock("@/lib/db/client", () => ({ getDatabase: () => database }));
vi.mock("@/lib/auth/server", () => ({
  getOptionalSession: async () => (auth.userId ? { user: { id: auth.userId } } : null),
}));
vi.mock("@/lib/auth/guild-membership", () => ({ isTargetGuildMember: membership }));
const { GET, PUT, DELETE } = await import("@/app/api/v1/me/game-profile/route");
const { GET: listGET } = await import("@/app/api/v1/game-profiles/route");
const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
const sample = { games: [{ game: "lol" as const, nickname: "Player#KR1", tier: "골드 IV" }] };
let userId: string;
let otherId: string;

function request(
  method = "GET",
  body: unknown = undefined,
  path = "/api/v1/me/game-profile",
  headers: Record<string, string> = {},
) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Request-Id": "profile-test",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function createMember(id: string, discordId: string) {
  await createTestUser(database, id, { displayName: "같은 이름" });
  await database.account.create({
    data: {
      userId: id,
      providerId: "discord",
      issuer: "local:oauth:discord",
      accountId: discordId,
    },
  });
}
beforeEach(async () => {
  await cleanApplicationData(database);
  userId = randomUUID();
  otherId = randomUUID();
  await createMember(userId, "175928847299117063");
  await createMember(otherId, "175928847299117064");
  auth.userId = userId;
  membership.mockReset().mockResolvedValue(true);
});
afterAll(async () => {
  await database.$disconnect();
});

describe("member-only game profiles", () => {
  it("creates, reads, replaces and deletes only the authenticated user's card", async () => {
    expect((await GET(request())).status).toBe(200);
    expect(
      myGameProfileResponseSchema.parse(await (await GET(request())).json()).data.profile,
    ).toBeNull();
    const response = await PUT(request("PUT", sample));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const saved = myGameProfileResponseSchema.parse(await response.json());
    expect(saved.meta.requestId).toBe("profile-test");
    expect(saved.data.profile).toMatchObject({
      games: sample.games,
      source: "SELF_REPORTED",
      isViewer: true,
    });
    expect(JSON.stringify(saved)).not.toContain(userId);
    expect(JSON.stringify(saved)).not.toContain("175928847299117063");
    expect(membership).toHaveBeenCalledWith("175928847299117063");
    await saveGameProfile(database, otherId, sample);
    const replacement = { games: [{ game: "pubg", nickname: " NewName ", tier: null }] };
    const updated = myGameProfileResponseSchema.parse(
      await (await PUT(request("PUT", replacement))).json(),
    );
    expect(updated.data.profile?.id).toBe(saved.data.profile?.id);
    expect(updated.data.profile?.games).toEqual([
      { game: "pubg", nickname: "NewName", tier: null },
    ]);
    expect(await database.gameProfileEntry.count()).toBe(2);
    expect((await DELETE(request("DELETE", {}))).status).toBe(200);
    expect((await DELETE(request("DELETE", {}))).status).toBe(200);
    expect(await database.gameProfile.findUnique({ where: { userId } })).toBeNull();
    expect(await database.gameProfile.count()).toBe(1);
    expect(await database.gameProfileEntry.count()).toBe(1);
  });
  it("denies guests, expired users, banned users and nonmembers on every endpoint", async () => {
    const operations = [
      () => GET(request()),
      () => PUT(request("PUT", sample)),
      () => DELETE(request("DELETE", {})),
      () => listGET(request("GET", undefined, "/api/v1/game-profiles")),
    ];
    for (const state of ["guest", "expired", "banned", "nonmember"] as const) {
      auth.userId = state === "guest" ? null : state === "expired" ? randomUUID() : userId;
      await database.user.update({
        where: { id: userId },
        data: { status: state === "banned" ? "BANNED" : "ACTIVE" },
      });
      membership.mockResolvedValue(state !== "nonmember");
      for (const operation of operations) {
        const response = await operation();
        expect(response.status).toBe(state === "guest" || state === "expired" ? 401 : 403);
        expect(response.headers.get("Cache-Control")).toContain("no-store");
        expect((await response.json()).data).toBeUndefined();
      }
    }
    expect(await database.gameProfile.count()).toBe(0);
  });
  it("denies missing canonical Discord accounts and fails closed on unavailable membership", async () => {
    await database.account.deleteMany({ where: { userId } });
    expect((await GET(request())).status).toBe(403);
    expect(membership).not.toHaveBeenCalled();
    auth.userId = otherId;
    membership.mockRejectedValue(new ApiError(503, "GUILD_MEMBERSHIP_UNAVAILABLE"));
    expect((await PUT(request("PUT", sample))).status).toBe(503);
    expect((await listGET(request("GET", undefined, "/api/v1/game-profiles"))).status).toBe(503);
    expect(await database.gameProfile.count()).toBe(0);
  });
  it("validates ownership fields, Origin, strict queries and bounded JSON on mutations", async () => {
    for (const operation of [PUT, DELETE]) {
      expect(
        (
          await operation(
            request(operation === PUT ? "PUT" : "DELETE", {}, undefined, {
              Origin: "https://foreign.test",
            }),
          )
        ).status,
      ).toBe(403);
      expect(
        (await operation(request(operation === PUT ? "PUT" : "DELETE", { userId: otherId })))
          .status,
      ).toBe(400);
    }
    expect((await PUT(request("PUT", { ...sample, userId: otherId }))).status).toBe(400);
    expect((await PUT(request("PUT", { games: [sample.games[0], sample.games[0]] }))).status).toBe(
      400,
    );
    expect(
      (await PUT(request("PUT", { games: [{ ...sample.games[0], nickname: " " }] }))).status,
    ).toBe(400);
    expect(
      (await PUT(request("PUT", sample, undefined, { "Content-Type": "text/plain" }))).status,
    ).toBe(415);
    expect((await PUT(request("PUT", { padding: "x".repeat(4096) }))).status).toBe(413);
    expect(
      (
        await PUT(
          new Request(`${origin}/api/v1/me/game-profile`, {
            method: "PUT",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await GET(request("GET", undefined, `/api/v1/me/game-profile?userId=${otherId}`))).status,
    ).toBe(400);
    for (const query of [
      "userId=x",
      "game=steam",
      "game=lol&game=pubg",
      "cursor=not-a-uuid",
      `cursor=${randomUUID()}`,
    ]) {
      expect(
        (await listGET(request("GET", undefined, `/api/v1/game-profiles?${query}`))).status,
      ).toBe(400);
    }
    expect(await database.gameProfile.count()).toBe(0);
  });
  it("pages cards without splitting users and hides departed/banned authors", async () => {
    const createdAt = new Date("2026-09-16T00:00:00Z");
    for (let index = 0; index < 14; index++) {
      const id = randomUUID();
      await createMember(id, `${175928847299118000n + BigInt(index)}`);
      const { profile } = await saveGameProfile(database, id, {
        games: [...sample.games, { game: "pubg", nickname: "PUBG-name", tier: null }],
      });
      await database.gameProfile.update({ where: { id: profile.id }, data: { createdAt } });
    }
    const first = gameProfileListResponseSchema.parse(
      await (await listGET(request("GET", undefined, "/api/v1/game-profiles?game=pubg"))).json(),
    ).data;
    expect(first.items).toHaveLength(12);
    expect(first.items.every((item) => item.games.length === 2)).toBe(true);
    const second = gameProfileListResponseSchema.parse(
      await (
        await listGET(
          request("GET", undefined, `/api/v1/game-profiles?game=pubg&cursor=${first.nextCursor}`),
        )
      ).json(),
    ).data;
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(14);
    const banned = await database.gameProfile.findUniqueOrThrow({
      where: { id: first.items[0].id },
    });
    await database.user.update({ where: { id: banned.userId }, data: { status: "BANNED" } });
    membership.mockImplementation(async (id) => id === "175928847299117063");
    const hidden = gameProfileListResponseSchema.parse(
      await (await listGET(request("GET", undefined, "/api/v1/game-profiles"))).json(),
    ).data;
    expect(hidden.items).toEqual([]);
    expect(hidden.nextCursor).not.toBeNull();
  });
  it("serializes concurrent whole-card replacements and rolls back malformed entries", async () => {
    const second = { games: [{ game: "pubg" as const, nickname: "Other", tier: null }] };
    expect(
      (await Promise.all([PUT(request("PUT", sample)), PUT(request("PUT", second))])).map(
        (response) => response.status,
      ),
    ).toEqual([200, 200]);
    expect(await database.gameProfile.count()).toBe(1);
    const persisted = await database.gameProfileEntry.findMany();
    expect(persisted).toHaveLength(1);
    expect(["lol", "pubg"]).toContain(persisted[0].game);
    await expect(
      saveGameProfile(database, userId, { games: [{ game: "lol", nickname: "", tier: null }] }),
    ).rejects.toThrow();
    expect(await database.gameProfileEntry.findMany()).toEqual(persisted);
    await database.user.update({ where: { id: userId }, data: { status: "BANNED" } });
    await expect(saveGameProfile(database, userId, sample)).rejects.toMatchObject({
      code: "USER_BANNED",
    });
  });
  it("enforces DB game, length, uniqueness, foreign key and cascading deletion constraints", async () => {
    const { profile } = await saveGameProfile(database, userId, sample);
    for (const data of [
      { game: "steam", nickname: "Player", tier: null },
      { game: "pubg", nickname: " ", tier: null },
      { game: "pubg", nickname: "x".repeat(65), tier: null },
      { game: "pubg", nickname: "Player", tier: "x".repeat(33) },
      { game: "pubg", nickname: "Player", tier: " " },
      sample.games[0],
    ])
      await expect(
        database.gameProfileEntry.create({ data: { profileId: profile.id, ...data } }),
      ).rejects.toThrow();
    await expect(database.gameProfile.create({ data: { userId } })).rejects.toThrow();
    await expect(
      database.gameProfileEntry.create({ data: { profileId: randomUUID(), ...sample.games[0] } }),
    ).rejects.toThrow();
    await database.user.delete({ where: { id: userId } });
    expect(await database.gameProfile.count()).toBe(0);
    expect(await database.gameProfileEntry.count()).toBe(0);
  });
});
