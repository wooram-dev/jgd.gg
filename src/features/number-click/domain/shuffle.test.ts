import { describe, expect, it } from "vitest";

import { assertNumberClickBoard, shuffleNumberClickBoard } from "./shuffle";

describe("shuffleNumberClickBoard", () => {
  it("1부터 25를 중복 없이 1000회 생성한다", () => {
    let seed = 0x1234_5678;
    const randomIndex = (upperExclusive: number) => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed % upperExclusive;
    };

    for (let run = 0; run < 1_000; run += 1) {
      const board = shuffleNumberClickBoard(randomIndex);
      expect(board).toHaveLength(25);
      expect([...board].sort((left, right) => left - right)).toEqual(
        Array.from({ length: 25 }, (_, index) => index + 1),
      );
    }
  });

  it("random index 경계 0과 i를 허용한다", () => {
    expect(shuffleNumberClickBoard(() => 0)).toHaveLength(25);
    expect(shuffleNumberClickBoard((upperExclusive) => upperExclusive - 1)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
  });

  it("범위를 벗어난 random index를 거부한다", () => {
    expect(() => shuffleNumberClickBoard((upperExclusive) => upperExclusive)).toThrow(RangeError);
    expect(() => shuffleNumberClickBoard(() => 0.5)).toThrow(RangeError);
  });

  it.each([
    [[]],
    [Array.from({ length: 25 }, () => 1)],
    [[...Array.from({ length: 24 }, (_, index) => index + 1), 25.5]],
  ])("유효하지 않은 board를 거부한다", (invalidBoard) => {
    expect(() => assertNumberClickBoard(invalidBoard)).toThrow(
      "Number-click board must be a permutation of 1 through 25.",
    );
  });
});
