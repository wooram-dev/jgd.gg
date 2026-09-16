import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import { ApiError } from "@/lib/http/api-error";
import { isMockDiscordEnabled } from "./mock-discord";

const memberSchema = z.object({
  user: z.object({ id: z.string(), bot: z.boolean().optional() }),
  pending: z.boolean().optional(),
  flags: z.number().int().nonnegative().optional(),
});
const cache = new Map<string, { member: boolean; expiresAt: number }>();
const pending = new Map<string, Promise<boolean>>();
const CACHE_MS = 60_000;
let retryAfter = 0;

function unavailable(): ApiError {
  return new ApiError(503, "GUILD_MEMBERSHIP_UNAVAILABLE");
}

export async function isTargetGuildMember(discordId: string): Promise<boolean> {
  if (!/^[0-9]{17,20}$/.test(discordId)) return false;
  // Only the fixed local OAuth fixture is a member in E2E. No browser input enables this.
  if (isMockDiscordEnabled()) return discordId === "175928847299117063";
  const env = getServerEnv();
  if (!env.DISCORD_BOT_TOKEN || !env.TARGET_GUILD_ID) throw unavailable();
  const key = `${env.TARGET_GUILD_ID}:${discordId}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.member;
  cache.delete(key);
  if (Date.now() < retryAfter) throw unavailable();
  const existing = pending.get(key);
  if (existing) return existing;

  const operation = (async () => {
    try {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${env.TARGET_GUILD_ID}/members/${discordId}`,
        {
          headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (response.status === 429) {
        const seconds = Number(response.headers.get("retry-after"));
        retryAfter =
          Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : CACHE_MS);
        throw unavailable();
      }
      let member: boolean;
      if (response.status === 404) {
        const error = z.object({ code: z.literal(10007) }).safeParse(await response.json());
        if (!error.success) throw unavailable();
        member = false;
      } else {
        if (!response.ok) throw unavailable();
        const data = memberSchema.parse(await response.json());
        if (data.user.id !== discordId) throw unavailable();
        member = !data.user.bot && !data.pending && ((data.flags ?? 0) & 16) === 0;
      }
      if (cache.size >= 1000) cache.clear();
      cache.set(key, { member, expiresAt: Date.now() + CACHE_MS });
      return member;
    } catch {
      // Do not log upstream bodies, URLs, headers or fetch exception messages.
      throw unavailable();
    }
  })();
  pending.set(key, operation);
  try {
    return await operation;
  } finally {
    pending.delete(key);
  }
}
