import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// These tests document the retry contract without invoking live player RPCs.
// The function-level integration test must additionally exercise a test DB.
function deterministicBonus(sessionId: string, date: string): Promise<number> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sessionId}:${date}:book-reading-v1`))
    .then((hash) => {
      const bytes = new Uint8Array(hash);
      return (((bytes[0] << 8) | bytes[1]) % 200) + 1;
    });
}

Deno.test("book reading bonus stays stable across retries", async () => {
  const first = await deterministicBonus("session-a", "2026-10-10");
  const retry = await deterministicBonus("session-a", "2026-10-10");
  assertEquals(first, retry);
  assertEquals(first >= 1 && first <= 200, true);
});

Deno.test("book reading bonus is bounded for different sessions and dates", async () => {
  for (const [session, day] of [["a", "2026-10-10"], ["b", "2026-10-10"], ["a", "2026-10-11"]]) {
    const bonus = await deterministicBonus(session, day);
    assertEquals(bonus >= 1 && bonus <= 200, true);
  }
});
