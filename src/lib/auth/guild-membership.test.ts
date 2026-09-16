import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  DISCORD_BOT_TOKEN: "test-bot-secret",
  TARGET_GUILD_ID: "123456789012345678",
}));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => configuration }));
const discordId = "175928847299117063";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T00:00:00Z"));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("E2E_AUTH_MODE", "");
  configuration.DISCORD_BOT_TOKEN = "test-bot-secret";
  configuration.TARGET_GUILD_ID = "123456789012345678";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("target guild membership", () => {
  it("checks the canonical ID, coalesces requests and expires membership after one minute", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ user: { id: discordId }, pending: false, flags: 0 }),
    );
    const { isTargetGuildMember } = await import("./guild-membership");
    expect(
      await Promise.all([isTargetGuildMember(discordId), isTargetGuildMember(discordId)]),
    ).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://discord.com/api/v10/guilds/${configuration.TARGET_GUILD_ID}/members/${discordId}`,
      expect.objectContaining({
        cache: "no-store",
        redirect: "error",
        headers: { Authorization: "Bot test-bot-secret" },
      }),
    );
    vi.advanceTimersByTime(59_999);
    expect(await isTargetGuildMember(discordId)).toBe(true);
    vi.advanceTimersByTime(1);
    fetchMock.mockResolvedValueOnce(Response.json({ code: 10007 }, { status: 404 }));
    expect(await isTargetGuildMember(discordId)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([
    { user: { id: discordId }, pending: true },
    { user: { id: discordId, bot: true } },
    { user: { id: discordId }, flags: 16 },
  ])("denies screening, bot and guest members", async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    const { isTargetGuildMember } = await import("./guild-membership");
    expect(await isTargetGuildMember(discordId)).toBe(false);
  });
  it.each([401, 403, 500, 502])(
    "fails closed on upstream %i without retaining a stale positive",
    async (status) => {
      const { isTargetGuildMember } = await import("./guild-membership");
      fetchMock.mockResolvedValueOnce(Response.json({ user: { id: discordId } }));
      expect(await isTargetGuildMember(discordId)).toBe(true);
      vi.advanceTimersByTime(60_000);
      fetchMock.mockResolvedValueOnce(
        Response.json({ message: "private upstream details" }, { status }),
      );
      await expect(isTargetGuildMember(discordId)).rejects.toMatchObject({
        status: 503,
        code: "GUILD_MEMBERSHIP_UNAVAILABLE",
      });
      fetchMock.mockResolvedValueOnce(Response.json({ user: { id: discordId } }));
      expect(await isTargetGuildMember(discordId)).toBe(true);
    },
  );
  it.each([
    Response.json({ code: 10004 }, { status: 404 }),
    Response.json({ user: { id: "different-id" } }),
    Response.json({ user: {} }),
    new Response("not JSON", { status: 200 }),
  ])("does not treat malformed replies or an unknown guild as a nonmember", async (response) => {
    fetchMock.mockResolvedValue(response);
    const { isTargetGuildMember } = await import("./guild-membership");
    await expect(isTargetGuildMember(discordId)).rejects.toMatchObject({ status: 503 });
  });
  it("honors retry-after without hammering Discord", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({}, { status: 429, headers: { "Retry-After": "2" } }),
    );
    const { isTargetGuildMember } = await import("./guild-membership");
    await expect(isTargetGuildMember(discordId)).rejects.toMatchObject({ status: 503 });
    await expect(isTargetGuildMember("175928847299117064")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    fetchMock.mockResolvedValueOnce(Response.json({ user: { id: discordId } }));
    expect(await isTargetGuildMember(discordId)).toBe(true);
  });
  it("redacts network/timeout failures and never fetches without configuration", async () => {
    const { isTargetGuildMember } = await import("./guild-membership");
    configuration.DISCORD_BOT_TOKEN = "";
    await expect(isTargetGuildMember(discordId)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
    configuration.DISCORD_BOT_TOKEN = "test-bot-secret";
    fetchMock.mockRejectedValue(new Error("timeout with test-bot-secret"));
    await expect(isTargetGuildMember(discordId)).rejects.toThrow(
      "Discord 서버 멤버 여부를 확인하지 못했습니다.",
    );
    expect(await isTargetGuildMember("../invalid")).toBe(false);
  });
  it("limits mock membership to the fixed fixture and requires both test guards", async () => {
    const { isTargetGuildMember } = await import("./guild-membership");
    vi.stubEnv("E2E_AUTH_MODE", "mock-discord");
    expect(await isTargetGuildMember(discordId)).toBe(true);
    expect(await isTargetGuildMember("175928847299117064")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValueOnce(Response.json({ code: 10007 }, { status: 404 }));
    expect(await isTargetGuildMember(discordId)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
