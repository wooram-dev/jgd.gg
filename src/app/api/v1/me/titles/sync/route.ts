import { titleRoute } from "@/features/title-shop/server/route";
export const runtime = "nodejs";
export function POST(request: Request) {
  return titleRoute(request, "sync");
}
