import { vi } from 'vitest';

// Install before test modules import application hooks. This client never creates
// a connection, reads credentials or invokes a live database/edge function.
vi.mock('@/integrations/supabase/client', () => {
  const query = (single = false): unknown => new Proxy({}, {
    get: (_target, key) => key === 'then'
      ? Promise.resolve({ data: single ? null : [], error: null, count: 0 }).then.bind(Promise.resolve({ data: single ? null : [], error: null, count: 0 }))
      : () => query(key === 'single' || key === 'maybeSingle' || single),
  });
  return { supabase: {
    from: () => query(), rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  } };
});

Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: () => Promise.reject(new Error('Network disabled in stage-model tests; mock external data explicitly.')) });
