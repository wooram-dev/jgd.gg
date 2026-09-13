import { describe, expect, it } from "vitest";

import {
  POINTS_POLICY_EFFECTIVE_AT,
  decideOfficialCompletionAward,
  getPointEarningDay,
} from "./policy";

describe("points policy v1", () => {
  it("정책 적용 시각 이전 기록은 적립하지 않고 경계부터 10P를 적립한다", () => {
    expect(
      decideOfficialCompletionAward({
        achievedAt: new Date(POINTS_POLICY_EFFECTIVE_AT.getTime() - 1),
        dailyEarned: 0,
      }),
    ).toMatchObject({ status: "NOT_ELIGIBLE", amount: 0 });
    expect(
      decideOfficialCompletionAward({ achievedAt: POINTS_POLICY_EFFECTIVE_AT, dailyEarned: 0 }),
    ).toMatchObject({ status: "AWARDED", amount: 10 });
  });

  it("KST 하루 50P까지 적립하고 부분 적립 없이 한도를 적용한다", () => {
    const achievedAt = new Date("2026-09-12T01:00:00.000Z");
    expect(decideOfficialCompletionAward({ achievedAt, dailyEarned: 40 })).toMatchObject({
      status: "AWARDED",
      amount: 10,
    });
    expect(decideOfficialCompletionAward({ achievedAt, dailyEarned: 41 })).toMatchObject({
      status: "DAILY_LIMIT_REACHED",
      amount: 0,
    });
    expect(decideOfficialCompletionAward({ achievedAt, dailyEarned: 50 })).toMatchObject({
      status: "DAILY_LIMIT_REACHED",
      amount: 0,
    });
  });

  it("적립일을 Asia/Seoul 자정 반개구간으로 계산한다", () => {
    expect(getPointEarningDay(new Date("2026-09-12T14:59:59.999Z"))).toEqual({
      startsAt: new Date("2026-09-11T15:00:00.000Z"),
      endsAt: new Date("2026-09-12T15:00:00.000Z"),
    });
    expect(getPointEarningDay(new Date("2026-09-12T15:00:00.000Z"))).toEqual({
      startsAt: new Date("2026-09-12T15:00:00.000Z"),
      endsAt: new Date("2026-09-13T15:00:00.000Z"),
    });
  });
});
