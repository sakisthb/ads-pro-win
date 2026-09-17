/** Private connector/operator data must not reuse browser HTTP-cache responses. */
export function fetchPrivateApi(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  return fetch(input, { ...options, credentials: "include", cache: "no-store" });
}
