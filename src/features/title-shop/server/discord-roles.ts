import { createHash } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env/server";
import { isMockDiscordEnabled } from "@/lib/auth/mock-discord";
import { ApiError } from "@/lib/http/api-error";
import { TITLE_KEYS, type TitleKey } from "../catalog";

const snowflake = z.string().regex(/^[0-9]{17,20}$/);
const roleMapSchema = z
  .record(z.enum(TITLE_KEYS), snowflake)
  .refine((roles) => new Set(Object.values(roles)).size === TITLE_KEYS.length);
const memberSchema = z.object({
  user: z.object({ id: snowflake, bot: z.boolean().optional() }),
  roles: z.array(snowflake),
  pending: z.boolean().optional(),
  flags: z.number().int().nonnegative().optional(),
});
const roleSchema = z.object({
  id: snowflake,
  position: z.number().int(),
  permissions: z.string().regex(/^\d+$/),
  managed: z.boolean(),
});
const channelsSchema = z.array(
  z.object({
    permission_overwrites: z
      .array(z.object({ id: snowflake, type: z.number().int(), allow: z.string().regex(/^\d+$/) }))
      .default([]),
  }),
);
type RoleConfiguration = { token: string; guildId: string; roles: Record<TitleKey, string> };
export interface TitleRoleGateway {
  readonly configurationKey: string;
  preflight(discordId: string): Promise<void>;
  apply(discordId: string, titleKey: TitleKey | null): Promise<void>;
}
export class TitleRoleUnavailable extends Error {
  constructor(readonly retryAt = new Date(Date.now() + 30_000)) {
    super("Discord title roles are temporarily unavailable.");
  }
}
let rateLimitUntil = 0;

export function createDiscordRoleGateway(config: RoleConfiguration): TitleRoleGateway {
  const guildPath = `/guilds/${config.guildId}`;
  const roleIds = Object.values(config.roles);
  const configurationKey = createHash("sha256")
    .update(JSON.stringify([config.guildId, ...TITLE_KEYS.map((key) => config.roles[key])]))
    .digest("hex");
  async function request(path: string, method = "GET"): Promise<unknown> {
    if (Date.now() < rateLimitUntil) throw new TitleRoleUnavailable(new Date(rateLimitUntil));
    try {
      const response = await fetch(`https://discord.com/api/v10${path}`, {
        method,
        headers: { Authorization: `Bot ${config.token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(3_000),
      });
      if (response.status === 429) {
        const body = await response.json().catch(() => null);
        const parsed = z.object({ retry_after: z.number().nonnegative() }).safeParse(body);
        const seconds = parsed.success
          ? parsed.data.retry_after
          : Number(response.headers.get("retry-after"));
        rateLimitUntil =
          Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 30_000);
        throw new TitleRoleUnavailable(new Date(rateLimitUntil));
      }
      if (response.status === 404) {
        const error = z.object({ code: z.literal(10007) }).safeParse(await response.json());
        if (error.success) throw new ApiError(403, "TITLE_MEMBER_REQUIRED");
      }
      if (!response.ok) throw new TitleRoleUnavailable();
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      if (error instanceof TitleRoleUnavailable || error instanceof ApiError) throw error;
      // Upstream URLs, tokens, bodies and fetch errors never enter responses or logs.
      throw new TitleRoleUnavailable();
    }
  }
  async function member(discordId: string) {
    const parsed = memberSchema.safeParse(await request(`${guildPath}/members/${discordId}`));
    if (!parsed.success || parsed.data.user.id !== discordId) throw new TitleRoleUnavailable();
    return parsed.data;
  }
  async function inspect(discordId: string) {
    if (!snowflake.safeParse(discordId).success) throw new ApiError(403, "TITLE_MEMBER_REQUIRED");
    const target = await member(discordId);
    if (target.user.bot || target.pending || ((target.flags ?? 0) & 16) !== 0)
      throw new ApiError(403, "TITLE_MEMBER_REQUIRED");
    const roles = z.array(roleSchema).safeParse(await request(`${guildPath}/roles`));
    const bot = z.object({ id: snowflake }).safeParse(await request("/users/@me"));
    if (!roles.success || !bot.success) throw new TitleRoleUnavailable();
    const botMember = await member(bot.data.id);
    const botRoles = roles.data.filter(
      (role) => role.id === config.guildId || botMember.roles.includes(role.id),
    );
    const permissions = botRoles.reduce((bits, role) => bits | BigInt(role.permissions), 0n);
    const top = Math.max(0, ...botRoles.map((role) => role.position));
    if ((permissions & ((1n << 28n) | 8n)) === 0n) throw new TitleRoleUnavailable();
    for (const id of roleIds) {
      const role = roles.data.find((item) => item.id === id);
      if (
        !role ||
        id === config.guildId ||
        role.managed ||
        role.position >= top ||
        BigInt(role.permissions) !== 0n
      )
        throw new TitleRoleUnavailable();
    }
    const channels = channelsSchema.safeParse(await request(`${guildPath}/channels`));
    if (
      !channels.success ||
      channels.data.some((channel) =>
        channel.permission_overwrites.some(
          (overwrite) =>
            overwrite.type === 0 &&
            roleIds.includes(overwrite.id) &&
            BigInt(overwrite.allow) !== 0n,
        ),
      )
    )
      throw new TitleRoleUnavailable();
    return target.roles;
  }
  return {
    configurationKey,
    async preflight(discordId) {
      await inspect(discordId);
    },
    async apply(discordId, titleKey) {
      const roles = await inspect(discordId);
      const desired = titleKey === null ? null : config.roles[titleKey];
      // Single-role operations preserve every unrelated role. Remove before adding.
      for (const role of roleIds) {
        if (role !== desired && roles.includes(role))
          await request(`${guildPath}/members/${discordId}/roles/${role}`, "DELETE");
      }
      if (desired && !roles.includes(desired))
        await request(`${guildPath}/members/${discordId}/roles/${desired}`, "PUT");
      const actual = (await member(discordId)).roles.filter((role) => roleIds.includes(role));
      if (actual.length !== (desired ? 1 : 0) || (desired && actual[0] !== desired))
        throw new TitleRoleUnavailable();
    },
  };
}

export function getTitleRoleGateway(): TitleRoleGateway | null {
  if (isMockDiscordEnabled()) {
    // Matches the existing OAuth fixture; never enabled in production or by a request parameter.
    const verify = async (discordId: string) => {
      if (discordId !== "175928847299117063") throw new ApiError(403, "TITLE_MEMBER_REQUIRED");
    };
    return { configurationKey: "mock-discord-title-roles-v1", preflight: verify, apply: verify };
  }
  const env = getServerEnv();
  if (!env.DISCORD_BOT_TOKEN || !env.TARGET_GUILD_ID || !env.DISCORD_TITLE_ROLE_IDS) return null;
  try {
    const parsed = roleMapSchema.safeParse(JSON.parse(env.DISCORD_TITLE_ROLE_IDS));
    if (!parsed.success || Object.values(parsed.data).includes(env.TARGET_GUILD_ID)) return null;
    return createDiscordRoleGateway({
      token: env.DISCORD_BOT_TOKEN,
      guildId: env.TARGET_GUILD_ID,
      roles: parsed.data,
    });
  } catch {
    return null;
  }
}
