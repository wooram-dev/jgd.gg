export const NUMBER_CLICK_SLUG = "number-click";

export const NUMBER_CLICK_RULES = {
  version: 1,
  boardSize: 5,
  maxNumber: 25,
  penaltyPerMistakeMs: 500,
  minimumDurationMs: 3_000,
  maximumDurationMs: 300_000,
  maximumClickCount: 100,
  readyLifetimeMs: 60_000,
  playingLifetimeMs: 300_000,
  clockToleranceMs: 1_000,
} as const;

export type NumberClickRulesSnapshot = {
  version: number;
  boardSize: number;
  maxNumber: number;
  penaltyPerMistakeMs: number;
  minimumDurationMs: number;
  maximumDurationMs: number;
  maximumClickCount: number;
};

export const NUMBER_CLICK_RULES_SNAPSHOT: NumberClickRulesSnapshot = {
  version: NUMBER_CLICK_RULES.version,
  boardSize: NUMBER_CLICK_RULES.boardSize,
  maxNumber: NUMBER_CLICK_RULES.maxNumber,
  penaltyPerMistakeMs: NUMBER_CLICK_RULES.penaltyPerMistakeMs,
  minimumDurationMs: NUMBER_CLICK_RULES.minimumDurationMs,
  maximumDurationMs: NUMBER_CLICK_RULES.maximumDurationMs,
  maximumClickCount: NUMBER_CLICK_RULES.maximumClickCount,
};
