import { getServerEnv } from "@/lib/env/server";
import { isMockDiscordEnabled, issueMockDiscordCode } from "@/lib/auth/mock-discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function invalidRequest(message: string): Response {
  return Response.json(
    { error: message },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export function GET(request: Request): Response {
  if (process.env.E2E_AUTH_MODE !== "mock-discord") {
    return new Response(null, { status: 404 });
  }

  const environment = getServerEnv();
  if (!isMockDiscordEnabled(environment)) {
    return new Response(null, { status: 404 });
  }
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const redirectUri = requestUrl.searchParams.get("redirect_uri");
  const codeChallenge = requestUrl.searchParams.get("code_challenge");
  const expectedRedirectUri = `${new URL(environment.BETTER_AUTH_URL).origin}/api/auth/callback/discord`;
  const scopes = (requestUrl.searchParams.get("scope") ?? "").split(/\s+/).filter(Boolean);

  if (
    requestUrl.searchParams.get("client_id") !== environment.DISCORD_CLIENT_ID ||
    requestUrl.searchParams.get("response_type") !== "code" ||
    requestUrl.searchParams.get("code_challenge_method") !== "S256" ||
    !state ||
    !codeChallenge ||
    redirectUri !== expectedRedirectUri ||
    scopes.length !== 1 ||
    scopes[0] !== "identify"
  ) {
    return invalidRequest("Invalid mock Discord authorization request.");
  }

  const code = issueMockDiscordCode({ codeChallenge, redirectUri }, environment);
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", state);
  return Response.redirect(callbackUrl, 302);
}
