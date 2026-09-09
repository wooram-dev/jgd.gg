import { describe, expect, it } from "vitest";

import { formatScore } from "./format-score";

describe("formatScore", () => {
  it.each([
    [14_370, "14.37초"],
    [14_375, "14.38초"],
    [0, "0.00초"],
    [62_350, "1:02.35"],
  ])("%i ms를 %s로 표시한다", (value, expected) => {
    expect(formatScore(value)).toBe(expected);
  });

  it.each([-1, Number.POSITIVE_INFINITY, Number.NaN])("잘못된 시간 %s를 거부한다", (value) => {
    expect(() => formatScore(value)).toThrow(RangeError);
  });
});
