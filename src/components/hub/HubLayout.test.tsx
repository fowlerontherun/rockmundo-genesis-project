import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Calendar, Heart, Users } from "lucide-react";

import { HubLayout, isHubNavigationItemActive, type HubNavigationItem } from "./HubLayout";

const characterItems: HubNavigationItem[] = [
  { id: "overview", label: "Overview", path: "/character", icon: Users, matchPaths: ["/character/overview", "/hub/character"] },
  { id: "wellness", label: "Wellness", path: "/wellness", icon: Heart, matchPaths: ["/character/wellness"] },
];

const renderHub = (route: string, items = characterItems) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <HubLayout title="Character" description="Character hub" icon={Users} overviewPath="/character" navigation={items}>
        <p>Hub content</p>
      </HubLayout>
    </MemoryRouter>,
  );

describe("HubLayout", () => {
  it("marks the exact overview route as current", () => {
    renderHub("/character?tab=summary");

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Wellness" })).not.toHaveAttribute("aria-current");
  });

  it("matches nested and legacy child routes", () => {
    expect(isHubNavigationItemActive("/wellness/recovery", characterItems[1])).toBe(true);
    expect(isHubNavigationItemActive("/character/wellness", characterItems[1])).toBe(true);
    expect(isHubNavigationItemActive("/character", characterItems[1])).toBe(false);
  });

  it("renders logical breadcrumbs from hub metadata", () => {
    renderHub("/wellness");

    expect(screen.getByRole("navigation", { name: "Hub breadcrumb" })).toHaveTextContent("Character");
    expect(screen.getByRole("navigation", { name: "Hub breadcrumb" })).toHaveTextContent("Wellness");
  });

  it("renders mobile-visible horizontal child navigation", () => {
    renderHub("/schedule", [
      { id: "overview", label: "Overview", path: "/schedule", icon: Calendar },
      { id: "education", label: "Education", path: "/booking/education", icon: Calendar },
    ]);

    expect(screen.getByRole("navigation", { name: "Character pages" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Education" })).toBeVisible();
  });
});
