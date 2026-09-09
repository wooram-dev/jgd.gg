const MAX_RETURN_TO_LENGTH = 512;
const FORBIDDEN_PREFIXES = ["/api", "/auth/error"];

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || value.length > MAX_RETURN_TO_LENGTH) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  const parsed = new URL(value, "https://jgd.invalid");
  if (
    FORBIDDEN_PREFIXES.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "/";
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
