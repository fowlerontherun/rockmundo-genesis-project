import { useCallback, useEffect, useReducer, useRef } from "react";
import { createStableMutationIdempotencyKey } from "./idempotencyKey";

export { createStableMutationIdempotencyKey } from "./idempotencyKey";

interface KeyState {
  material: string;
  key: string;
}

type KeyAction =
  | {
      type: "materialChanged";
      material: string;
      scope: string;
      subjectId: string;
    }
  | { type: "regenerate"; scope: string; subjectId: string };

function materialFor(scope: string, subjectId: string, fingerprint: string) {
  return `${scope}\u001f${subjectId}\u001f${fingerprint}`;
}

function createState(
  scope: string,
  subjectId: string,
  fingerprint: string,
): KeyState {
  return {
    material: materialFor(scope, subjectId, fingerprint),
    key: createStableMutationIdempotencyKey(scope, subjectId),
  };
}

function reducer(state: KeyState, action: KeyAction): KeyState {
  if (action.type === "materialChanged") {
    if (state.material === action.material) return state;
    return {
      material: action.material,
      key: createStableMutationIdempotencyKey(action.scope, action.subjectId),
    };
  }

  return {
    ...state,
    key: createStableMutationIdempotencyKey(action.scope, action.subjectId),
  };
}

export function useStableMutationIdempotencyKey(
  scope: string,
  subjectId: string,
  fingerprint = "",
) {
  const initialRef = useRef<KeyState | null>(null);
  if (!initialRef.current)
    initialRef.current = createState(scope, subjectId, fingerprint);

  const [state, dispatch] = useReducer(reducer, initialRef.current);
  const material = materialFor(scope, subjectId, fingerprint);

  useEffect(() => {
    dispatch({ type: "materialChanged", material, scope, subjectId });
  }, [material, scope, subjectId]);

  const regenerate = useCallback(
    () => dispatch({ type: "regenerate", scope, subjectId }),
    [scope, subjectId],
  );

  return {
    idempotencyKey:
      state.material === material ? state.key : initialRef.current.key,
    regenerate,
    markSucceeded: regenerate,
    cancel: regenerate,
  };
}
