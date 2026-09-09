import { z } from "zod";

const discordProfileSchema = z
  .object({
    id: z.string().regex(/^\d{5,25}$/),
    username: z.string().min(1).max(64),
    global_name: z.string().min(1).max(64).nullable().optional(),
    avatar: z
      .string()
      .regex(/^[A-Za-z0-9_]+$/)
      .nullable()
      .optional(),
  })
  .passthrough();

export type MappedDiscordProfile = {
  name: string;
  email: string;
  emailVerified: false;
  image: string;
  discordUsername: string;
  discordDisplayName: string;
  discordAvatarHash: string | null;
  profileUpdatedAt: Date;
};

export function mapDiscordProfile(profile: unknown, now = new Date()): MappedDiscordProfile {
  const parsed = discordProfileSchema.parse(profile);
  const displayName = parsed.global_name ?? parsed.username;
  const avatarUrl = parsed.avatar
    ? `https://cdn.discordapp.com/avatars/${parsed.id}/${parsed.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(parsed.id) >> 22n) % 6n)}.png`;

  return {
    name: displayName,
    email: `${parsed.id}@discord.placeholder.invalid`,
    emailVerified: false,
    image: avatarUrl,
    discordUsername: parsed.username,
    discordDisplayName: displayName,
    discordAvatarHash: parsed.avatar ?? null,
    profileUpdatedAt: now,
  };
}
