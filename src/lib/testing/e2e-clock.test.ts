import { afterEach, describe, expect, it, vi } from "vitest";

import { E2E_NOW_HEADER, getRequestNow } from "./e2e-clock";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("E2E request clock", () => {
  it("mock Discord test server에서만 ISO 시각을 허용한다", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_AUTH_MODE", "mock-discord");
    const now = "2026-09-11T00:00:04.000Z";

    expect(
      getRequestNow(new Request("http://localhost", { headers: { [E2E_NOW_HEADER]: now } })),
    ).toEqual(new Date(now));
  });

  it("production에서는 test header를 무시한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_AUTH_MODE", "");

    expect(
      getRequestNow(
        new Request("https://jgd.gg", {
          headers: { [E2E_NOW_HEADER]: "2026-09-11T00:00:04.000Z" },
        }),
      ),
    ).toBeUndefined();
  });

  it("활성화된 test 환경의 잘못된 시각을 거부한다", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_AUTH_MODE", "mock-discord");

    expect(() =>
      getRequestNow(
        new Request("http://localhost", { headers: { [E2E_NOW_HEADER]: "not-a-date" } }),
      ),
    ).toThrowError(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});
