import { describe, expect, it } from "vitest";
import { adminCategories } from "@/components/admin/AdminNav";

describe("Top of the Pops admin demo access", () => {
  it("is exposed from the Events & Competitions admin navigation", () => {
    const events = adminCategories.find((category) => category.id === "events");
    expect(events?.items).toContainEqual(expect.objectContaining({
      path: "/admin/top-of-the-pops",
      label: "Top of the Pops / Demo",
    }));
  });
});
