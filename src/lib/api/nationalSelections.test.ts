import { afterEach, describe, expect, it } from "bun:test";

import { getActiveNationalSelectionYear, triggerNationalSelections } from "./nationalSelections";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("nationalSelections api", () => {
  it("calls the random selection endpoint for the provided year", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    global.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
      calls.push({ url: url.toString(), options });
      return new Response("{}", { status: 200 });
    };

    await triggerNationalSelections(2030);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/national-selections/2030/random-selection");
    expect(calls[0]?.options?.method).toBe("POST");
  });

  it("raises a descriptive error when the selection endpoint fails", async () => {
    global.fetch = async () => new Response(JSON.stringify({ message: "boom" }), { status: 500 });

    await expect(triggerNationalSelections(2031)).rejects.toThrow("boom");
  });

  it("returns the active year from the api response", async () => {
    global.fetch = async () => new Response(JSON.stringify({ activeYear: 2029 }), { status: 200 });

    const year = await getActiveNationalSelectionYear();
    expect(year).toBe(2029);
  });
});
