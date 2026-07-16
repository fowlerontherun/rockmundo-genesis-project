const makeUuid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `uuid-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export function createStableMutationIdempotencyKey(
  scope: string,
  subjectId: string,
  uuid = makeUuid(),
) {
  return `${scope}:${subjectId}:${uuid}`;
}
