import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("deferred Media Networks prototype (#4276)", () => {
  it("does not mount, import or advertise demo media earnings as a real business", () => {
    expect(app).not.toMatch(/lazyWithRetry\(\(\) => import\(["']\.\/pages\/MediaNetworks["']\)\)/);
    expect(app).not.toMatch(/<MediaNetworks\b/);
    expect(app).not.toMatch(/path=["']\/media-networks(?:\/|["'])/);
  });
});
