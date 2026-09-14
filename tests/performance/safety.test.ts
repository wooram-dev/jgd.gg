import { describe, expect, it } from "vitest";
import { assertOwnedPerformanceSchema, performanceTarget, percentile } from "./safety";

describe("performance isolation", () => {
  const testUrl = "postgresql://fixture:fixture@localhost/jgd_test";
  it("명시된 로컬 테스트 DB에 새 schema만 허용하며 입력 options를 버린다", () => {
    const target = performanceTarget(
      `${testUrl}?options=-csearch_path=public&schema=public`,
      "postgresql://localhost/jgd",
      "true",
    );
    expect(target.schema).toMatch(/^jgd_perf_[0-9a-f]{32}$/);
    expect(target.url.searchParams.get("options")).not.toContain("public");
    expect(target.schema).not.toBe(performanceTarget(testUrl, undefined, "true").schema);
  });
  it("일반/원격 DB, 승인 flag 부재와 개발 DB의 주소 별칭을 거부한다", () => {
    for (const url of [
      "postgresql://localhost/jgd",
      "postgresql://remote.invalid/jgd_test",
      "https://localhost/jgd_test",
    ]) {
      expect(() => performanceTarget(url, undefined, "true")).toThrow();
    }
    expect(() => performanceTarget(testUrl, undefined, undefined)).toThrow();
    expect(() => performanceTarget(undefined, undefined, "true")).toThrow();
    expect(() =>
      performanceTarget(testUrl, "postgresql://127.0.0.1:5432/jgd_test?schema=public", "true"),
    ).toThrow();
  });
  it("cleanup 전에 실제 DB와 이 실행의 정확한 schema를 확인한다", () => {
    const { schema } = performanceTarget(testUrl, undefined, "true");
    expect(() =>
      assertOwnedPerformanceSchema("jgd_test", schema, "jgd_test", schema),
    ).not.toThrow();
    for (const [database, namespace, expected] of [
      ["jgd", schema, schema],
      ["jgd_test", "public", schema],
      ["jgd_test", "public", "public"],
    ]) {
      expect(() =>
        assertOwnedPerformanceSchema(database, namespace, "jgd_test", expected),
      ).toThrow();
    }
  });
  it("잘못된 URL 오류에도 입력 자격 증명을 포함하지 않는다", () => {
    for (const [test, development] of [
      ["postgresql://fixture:private@broken host/jgd_test", undefined],
      [testUrl, "postgresql://fixture:private@broken host/jgd"],
    ]) {
      expect(() => performanceTarget(test, development, "true")).toThrow(
        "Invalid database URL configuration.",
      );
    }
  });
  it("p95는 정렬한 sample의 nearest-rank이며 입력을 바꾸지 않는다", () => {
    const samples = [4, 2, 3, 1];
    expect(percentile(samples, 0.95)).toBe(4);
    expect(percentile(samples, 0.5)).toBe(2);
    expect(samples).toEqual([4, 2, 3, 1]);
    expect(() => percentile([], 0.95)).toThrow();
  });
});
