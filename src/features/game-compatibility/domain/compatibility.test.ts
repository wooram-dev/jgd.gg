import { describe, expect, it } from "vitest";
import {
  AXES,
  QUESTIONS,
  TYPES,
  TYPE_CODES,
  calculateType,
  compareTypes,
  formatTypeSummary,
  isTypeCode,
} from "./compatibility";

describe("게임 성향 분류", () => {
  it("네 축의 세 문항과 서로 다른 이름의 16유형을 제공한다", () => {
    expect(QUESTIONS).toHaveLength(12);
    AXES.forEach((_, index) => expect(QUESTIONS.filter((q) => q.axis === index)).toHaveLength(3));
    expect(TYPE_CODES).toHaveLength(16);
    expect(new Set(Object.values(TYPES).map((type) => type.name)).size).toBe(16);
  });

  it("가능한 4096개 응답을 축별 다수결로 결정하고 선택 근거를 일치시킨다", () => {
    const seen = new Set<string>();
    for (let mask = 0; mask < 4096; mask++) {
      const answers = Array.from({ length: 12 }, (_, index) => (mask >> index) & 1);
      const result = calculateType(answers);
      let expectedCode = "";
      for (let axis = 0; axis < 4; axis++) {
        const secondVotes = answers[axis] + answers[axis + 4] + answers[axis + 8];
        expectedCode += ["RF", "PI", "TS", "VQ"][axis][secondVotes >= 2 ? 1 : 0];
        expect(result.axes[axis].votes).toBe(Math.max(secondVotes, 3 - secondVotes));
      }
      expect(result.code).toBe(expectedCode);
      expect(calculateType(answers)).toEqual(result);
      seen.add(result.code);
    }
    expect(seen.size).toBe(16);
  });

  it.each([
    [],
    Array(11).fill(0),
    Array(13).fill(0),
    Array(12).fill(null),
    Array(12).fill(2),
    Array(12).fill("0"),
    Array(12).fill(false),
    new Array(12),
  ])("불완전하거나 잘못된 응답을 거부한다 (%#)", (answers) => {
    expect(() => calculateType(answers)).toThrow();
  });

  it("모든 유형 쌍에서 네 축을 비교하고 순서에 무관한 일치 수를 반환한다", () => {
    for (const mine of TYPE_CODES) {
      for (const friend of TYPE_CODES) {
        const result = compareTypes(mine, friend);
        expect(result).toHaveLength(4);
        expect(result.filter((axis) => axis.same).length).toBe(
          compareTypes(friend, mine).filter((axis) => axis.same).length,
        );
        result.forEach((axis, index) => {
          expect(axis.same).toBe(mine[index] === friend[index]);
          expect(axis.mine).toBe(compareTypes(friend, mine)[index].friend);
          expect(axis.prompt).not.toBe("");
        });
      }
    }
    expect(compareTypes("RPTV", "RPTV").every((axis) => axis.same)).toBe(true);
    expect(compareTypes("RPTV", "FISQ").every((axis) => !axis.same)).toBe(true);
  });

  it("외부 유형 선택을 검증하고 자신의 결과와 친구 비교를 구별해 복사한다", () => {
    expect(isTypeCode("RPTV")).toBe(true);
    for (const code of ["", "ENTP", "rptv", "constructor", "__proto__", "RPTV "])
      expect(isTypeCode(code)).toBe(false);
    const own = formatTypeSummary("RPTV", null);
    expect(own).toContain("RPTV · 작전 짜는 파티장");
    expect(own).not.toContain("친구:");
    expect(formatTypeSummary("RPTV", "FISQ")).toContain("같은 성향 0/4개");
    expect(formatTypeSummary("RPTV", "RPTV")).toContain("같은 성향 4/4개");
  });
});
