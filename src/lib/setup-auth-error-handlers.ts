import { handleInvalidRefreshTokenError, isInvalidRefreshTokenError } from "./auth-error-handlers";

type GlobalWithAuthHandler = typeof globalThis & {
  __supabaseInvalidRefreshHandler__?: boolean;
};

const globalScope = globalThis as GlobalWithAuthHandler;

if (typeof window !== "undefined" && !globalScope.__supabaseInvalidRefreshHandler__) {
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;

    if (!isInvalidRefreshTokenError(reason)) {
      return;
    }

    event.preventDefault();
    void handleInvalidRefreshTokenError(reason);
  };

  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  globalScope.__supabaseInvalidRefreshHandler__ = true;
}
