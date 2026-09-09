import { ApiError } from "./api-error";
import { apiFailure, internalApiFailure } from "./response";

type RouteOperation = () => Promise<Response>;

export async function handleApiRoute(
  requestId: string,
  operation: RouteOperation,
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) {
      return apiFailure(error, requestId);
    }

    console.error(
      JSON.stringify({
        level: "error",
        event: "api.unhandled_error",
        requestId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return internalApiFailure(requestId);
  }
}
