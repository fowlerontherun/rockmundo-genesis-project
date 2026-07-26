/** Empty or absent deployment secrets are never accepted. */
export function isTrustedFestivalWorkerRequest(request: Request, expectedSecret: string | undefined) {
  return Boolean(expectedSecret) && request.headers.get("x-worker-secret") === expectedSecret;
}
