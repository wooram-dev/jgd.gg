import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { prismaAdapter } from "@better-auth/prisma-adapter";

import { getDatabase } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env/server";

import { mapDiscordProfile } from "./discord-profile";
import {
  exchangeMockDiscordCode,
  getMockDiscordUserInfo,
  isMockDiscordEnabled,
} from "./mock-discord";

const BLOCKED_MUTATION_PATHS = new Set([
  "/update-user",
  "/change-email",
  "/change-password",
  "/set-password",
  "/delete-user",
  "/link-social",
  "/unlink-account",
  "/sign-up/email",
  "/sign-in/email",
]);

function createJgdAuth() {
  const environment = getServerEnv();
  const secure = environment.NODE_ENV === "production";
  const mockDiscord = isMockDiscordEnabled(environment);

  return betterAuth({
    appName: "JGD.GG",
    baseURL: environment.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: environment.BETTER_AUTH_SECRET,
    database: prismaAdapter(getDatabase(), { provider: "postgresql" }),
    trustedOrigins: [new URL(environment.BETTER_AUTH_URL).origin],
    emailAndPassword: { enabled: false },
    socialProviders: mockDiscord
      ? {}
      : {
          discord: {
            clientId: environment.DISCORD_CLIENT_ID,
            clientSecret: environment.DISCORD_CLIENT_SECRET,
            disableDefaultScope: true,
            scope: ["identify"],
            overrideUserInfoOnSignIn: true,
            mapProfileToUser: (profile) => mapDiscordProfile(profile),
          },
        },
    plugins: mockDiscord
      ? [
          genericOAuth({
            config: [
              {
                providerId: "discord",
                name: "Discord",
                clientId: environment.DISCORD_CLIENT_ID,
                clientSecret: environment.DISCORD_CLIENT_SECRET,
                authorizationUrl: `${new URL(environment.BETTER_AUTH_URL).origin}/api/test/mock-discord/authorize`,
                accountIssuer: "local:oauth:discord",
                scopes: ["identify"],
                pkce: true,
                overrideUserInfo: true,
                getToken: (input) => exchangeMockDiscordCode(input, environment),
                getUserInfo: (tokens) => getMockDiscordUserInfo(tokens, environment),
                mapProfileToUser: (profile) => mapDiscordProfile(profile),
              },
            ],
          }),
        ]
      : [],
    user: {
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
      additionalFields: {
        discordUsername: { type: "string", required: true, input: true },
        discordDisplayName: { type: "string", required: true, input: true },
        discordAvatarHash: { type: "string", required: false, input: true },
        profileUpdatedAt: { type: "date", required: true, input: true },
        status: {
          type: ["ACTIVE", "BANNED"],
          required: true,
          defaultValue: "ACTIVE",
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    account: {
      identityStrategy: "provider-id",
      updateAccountOnSignIn: true,
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      storeAccountCookie: false,
    },
    advanced: {
      database: { generateId: "uuid", joins: true },
      defaultCookieAttributes: {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (BLOCKED_MUTATION_PATHS.has(context.path)) {
          throw new APIError("FORBIDDEN", { message: "지원하지 않는 계정 작업입니다." });
        }
      }),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({
            data: { ...session, ipAddress: null, userAgent: null },
          }),
        },
      },
      account: {
        create: {
          before: async (account) => ({
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
              accessTokenExpiresAt: null,
              refreshTokenExpiresAt: null,
              scope: account.providerId === "discord" ? "identify" : null,
            },
          }),
        },
        update: {
          before: async (account) => ({
            data: {
              ...account,
              accessToken: null,
              refreshToken: null,
              idToken: null,
              accessTokenExpiresAt: null,
              refreshTokenExpiresAt: null,
              scope: account.providerId === "discord" ? "identify" : account.scope,
            },
          }),
        },
      },
    },
  });
}

let authInstance: ReturnType<typeof createJgdAuth> | undefined;

export function getAuth(): ReturnType<typeof createJgdAuth> {
  authInstance ??= createJgdAuth();
  return authInstance;
}

export async function getOptionalSession(headers: Headers) {
  return getAuth().api.getSession({ headers });
}
