import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as authorizeMockDiscord } from "@/app/api/test/mock-discord/authorize/route";

import {
  exchangeMockDiscordCode,
  getMockDiscordUserInfo,
  issueMockDiscordCode,
} from "./mock-discord";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("E2E_AUTH_MODE", "mock-discord");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mock Discord OAuth", () => {
  it("PKCE와 일회성 code를 검증해 identify profile을 반환한다", async () => {
    const codeVerifier = "a".repeat(64);
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const redirectURI = "http://127.0.0.1:3000/api/auth/callback/discord";
    const code = issueMockDiscordCode({ codeChallenge, redirectUri: redirectURI });

    const tokens = await exchangeMockDiscordCode({ code, codeVerifier, redirectURI });
    expect(tokens.scopes).toEqual(["identify"]);
    await expect(getMockDiscordUserInfo(tokens)).resolves.toMatchObject({
      id: "175928847299117063",
      username: "e2e_player",
    });
    await expect(exchangeMockDiscordCode({ code, codeVerifier, redirectURI })).rejects.toThrow(
      "Invalid mock Discord authorization code",
    );
  });

  it("test mock 환경이 아니면 provider route와 code 발급을 닫는다", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_AUTH_MODE", "");
    const response = authorizeMockDiscord(
      new Request("https://jgd.gg/api/test/mock-discord/authorize"),
    );

    expect(response.status).toBe(404);
    expect(() => issueMockDiscordCode({ codeChallenge: "challenge", redirectUri: "/" })).toThrow(
      "Mock Discord OAuth is disabled",
    );
  });
});
