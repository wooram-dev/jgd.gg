import { describe, expect, it } from "vitest";

import { completeGameSchema, emptyBodySchema } from "./api";

const validEvents = Array.from({ length: 25 }, (_, index) => ({
  value: index + 1,
  elapsedMs: (index + 1) * 120,
}));

describe("number-click API schemas", () => {
  it("빈 object만 empty body로 허용한다", () => {
    expect(emptyBodySchema.safeParse({}).success).toBe(true);
    expect(emptyBodySchema.safeParse({ extra: true }).success).toBe(false);
  });

  it("유효한 완료 payload를 허용한다", () => {
    expect(
      completeGameSchema.safeParse({ clientElapsedMs: 3_000, events: validEvents }).success,
    ).toBe(true);
  });

  it.each([
    { clientElapsedMs: 3_000, events: validEvents, finalMs: 3_000 },
    { clientElapsedMs: -1, events: validEvents },
    { clientElapsedMs: 600_001, events: validEvents },
    { clientElapsedMs: 3_000.5, events: validEvents },
    { clientElapsedMs: 3_000, events: validEvents.slice(0, 24) },
    {
      clientElapsedMs: 3_000,
      events: [...validEvents, ...validEvents, ...validEvents, ...validEvents, validEvents[0]],
    },
    {
      clientElapsedMs: 3_000,
      events: [{ ...validEvents[0], value: 0 }, ...validEvents.slice(1)],
    },
    {
      clientElapsedMs: 3_000,
      events: [{ ...validEvents[0], elapsedMs: 3_001 }, ...validEvents.slice(1)],
    },
  ])("경계 또는 알 수 없는 완료 입력을 거부한다", (payload) => {
    expect(completeGameSchema.safeParse(payload).success).toBe(false);
  });
});
