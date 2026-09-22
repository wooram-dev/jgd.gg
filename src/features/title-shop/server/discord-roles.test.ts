import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TITLE_KEYS } from "../catalog";
const config = vi.hoisted(() => ({
  DISCORD_BOT_TOKEN: "test-bot-token",
  TARGET_GUILD_ID: "100000000000000001",
  DISCORD_TITLE_ROLE_IDS: "",
}));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => config }));
const roles = {
  lockdown: "200000000000000001",
  overwatch: "200000000000000002",
  lol: "200000000000000003",
  pubg: "200000000000000004",
  minecraft: "200000000000000005",
  valorant: "200000000000000006",
};
const discordId = "175928847299117063";
const botId = "100000000000000002";
const botRole = "100000000000000003";
const unrelatedRole = "100000000000000004";
let memberRoles: Set<string>;
let edits: string[];
let roleRows: { id: string; permissions: string; position: number; managed: boolean }[];
let overwrites: { id: string; type: number; allow: string }[];
let memberExtra: Record<string, unknown>;
let unknownMember: boolean;
let failAfterPut: boolean;
let failDelete: boolean;
let factory: typeof import("./discord-roles").createDiscordRoleGateway;
let getGateway: typeof import("./discord-roles").getTitleRoleGateway;

beforeEach(async () => {
  vi.resetModules();
  ({ createDiscordRoleGateway: factory, getTitleRoleGateway: getGateway } =
    await import("./discord-roles"));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("E2E_AUTH_MODE", "");
  config.DISCORD_TITLE_ROLE_IDS = JSON.stringify(roles);
  config.DISCORD_BOT_TOKEN = "test-bot-token";
  memberRoles = new Set([unrelatedRole, roles.lockdown]);
  edits = [];
  overwrites = [];
  memberExtra = {};
  unknownMember = false;
  failAfterPut = false;
  failDelete = false;
  roleRows = [
    { id: botRole, permissions: String(1 << 28), position: 10, managed: true },
    ...Object.values(roles).map((id) => ({ id, permissions: "0", position: 1, managed: false })),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
      const path = String(input).replace("https://discord.com/api/v10", "");
      expect(options).toMatchObject({
        redirect: "error",
        cache: "no-store",
        headers: { Authorization: "Bot test-bot-token" },
      });
      if (path === "/users/@me") return Response.json({ id: botId });
      if (path.endsWith(`/members/${botId}`))
        return Response.json({ user: { id: botId, bot: true }, roles: [botRole] });
      if (path.endsWith(`/members/${discordId}`))
        return unknownMember
          ? Response.json({ code: 10007 }, { status: 404 })
          : Response.json({ user: { id: discordId }, roles: [...memberRoles], ...memberExtra });
      if (options?.method === "PUT" || options?.method === "DELETE") {
        const id = path.split("/").at(-1)!;
        edits.push(`${options.method}:${id}`);
        if (options.method === "DELETE") {
          if (failDelete) throw new Error("private upstream error");
          memberRoles.delete(id);
        } else {
          memberRoles.add(id);
          if (failAfterPut) {
            failAfterPut = false;
            throw new Error("response lost after applied");
          }
        }
        return new Response(null, { status: 204 });
      }
      if (path.endsWith("/roles")) return Response.json(roleRows);
      if (path.endsWith("/channels")) return Response.json([{ permission_overwrites: overwrites }]);
      throw new Error("Unexpected fixture URL");
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const gateway = () => factory({ token: "test-bot-token", guildId: config.TARGET_GUILD_ID, roles });

describe("Discord title role adapter", () => {
  it("removes only shop roles before adding one, preserves other roles and verifies the result", async () => {
    memberRoles.add(roles.lol);
    await gateway().apply(discordId, "overwatch");
    expect([...memberRoles].sort()).toEqual([unrelatedRole, roles.overwatch].sort());
    expect(edits).toEqual([
      `DELETE:${roles.lockdown}`,
      `DELETE:${roles.lol}`,
      `PUT:${roles.overwatch}`,
    ]);
    await gateway().apply(discordId, null);
    expect([...memberRoles]).toEqual([unrelatedRole]);
  });
  it("does not add a new role when removal fails", async () => {
    failDelete = true;
    await expect(gateway().apply(discordId, "lol")).rejects.toThrow("temporarily unavailable");
    expect(edits).toEqual([`DELETE:${roles.lockdown}`]);
  });
  it("recovers a timed-out successful addition by inspecting current roles", async () => {
    failAfterPut = true;
    await expect(gateway().apply(discordId, "lol")).rejects.toThrow("temporarily unavailable");
    await gateway().apply(discordId, "lol");
    expect(edits).toEqual([`DELETE:${roles.lockdown}`, `PUT:${roles.lol}`]);
  });
  it.each(["managed", "permission", "hierarchy", "missing", "bot-permission", "channel"])(
    "rejects unsafe/unavailable roles: %s",
    async (kind) => {
      const role = roleRows[1];
      if (kind === "managed") role.managed = true;
      if (kind === "permission") role.permissions = "8";
      if (kind === "hierarchy") role.position = 10;
      if (kind === "missing") roleRows.splice(1, 1);
      if (kind === "bot-permission") roleRows[0].permissions = "0";
      if (kind === "channel") overwrites.push({ id: roles.lockdown, type: 0, allow: "1024" });
      await expect(gateway().preflight(discordId)).rejects.toThrow("temporarily unavailable");
      expect(edits).toHaveLength(0);
    },
  );
  it.each(["unknown", "pending", "bot", "guest", "mismatched"])(
    "rejects ineligible identities: %s",
    async (kind) => {
      if (kind === "unknown") unknownMember = true;
      if (kind === "pending") memberExtra = { pending: true };
      if (kind === "bot") memberExtra = { user: { id: discordId, bot: true } };
      if (kind === "guest") memberExtra = { flags: 16 };
      if (kind === "mismatched") memberExtra = { user: { id: botId } };
      await expect(gateway().preflight(discordId)).rejects.toBeDefined();
      expect(edits).toHaveLength(0);
    },
  );
  it("respects Retry-After and never returns upstream details", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ retry_after: 60, secret: "must-not-leak" }, { status: 429 }),
    );
    await expect(gateway().preflight(discordId)).rejects.toMatchObject({
      message: "Discord title roles are temporarily unavailable.",
      retryAt: expect.any(Date),
    });
    await expect(gateway().preflight(discordId)).rejects.toThrow("temporarily unavailable");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404, 500])("fails closed and redacts HTTP %s errors", async (status) => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ code: 10004, secret: "must-not-leak" }, { status }),
    );
    await expect(gateway().preflight(discordId)).rejects.toThrow("temporarily unavailable");
  });
  it("fails closed on malformed JSON and malformed member payloads", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("not-json"))
      .mockResolvedValueOnce(Response.json({ roles: [] }));
    await expect(gateway().preflight(discordId)).rejects.toThrow("temporarily unavailable");
    await expect(gateway().preflight(discordId)).rejects.toThrow("temporarily unavailable");
  });
  it("requires a complete unique role allowlist and token", () => {
    expect(getGateway()).not.toBeNull();
    for (const value of [
      "invalid",
      "{}",
      JSON.stringify({ ...roles, lol: roles.lockdown }),
      JSON.stringify({ ...roles, lol: config.TARGET_GUILD_ID }),
      JSON.stringify({ ...roles, injected: unrelatedRole }),
    ]) {
      config.DISCORD_TITLE_ROLE_IDS = value;
      expect(getGateway()).toBeNull();
    }
    config.DISCORD_TITLE_ROLE_IDS = JSON.stringify(roles);
    config.DISCORD_BOT_TOKEN = "";
    expect(getGateway()).toBeNull();
    expect(TITLE_KEYS).toHaveLength(6);
  });
  it("uses the fixed mock identity only in test mode", async () => {
    vi.stubEnv("E2E_AUTH_MODE", "mock-discord");
    await expect(getGateway()!.preflight(discordId)).resolves.toBeUndefined();
    await expect(getGateway()!.preflight(botId)).rejects.toMatchObject({
      code: "TITLE_MEMBER_REQUIRED",
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    expect(getGateway()?.configurationKey).not.toContain("mock");
  });
});
