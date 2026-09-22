import { titleRoute } from "@/features/title-shop/server/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return titleRoute(request, "read");
}
