import { useCallback, useMemo, useRef, useState } from 'react';
import { createStableMutationIdempotencyKey } from './idempotencyKey';
export { createStableMutationIdempotencyKey } from './idempotencyKey';
export function useStableMutationIdempotencyKey(scope: string, subjectId: string, fingerprint = '') {
  const initial = useMemo(() => createStableMutationIdempotencyKey(scope, subjectId), [scope, subjectId]);
  const [key, setKey] = useState(initial); const fingerprintRef = useRef(fingerprint);
  if (fingerprintRef.current !== fingerprint) { fingerprintRef.current = fingerprint; setKey(createStableMutationIdempotencyKey(scope, subjectId)); }
  const regenerate = useCallback(() => setKey(createStableMutationIdempotencyKey(scope, subjectId)), [scope, subjectId]);
  return { idempotencyKey: key, regenerate, markSucceeded: regenerate, cancel: regenerate };
}
