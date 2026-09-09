import { ApiError } from "./api-error";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export function apiSuccess<T>(
  data: T,
  requestId: string,
  options: { status?: number; meta?: Record<string, unknown> } = {},
): Response {
  return Response.json(
    {
      data,
      meta: { requestId, ...options.meta },
    },
    { status: options.status ?? 200, headers: NO_STORE_HEADERS },
  );
}

export function apiFailure(error: ApiError, requestId: string): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      meta: { requestId },
    },
    { status: error.status, headers: NO_STORE_HEADERS },
  );
}

export function internalApiFailure(requestId: string): Response {
  return apiFailure(new ApiError(500, "INTERNAL_ERROR"), requestId);
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
