import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTitleShop,
  purchaseTitle,
  equipTitle,
  syncTitleRoles,
} from "@/features/title-shop/server/shop-service";
import {
  TitleRoleUnavailable,
  type TitleRoleGateway,
} from "@/features/title-shop/server/discord-roles";
import {
  getPointOverview,
  invalidateGameRecord,
  PointLedgerIntegrityError,
} from "@/features/points/server/points-service";
import { ApiError } from "@/lib/http/api-error";
import { cleanApplicationData, createTestDatabase, createTestUser } from "../../helpers/database";
import { fundTitleTestUser } from "../../helpers/title-points";

const database = createTestDatabase();
const otherConnection = createTestDatabase();
const auth = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/db/client", () => ({ getDatabase: () => database }));
vi.mock("@/lib/auth/server", () => ({
  getOptionalSession: async () => (auth.userId ? { user: { id: auth.userId } } : null),
}));
const { titleRoute } = await import("@/features/title-shop/server/route");
const rolesModule = await import("@/features/title-shop/server/discord-roles");
afterEach(() => vi.restoreAllMocks());
const gateway: TitleRoleGateway = {
  configurationKey: "test-roles",
  preflight: vi.fn(async () => {}),
  apply: vi.fn(async () => {}),
};
let userId: string;
const purchase = () => ({ titleKey: "lockdown" as const, requestId: randomUUID() });
beforeEach(async () => {
  await cleanApplicationData(database);
  vi.mocked(gateway.preflight).mockReset().mockResolvedValue();
  vi.mocked(gateway.apply).mockReset().mockResolvedValue();
  userId = randomUUID();
  await createTestUser(database, userId);
  await database.account.create({
    data: {
      userId,
      providerId: "discord",
      issuer: "local:oauth:discord",
      accountId: "175928847299117063",
    },
  });
  auth.userId = userId;
});
afterAll(async () => {
  await database.$disconnect();
  await otherConnection.$disconnect();
});

describe("title shop transactions", () => {
  it("buys once, records -500P, and preserves ownership across equip and removal", async () => {
    await fundTitleTestUser(database, userId, 1000);
    const input = purchase();
    await purchaseTitle(database, userId, input, gateway);
    expect(await getTitleShop(database, userId, gateway)).toMatchObject({
      balance: 500,
      owned: ["lockdown"],
      equipment: { pending: true, desired: "lockdown", applied: null },
    });
    await syncTitleRoles(database, userId, gateway);
    await purchaseTitle(database, userId, input, null);
    await purchaseTitle(database, userId, { titleKey: "lol", requestId: randomUUID() }, gateway);
    await syncTitleRoles(database, userId, gateway);
    await equipTitle(database, userId, { titleKey: "lockdown", expectedRevision: 2 }, gateway);
    await syncTitleRoles(database, userId, gateway);
    await equipTitle(database, userId, { titleKey: null, expectedRevision: 3 }, gateway);
    await syncTitleRoles(database, userId, gateway);
    expect(await getTitleShop(database, userId, gateway)).toMatchObject({
      balance: 0,
      owned: expect.arrayContaining(["lockdown", "lol"]),
      equipment: { desired: null, applied: null, pending: false, revision: 4 },
    });
    expect(await database.pointTransaction.count({ where: { type: "SPEND" } })).toBe(2);
    expect((await getPointOverview(database, { userId })).transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "SPEND", reason: "TITLE_PURCHASE", amount: -500 }),
      ]),
    );
  });
  it("rejects insufficient balance without purchases, ledger debits or equipment changes", async () => {
    await fundTitleTestUser(database, userId, 490);
    await expect(purchaseTitle(database, userId, purchase(), gateway)).rejects.toMatchObject({
      code: "TITLE_BALANCE_INSUFFICIENT",
    });
    expect(await database.titlePurchase.count()).toBe(0);
    expect(await database.titleEquipment.count()).toBe(0);
    expect((await getTitleShop(database, userId, gateway)).balance).toBe(490);
  });
  it("serializes simultaneous requests across connections and never spends twice", async () => {
    await fundTitleTestUser(database, userId, 500);
    const input = purchase();
    const results = await Promise.allSettled([
      purchaseTitle(database, userId, input, gateway),
      purchaseTitle(otherConnection, userId, input, gateway),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    await purchaseTitle(database, userId, input, gateway);
    expect(await database.titlePurchase.count()).toBe(1);
    expect(await database.pointTransaction.count({ where: { type: "SPEND" } })).toBe(1);
    expect((await getTitleShop(database, userId, gateway)).balance).toBe(0);
    await expect(
      purchaseTitle(database, userId, { ...input, titleKey: "lol" }, gateway),
    ).rejects.toMatchObject({ code: "TITLE_REQUEST_CONFLICT" });
    await expect(purchaseTitle(database, userId, purchase(), gateway)).rejects.toMatchObject({
      code: "TITLE_ALREADY_OWNED",
    });
  });
  it("rejects competing different purchases without overspending", async () => {
    await fundTitleTestUser(database, userId, 500);
    const results = await Promise.allSettled([
      purchaseTitle(database, userId, purchase(), gateway),
      purchaseTitle(otherConnection, userId, { titleKey: "lol", requestId: randomUUID() }, gateway),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await database.titlePurchase.count()).toBe(1);
    expect((await getTitleShop(database, userId, gateway)).balance).toBe(0);
  });
  it("retains durable pending intent on Discord failure, retries without charging, and rejects stale equipment", async () => {
    await fundTitleTestUser(database, userId, 1000);
    const input = purchase();
    await purchaseTitle(database, userId, input, gateway);
    vi.mocked(gateway.apply).mockRejectedValueOnce(
      new TitleRoleUnavailable(new Date(Date.now() + 60_000)),
    );
    await syncTitleRoles(database, userId, gateway);
    await syncTitleRoles(otherConnection, userId, gateway);
    expect(gateway.apply).toHaveBeenCalledTimes(1);
    await expect(
      equipTitle(database, userId, { titleKey: null, expectedRevision: 1 }, gateway),
    ).rejects.toMatchObject({ code: "TITLE_SYNC_PENDING" });
    await database.titleEquipment.update({ where: { userId }, data: { retryAt: new Date(0) } });
    await syncTitleRoles(otherConnection, userId, gateway);
    await equipTitle(database, userId, { titleKey: null, expectedRevision: 1 }, gateway);
    await syncTitleRoles(database, userId, gateway);
    await purchaseTitle(database, userId, input, gateway);
    expect((await getTitleShop(database, userId, gateway)).equipment.desired).toBeNull();
    await expect(
      equipTitle(database, userId, { titleKey: "lockdown", expectedRevision: 0 }, gateway),
    ).rejects.toMatchObject({ code: "TITLE_REQUEST_CONFLICT" });
    expect(await database.pointTransaction.count({ where: { type: "SPEND" } })).toBe(1);
  });
  it("does not run two role writers concurrently", async () => {
    await fundTitleTestUser(database, userId, 500);
    await purchaseTitle(database, userId, purchase(), gateway);
    let release!: () => void;
    let entered!: () => void;
    const entry = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(gateway.apply).mockImplementationOnce(async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const first = syncTitleRoles(database, userId, gateway);
    await entry;
    try {
      await syncTitleRoles(otherConnection, userId, gateway);
      expect(gateway.apply).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await first;
    }
  });
  it("fails closed on unconfigured roles, nonmembers, banned users, missing ownership and changed role mappings", async () => {
    await fundTitleTestUser(database, userId, 500);
    await expect(purchaseTitle(database, userId, purchase(), null)).rejects.toMatchObject({
      code: "TITLE_SHOP_UNAVAILABLE",
    });
    vi.mocked(gateway.preflight).mockRejectedValueOnce(new ApiError(403, "TITLE_MEMBER_REQUIRED"));
    await expect(purchaseTitle(database, userId, purchase(), gateway)).rejects.toMatchObject({
      code: "TITLE_MEMBER_REQUIRED",
    });
    await expect(
      equipTitle(database, userId, { titleKey: "lol", expectedRevision: 0 }, gateway),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await purchaseTitle(database, userId, purchase(), gateway);
    await expect(
      syncTitleRoles(database, userId, { ...gateway, configurationKey: "changed" }),
    ).rejects.toMatchObject({ code: "TITLE_SHOP_UNAVAILABLE" });
    await database.user.update({ where: { id: userId }, data: { status: "BANNED" } });
    await expect(syncTitleRoles(database, userId, gateway)).rejects.toMatchObject({
      code: "USER_BANNED",
    });
    expect((await getTitleShop(database, userId, gateway)).canModify).toBe(false);
  });
  it("rolls back corrupt ledgers and enforces ownership, shape, price and deletion constraints", async () => {
    await database.pointAccount.update({ where: { userId }, data: { balance: 500 } });
    await expect(purchaseTitle(database, userId, purchase(), gateway)).rejects.toBeInstanceOf(
      PointLedgerIntegrityError,
    );
    expect(await database.titlePurchase.count()).toBe(0);
    await database.pointAccount.update({ where: { userId }, data: { balance: 0 } });
    await fundTitleTestUser(database, userId, 500);
    await purchaseTitle(database, userId, purchase(), gateway);
    await expect(
      database.titleEquipment.update({ where: { userId }, data: { desiredTitleKey: "lol" } }),
    ).rejects.toBeDefined();
    await expect(database.titlePurchase.updateMany({ data: { price: 1 } })).rejects.toBeDefined();
    const spend = await database.pointTransaction.findFirstOrThrow({ where: { type: "SPEND" } });
    await expect(
      database.pointTransaction.update({
        where: { id: spend.id },
        data: { gameRecordId: (await database.gameRecord.findFirstOrThrow()).id },
      }),
    ).rejects.toBeDefined();
    // Existing operator invalidation remains all-or-nothing when already-spent funds are unavailable.
    const record = await database.gameRecord.findFirstOrThrow();
    await expect(
      invalidateGameRecord(database, { gameRecordId: record.id, reason: "manual-review" }),
    ).rejects.toBeInstanceOf(PointLedgerIntegrityError);
    expect(
      (await database.gameRecord.findUniqueOrThrow({ where: { id: record.id } })).rankEligible,
    ).toBe(true);
    await database.user.delete({ where: { id: userId } });
    expect(await database.titlePurchase.count()).toBe(0);
    expect(await database.titleEquipment.count()).toBe(0);
    expect(await database.pointTransaction.count()).toBe(0);
  });
  it("enforces HTTP authentication, origin, strict schemas, body size and private DTOs", async () => {
    const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
    const request = (action: "read" | "purchase", body?: unknown, headers = {}) =>
      titleRoute(
        new Request(`${origin}/api/v1/me/titles`, {
          method: action === "read" ? "GET" : "POST",
          headers: { origin, "content-type": "application/json", ...headers },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        action,
      );
    auth.userId = null;
    expect((await request("read")).status).toBe(401);
    auth.userId = userId;
    const read = await request("read");
    expect(read.headers.get("cache-control")).toContain("no-store");
    const text = await read.text();
    expect(text).not.toContain(userId);
    expect(text).not.toContain("175928847299117063");
    expect((await request("purchase", purchase(), { origin: "https://outside.test" })).status).toBe(
      403,
    );
    expect((await request("purchase", { ...purchase(), price: 0 })).status).toBe(400);
    expect((await request("purchase", { ...purchase(), userId: "other" })).status).toBe(400);
    expect((await request("purchase", { ...purchase(), titleKey: "unknown" })).status).toBe(400);
    expect((await request("purchase", { ...purchase(), extra: "x".repeat(5000) })).status).toBe(
      413,
    );
  });
  it("serves purchase, equipment and pending recovery over authenticated HTTP", async () => {
    vi.spyOn(rolesModule, "getTitleRoleGateway").mockReturnValue(gateway);
    await fundTitleTestUser(database, userId, 500);
    const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
    const send = (action: "purchase" | "equipment" | "sync", body: object) =>
      titleRoute(
        new Request(`${origin}/api/v1/me/titles/${action}`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        action,
      );
    vi.mocked(gateway.apply).mockRejectedValueOnce(new TitleRoleUnavailable(new Date(0)));
    const input = purchase();
    const first = await send("purchase", input);
    expect(first.status).toBe(200);
    expect((await first.json()).data).toMatchObject({ balance: 0, equipment: { pending: true } });
    const retry = await send("sync", {});
    expect(retry.status).toBe(200);
    expect((await retry.json()).data.equipment).toMatchObject({
      pending: false,
      applied: "lockdown",
    });
    expect((await send("purchase", input)).status).toBe(200);
    expect((await send("equipment", { titleKey: null, expectedRevision: 1 })).status).toBe(200);
    expect(await database.pointTransaction.count({ where: { type: "SPEND" } })).toBe(1);
    vi.spyOn(rolesModule, "getTitleRoleGateway").mockReturnValue(null);
    expect((await send("sync", {})).status).toBe(503);
  });
  it("rejects guest, expired, banned and foreign-origin mutations on all three routes", async () => {
    vi.spyOn(rolesModule, "getTitleRoleGateway").mockReturnValue(gateway);
    const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
    for (const action of ["purchase", "equipment", "sync"] as const) {
      const send = (requestOrigin = origin) =>
        titleRoute(
          new Request(`${origin}/api/v1/me/titles/${action}`, {
            method: "POST",
            headers: { origin: requestOrigin, "content-type": "application/json" },
            body: "{}",
          }),
          action,
        );
      auth.userId = null;
      expect((await send()).status).toBe(401);
      auth.userId = randomUUID();
      expect((await send()).status).toBe(401);
      auth.userId = userId;
      expect((await send("https://outside.test")).status).toBe(403);
      await database.user.update({ where: { id: userId }, data: { status: "BANNED" } });
      expect((await send()).status).toBe(403);
      await database.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    }
  });
});
