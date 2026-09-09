const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function getRequestId(request: Request): string {
  const inbound = request.headers.get("x-request-id");
  return inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : crypto.randomUUID();
}
