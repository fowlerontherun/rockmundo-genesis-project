// Simplified local replacement for deno_std@0.168.0/http/server.ts
// Provides a minimal `serve` helper compatible with Supabase edge functions.

export interface ServeInit {
  port?: number;
  hostname?: string;
  signal?: AbortSignal;
  onListen?: (params: { hostname: string; port: number }) => void;
}

export type ServeHandler = (request: Request) => Response | Promise<Response>;

/**
 * Minimal `serve` implementation that delegates to the Deno native server when available.
 * This keeps the runtime behaviour close to the original helper while allowing local
 * type-checking without pulling the full deno_std dependency tree.
 */
export function serve(handler: ServeHandler, init: ServeInit = {}): void {
  const { port = 8000, hostname = "0.0.0.0", signal, onListen } = init;

  if (typeof onListen === "function") {
    try {
      onListen({ hostname, port });
    } catch (_error) {
      // ignore listener errors – behaviour matches deno_std which swallows them
    }
  }

  if (typeof globalThis.Deno === "object" && typeof globalThis.Deno?.serve === "function") {
    globalThis.Deno.serve({ hostname, port, signal }, handler);
    return;
  }

  throw new Error("Deno global with serve() is required to run this function");
}
