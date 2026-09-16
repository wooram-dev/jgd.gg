import { z } from "zod";
import { ApiError } from "@/lib/http/api-error";

export function parseProfileQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const params = new URL(request.url).searchParams;
  if (new Set(params.keys()).size !== params.size) throw new ApiError(400, "VALIDATION_ERROR");
  const result = schema.safeParse(Object.fromEntries(params));
  if (!result.success) throw new ApiError(400, "VALIDATION_ERROR");
  return result.data;
}
