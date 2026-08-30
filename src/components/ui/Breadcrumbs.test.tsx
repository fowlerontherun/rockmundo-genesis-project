import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Breadcrumbs, usesHubBreadcrumbs } from "./Breadcrumbs";

const renderBreadcrumbs = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Breadcrumbs />
    </MemoryRouter>,
  );

describe("Breadcrumbs", () => {
  it.each([
    "/band/members",
    "/band/settings/",
    "/schedule/week",
    "/schedule/history?from=2026-08-01",
  ])("defers %s to HubLayout's logical breadcrumb", (route) => {
    const pathname = route.split("?")[0];
    expect(usesHubBreadcrumbs(pathname)).toBe(true);

    renderBreadcrumbs(route);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  it("keeps the shell breadcrumb for non-hub deep routes", () => {
    expect(usesHubBreadcrumbs("/social/friends")).toBe(false);

    renderBreadcrumbs("/social/friends");
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("SocialFriends");
  });
});
