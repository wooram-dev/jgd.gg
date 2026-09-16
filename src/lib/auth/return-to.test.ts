import { describe, expect, it } from "vitest";

import { sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("안전한 내부 경로의 query와 fragment를 유지한다", () => {
    expect(sanitizeReturnTo("/games/number-click?mode=official#board")).toBe(
      "/games/number-click?mode=official#board",
    );
  });

  it.each(["/내정보#game-profile", "/멤버"])("한글 내부 경로 %s를 보존한다", (path) => {
    expect(sanitizeReturnTo(path)).toBe(encodeURI(path));
    expect(sanitizeReturnTo(encodeURI(path))).toBe(encodeURI(path));
  });

  it.each([
    "https://evil.example",
    "//evil.example/path",
    "/\\evil",
    "/api/auth/callback/discord",
    "/auth/error",
  ])("위험한 returnTo %s를 root로 바꾼다", (value) => {
    expect(sanitizeReturnTo(value)).toBe("/");
  });

  it("빈 값과 길이 상한 초과를 홈으로 보낸다", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo(undefined)).toBe("/");
    expect(sanitizeReturnTo(`/${"a".repeat(512)}`)).toBe("/");
  });

  it("API와 auth error 하위 경로도 거부한다", () => {
    expect(sanitizeReturnTo("/api/v1/records")).toBe("/");
    expect(sanitizeReturnTo("/auth/error/provider")).toBe("/");
  });
});
