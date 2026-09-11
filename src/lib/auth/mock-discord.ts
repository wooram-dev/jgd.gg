import { createHash, randomUUID } from "node:crypto";

type MockAuthorizationGrant = {
  codeChallenge: string;
  redirectUri: string;
  expiresAt: number;
};

type MockDiscordProfile = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  email: string;
  emailVerified: boolean;
};

type MockEnvironment = {
  NODE_ENV?: string;
  E2E_AUTH_MODE?: string;
};

const DEFAULT_PROFILE: MockDiscordProfile = {
  id: "175928847299117063",
  username: "e2e_player",
  global_name: "E2E Player",
  avatar: null,
  email: "must-not-be-stored@example.test",
  emailVerified: true,
};

const globalMockOAuth = globalThis as typeof globalThis & {
  jgdMockDiscordGrants?: Map<string, MockAuthorizationGrant>;
  jgdMockDiscordTokens?: Map<string, MockDiscordProfile>;
};

function getGrantStore(): Map<string, MockAuthorizationGrant> {
  globalMockOAuth.jgdMockDiscordGrants ??= new Map();
  return globalMockOAuth.jgdMockDiscordGrants;
}

function getTokenStore(): Map<string, MockDiscordProfile> {
  globalMockOAuth.jgdMockDiscordTokens ??= new Map();
  return globalMockOAuth.jgdMockDiscordTokens;
}

function removeExpiredGrants(now = Date.now()): void {
  for (const [code, grant] of getGrantStore()) {
    if (grant.expiresAt <= now) getGrantStore().delete(code);
  }
}

export function isMockDiscordEnabled(environment: MockEnvironment = process.env): boolean {
  return environment.NODE_ENV === "test" && environment.E2E_AUTH_MODE === "mock-discord";
}

export function issueMockDiscordCode(
  input: {
    codeChallenge: string;
    redirectUri: string;
  },
  environment: MockEnvironment = process.env,
): string {
  if (!isMockDiscordEnabled(environment)) {
    throw new Error("Mock Discord OAuth is disabled.");
  }
  removeExpiredGrants();
  const code = randomUUID();
  getGrantStore().set(code, {
    codeChallenge: input.codeChallenge,
    redirectUri: input.redirectUri,
    expiresAt: Date.now() + 60_000,
  });
  return code;
}

export async function exchangeMockDiscordCode(
  input: {
    code: string;
    redirectURI: string;
    codeVerifier?: string;
  },
  environment: MockEnvironment = process.env,
) {
  if (!isMockDiscordEnabled(environment)) {
    throw new Error("Mock Discord OAuth is disabled.");
  }
  removeExpiredGrants();
  const grant = getGrantStore().get(input.code);
  getGrantStore().delete(input.code);
  if (!grant || !input.codeVerifier || grant.redirectUri !== input.redirectURI) {
    throw new Error("Invalid mock Discord authorization code.");
  }

  const actualChallenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
  if (actualChallenge !== grant.codeChallenge) {
    throw new Error("Invalid mock Discord PKCE verifier.");
  }

  const accessToken = randomUUID();
  getTokenStore().set(accessToken, DEFAULT_PROFILE);
  return {
    accessToken,
    refreshToken: randomUUID(),
    accessTokenExpiresAt: new Date(Date.now() + 60_000),
    scopes: ["identify"],
  };
}

export async function getMockDiscordUserInfo(
  tokens: { accessToken?: string },
  environment: MockEnvironment = process.env,
) {
  if (!isMockDiscordEnabled(environment) || !tokens.accessToken) return null;
  const profile = getTokenStore().get(tokens.accessToken) ?? null;
  getTokenStore().delete(tokens.accessToken);
  return profile;
}
