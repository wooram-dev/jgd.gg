import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";

import { ApiError, type ValidationDetail } from "./api-error";

export function assertSameOrigin(request: Request): void {
  const configuredOrigin = new URL(getServerEnv().BETTER_AUTH_URL).origin;
  const origin = request.headers.get("origin");

  if (
    (process.env.NODE_ENV === "production" && origin === null) ||
    (origin && origin !== configuredOrigin)
  ) {
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED");
  }
}

function zodDetails(error: z.ZodError): ValidationDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    reason: issue.message,
  }));
}

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maximumBytes: number,
): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maximumBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR");
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", zodDetails(result.error));
  }
  return result.data;
}

export function parsePathUuid(value: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", [
      { path: "sessionId", reason: "UUID여야 합니다." },
    ]);
  }
  return result.data;
}
