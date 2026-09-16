import { z } from "zod";

export const PROFILE_GAMES = [
  {
    id: "lol",
    name: "League of Legends",
    shortName: "LoL",
    nicknameHint: "닉네임#태그",
    tierHint: "예: 골드 IV",
  },
  {
    id: "pubg",
    name: "PUBG",
    shortName: "PUBG",
    nicknameHint: "게임 닉네임",
    tierHint: "예: 플래티넘",
  },
  {
    id: "overwatch",
    name: "Overwatch",
    shortName: "Overwatch",
    nicknameHint: "배틀태그#1234",
    tierHint: "예: 지원 다이아몬드 3",
  },
] as const;

export const profileGameSchema = z.enum(["lol", "pubg", "overwatch"]);
export type ProfileGame = z.infer<typeof profileGameSchema>;

function profileText(maximum: number) {
  return z
    .string()
    .trim()
    .min(1, "한 글자 이상 입력해 주세요.")
    .max(maximum, `${maximum}자 이내로 입력해 주세요.`)
    .regex(/^[^\p{Cc}\p{Cf}<>]+$/u, "줄바꿈, 숨은 문자, 꺾쇠는 사용할 수 없습니다.");
}

export const gameEntrySchema = z
  .object({
    game: profileGameSchema,
    nickname: profileText(64),
    tier: profileText(32).nullable(),
  })
  .strict();

export const saveGameProfileSchema = z
  .object({
    games: z
      .array(gameEntrySchema)
      .min(1, "게임을 하나 이상 선택해 주세요.")
      .max(3)
      .refine(
        (games) => new Set(games.map((entry) => entry.game)).size === games.length,
        "같은 게임을 중복 등록할 수 없습니다.",
      ),
  })
  .strict();
export type SaveGameProfile = z.infer<typeof saveGameProfileSchema>;

export const gameProfileSchema = z
  .object({
    id: z.string().uuid(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    isViewer: z.boolean(),
    source: z.literal("SELF_REPORTED"),
    games: saveGameProfileSchema.shape.games,
    updatedAt: z.string().datetime(),
  })
  .strict();
export type GameProfileCardData = z.infer<typeof gameProfileSchema>;

const metaSchema = z.object({ requestId: z.string() });
export const myGameProfileResponseSchema = z.object({
  data: z.object({ profile: gameProfileSchema.nullable() }).strict(),
  meta: metaSchema,
});
export const gameProfileListResponseSchema = z.object({
  data: z
    .object({ items: z.array(gameProfileSchema), nextCursor: z.string().uuid().nullable() })
    .strict(),
  meta: metaSchema,
});
export type GameProfileListData = z.infer<typeof gameProfileListResponseSchema>["data"];
export const gameProfileQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    game: profileGameSchema.optional(),
  })
  .strict();
