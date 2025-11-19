import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import type { CryptoToken } from "@/hooks/useUnderworld";

const memoryStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {},
};

// Provide a localStorage shim before loading modules that expect it.
// @ts-expect-error - bun types do not include this shim override
if (!globalThis.localStorage) globalThis.localStorage = memoryStorage;

const underworldModule = await import("../UnderworldNew");
const { UnderworldContent, formatPrice, getDisplayTokens, placeholderTokens } = underworldModule;

describe("Underworld helpers", () => {
  test("formats price with two decimals", () => {
    expect(formatPrice(1234.5)).toBe("$1,234.50");
  });

  test("falls back to placeholder tokens when none are provided", () => {
    const display = getDisplayTokens([]);
    expect(display).toHaveLength(placeholderTokens.length);
    expect(display[0].symbol).toBe("VEIL");
  });
});

describe("UnderworldContent", () => {
  const demoTokens: CryptoToken[] = [
    {
      id: "test",
      symbol: "TST",
      name: "Test Token",
      current_price: 10,
      volume_24h: 100000,
      market_cap: 1000000,
      price_history: [
        { timestamp: "2024-11-01", price: 9 },
        { timestamp: "2024-11-05", price: 10 },
      ],
      created_at: "2024-11-01",
      updated_at: "2024-11-05",
    },
  ];

  test("renders anchor sections for navigation", () => {
    const html = renderToString(<UnderworldContent tokens={demoTokens} tokensLoading={false} />);
    expect(html).toContain("id=\"market\"");
    expect(html).toContain("id=\"merch\"");
    expect(html).toContain("id=\"actions\"");
  });
});
