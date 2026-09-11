import { isMockDiscordEnabled } from "@/lib/auth/mock-discord";
import { ApiError } from "@/lib/http/api-error";

export const E2E_NOW_HEADER = "x-jgd-e2e-now";

export function getRequestNow(
  request: Request,
  environment: { NODE_ENV?: string; E2E_AUTH_MODE?: string } = process.env,
): Date | undefined {
  if (!isMockDiscordEnabled(environment)) {
    return undefined;
  }

  const raw = request.headers.get(E2E_NOW_HEADER);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== raw) {
    throw new ApiError(400, "VALIDATION_ERROR");
  }
  return parsed;
}
