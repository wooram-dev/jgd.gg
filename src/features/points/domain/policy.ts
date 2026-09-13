import { getRankingPeriod } from "@/lib/time/ranking-period";

export const POINTS_POLICY_VERSION = "number-click-completion-v1";
export const POINTS_POLICY_EFFECTIVE_AT = new Date("2026-09-11T16:12:00.000Z");
export const POINTS_PER_OFFICIAL_COMPLETION = 10;
export const POINTS_DAILY_EARN_LIMIT = 50;

export type PointAwardStatus = "AWARDED" | "DAILY_LIMIT_REACHED" | "NOT_ELIGIBLE";

export type PointAwardDecision = {
  status: PointAwardStatus;
  amount: number;
  policyVersion: typeof POINTS_POLICY_VERSION;
};

export function decideOfficialCompletionAward(input: {
  achievedAt: Date;
  dailyEarned: number;
}): PointAwardDecision {
  if (input.achievedAt < POINTS_POLICY_EFFECTIVE_AT) {
    return {
      status: "NOT_ELIGIBLE",
      amount: 0,
      policyVersion: POINTS_POLICY_VERSION,
    };
  }

  if (input.dailyEarned + POINTS_PER_OFFICIAL_COMPLETION > POINTS_DAILY_EARN_LIMIT) {
    return {
      status: "DAILY_LIMIT_REACHED",
      amount: 0,
      policyVersion: POINTS_POLICY_VERSION,
    };
  }

  return {
    status: "AWARDED",
    amount: POINTS_PER_OFFICIAL_COMPLETION,
    policyVersion: POINTS_POLICY_VERSION,
  };
}

export function getPointEarningDay(achievedAt: Date): { startsAt: Date; endsAt: Date } {
  const period = getRankingPeriod("today", achievedAt);
  return { startsAt: period.startsAt, endsAt: period.endsAt };
}
