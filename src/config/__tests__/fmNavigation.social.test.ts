import { describe, expect, it } from "vitest";
import { isHubNavigationItemActive } from "@/components/hub/HubLayout";
import { socialHubNavigation } from "../hubNavigation";
import { FM_MODULES } from "../fmNavigation";

const item = (id: string) => socialHubNavigation.find((entry) => entry.id === id)!;

describe("social hub navigation", () => {
  it("uses /social as the stable top-level landing route", () => {
    const socialModule = FM_MODULES.find((module) => module.id === "social");

    expect(socialModule?.rootPath).toBe("/social");
    expect(socialModule?.subTabs[0]?.path).toBe("/social");
    expect(isHubNavigationItemActive("/social", item("overview"))).toBe(true);
  });

  it("selects the correct Social child for canonical routes and legacy aliases", () => {
    expect(isHubNavigationItemActive("/social/friends", item("friends"))).toBe(true);
    expect(isHubNavigationItemActive("/relationships", item("friends"))).toBe(true);
    expect(isHubNavigationItemActive("/social/players", item("players"))).toBe(true);
    expect(isHubNavigationItemActive("/player/abc", item("players"))).toBe(true);
    expect(isHubNavigationItemActive("/social/messages", item("messages"))).toBe(true);
    expect(isHubNavigationItemActive("/twaater/messages", item("messages"))).toBe(true);
    expect(isHubNavigationItemActive("/twaater/twaat/abc", item("twaater"))).toBe(true);
    expect(isHubNavigationItemActive("/bands/finder", item("recruitment"))).toBe(true);
    expect(isHubNavigationItemActive("/social/invitations", item("invitations"))).toBe(true);
  });
});
