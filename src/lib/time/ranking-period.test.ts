import { describe, expect, it } from "vitest";

import { getRankingPeriod } from "./ranking-period";

describe("getRankingPeriod", () => {
  it("KST 오늘을 UTC 반개구간으로 계산한다", () => {
    const period = getRankingPeriod("today", new Date("2026-09-06T03:00:00.000Z"));
    expect(period.startsAt?.toISOString()).toBe("2026-09-05T15:00:00.000Z");
    expect(period.endsAt?.toISOString()).toBe("2026-09-06T15:00:00.000Z");
  });

  it("KST 월요일 시작 주간을 계산한다", () => {
    const period = getRankingPeriod("week", new Date("2026-09-06T03:00:00.000Z"));
    expect(period.startsAt?.toISOString()).toBe("2026-08-30T15:00:00.000Z");
    expect(period.endsAt?.toISOString()).toBe("2026-09-06T15:00:00.000Z");
  });

  it("KST 자정과 월요일 정각에서 새 구간으로 전환한다", () => {
    expect(
      getRankingPeriod("today", new Date("2026-09-05T14:59:59.999Z")).startsAt?.toISOString(),
    ).toBe("2026-09-04T15:00:00.000Z");
    expect(
      getRankingPeriod("today", new Date("2026-09-05T15:00:00.000Z")).startsAt?.toISOString(),
    ).toBe("2026-09-05T15:00:00.000Z");
    expect(
      getRankingPeriod("week", new Date("2026-09-06T14:59:59.999Z")).startsAt?.toISOString(),
    ).toBe("2026-08-30T15:00:00.000Z");
    expect(
      getRankingPeriod("week", new Date("2026-09-06T15:00:00.000Z")).startsAt?.toISOString(),
    ).toBe("2026-09-06T15:00:00.000Z");
  });

  it("연말과 윤년, all 경계를 처리한다", () => {
    expect(getRankingPeriod("today", new Date("2024-02-29T20:00:00Z")).endsAt?.toISOString()).toBe(
      "2024-03-01T15:00:00.000Z",
    );
    expect(getRankingPeriod("today", new Date("2026-12-31T20:00:00Z")).endsAt?.toISOString()).toBe(
      "2027-01-01T15:00:00.000Z",
    );
    expect(getRankingPeriod("all", new Date())).toMatchObject({ startsAt: null, endsAt: null });
  });
});
