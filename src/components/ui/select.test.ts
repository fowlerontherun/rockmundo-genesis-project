// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/ui/select.tsx", "utf8");

describe("SelectContent long-list viewport", () => {
  it("does not constrain popper menus to the trigger height", () => {
    expect(source).not.toContain('h-[var(--radix-select-trigger-height)]');
    expect(source).toContain('--radix-select-content-available-height');
  });
});
