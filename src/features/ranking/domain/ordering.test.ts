import { describe, expect, it } from "vitest";

import { compareRankedRecords, selectBestRecord } from "./ordering";

const base = {
  finalMs: 10_000,
  mistakeCount: 1,
  achievedAt: new Date("2026-09-06T00:00:00Z"),
  id: "b",
};

describe("ranking ordering", () => {
  it("final, mistake, achievedAt, id 순으로 정렬한다", () => {
    expect(compareRankedRecords({ ...base, finalMs: 9_999 }, base)).toBeLessThan(0);
    expect(compareRankedRecords({ ...base, mistakeCount: 0 }, base)).toBeLessThan(0);
    expect(
      compareRankedRecords({ ...base, achievedAt: new Date("2026-09-05T23:59:59Z") }, base),
    ).toBeLessThan(0);
    expect(compareRankedRecords({ ...base, id: "a" }, base)).toBeLessThan(0);
  });

  it("사용자의 최고 기록 한 건을 고른다", () => {
    const records = [{ ...base }, { ...base, id: "a" }, { ...base, finalMs: 11_000, id: "c" }];
    expect(selectBestRecord(records)?.id).toBe("a");
    expect(selectBestRecord([])).toBeNull();
  });

  it("모든 정렬 키가 같으면 comparator가 0을 반환한다", () => {
    expect(compareRankedRecords(base, { ...base })).toBe(0);
  });
});
