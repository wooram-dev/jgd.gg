import { describe, expect, it } from "vitest";
import { saveGameProfileSchema } from "./profile";

const game = { game: "lol", nickname: "Player#KR1", tier: null };
describe("manual game profile validation", () => {
  it("trims optional text and accepts unranked/custom tiers without asserting authenticity", () => {
    expect(
      saveGameProfileSchema.parse({
        games: [{ ...game, nickname: " Player#KR1 ", tier: " 지원 골드 3 " }],
      }),
    ).toEqual({ games: [{ ...game, tier: "지원 골드 3" }] });
    expect(
      saveGameProfileSchema.safeParse({
        games: [
          game,
          { game: "pubg", nickname: "Player", tier: null },
          { game: "overwatch", nickname: "Tag#1234", tier: "언랭" },
        ],
      }).success,
    ).toBe(true);
  });
  it.each([
    { games: [] },
    { games: [game, game] },
    { games: [{ ...game, game: "steam" }] },
    { games: [game], userId: "someone-else" },
    { games: [{ ...game, verified: true }] },
    { games: [{ ...game, nickname: "  " }] },
    { games: [{ ...game, nickname: "x".repeat(65) }] },
    { games: [{ ...game, nickname: "hello\nworld" }] },
    { games: [{ ...game, nickname: "hello\u200bworld" }] },
    { games: [{ ...game, nickname: "<script>" }] },
    { games: [{ ...game, tier: " " }] },
    { games: [{ ...game, tier: "x".repeat(33) }] },
  ])("rejects invalid or authority-bearing input: %j", (input) => {
    expect(saveGameProfileSchema.safeParse(input).success).toBe(false);
  });
  it("accepts the maximum lengths", () => {
    expect(
      saveGameProfileSchema.safeParse({
        games: [{ ...game, nickname: "가".repeat(64), tier: "가".repeat(32) }],
      }).success,
    ).toBe(true);
  });
});
