import { describe, expect, it, vi } from "vitest";
import {
  MarketplaceSecurityError,
  MarketplaceTransitionError,
  createContractOffer,
  createEmptyMarketplaceState,
  createMarketplaceListing,
  reviseContractOffer,
  transitionContract,
  transitionListing,
  type MarketplaceActor,
  type MarketplaceEntityRef,
} from "@/utils/marketplaceFramework";

const band: MarketplaceEntityRef = { type: "band", id: "band-1" };
const company: MarketplaceEntityRef = { type: "company", id: "company-1" };

const leader: MarketplaceActor = {
  playerId: "player-1",
  funds: 5000,
  roles: [
    {
      entity: band,
      role: "leader",
      permissions: ["listing:create", "listing:manage", "contract:create", "contract:negotiate", "contract:accept", "contract:cancel"],
    },
  ],
};

const manager: MarketplaceActor = {
  playerId: "player-2",
  funds: 10000,
  roles: [
    {
      entity: company,
      role: "manager",
      permissions: ["listing:create", "listing:manage", "contract:create", "contract:negotiate", "contract:accept", "contract:cancel"],
    },
  ],
};

const outsider: MarketplaceActor = { playerId: "player-3", roles: [] };

const fixedTerms = {
  paymentType: "fixed_price" as const,
  durationType: "one_off" as const,
  amount: 1200,
  currency: "RM$",
  deliverables: ["record guitar session"],
};

describe("marketplace framework", () => {
  it("records the listing lifecycle and prevents invalid transitions", () => {
    const state = createEmptyMarketplaceState();
    const listing = createMarketplaceListing(state, leader, { owner: band, kind: "session_musician", title: "Lead guitarist for hire", terms: fixedTerms });

    expect(listing.status).toBe("draft");
    transitionListing(state, leader, listing.id, "published");
    transitionListing(state, leader, listing.id, "paused");
    transitionListing(state, leader, listing.id, "published");
    transitionListing(state, leader, listing.id, "accepted");
    transitionListing(state, leader, listing.id, "completed");

    expect(state.history.map((event) => event.toStatus)).toEqual(["draft", "published", "paused", "published", "accepted", "completed"]);
    expect(() => transitionListing(state, leader, listing.id, "published")).toThrow(MarketplaceTransitionError);
  });

  it("validates delegated permissions server-side instead of trusting client ownership", () => {
    const state = createEmptyMarketplaceState();

    expect(() =>
      createMarketplaceListing(state, outsider, { owner: band, kind: "instrument_sale", title: "Vintage bass", terms: fixedTerms })
    ).toThrow(MarketplaceSecurityError);

    const listing = createMarketplaceListing(state, leader, { owner: band, kind: "instrument_sale", title: "Vintage bass", terms: fixedTerms });
    expect(() => transitionListing(state, outsider, listing.id, "published")).toThrow(MarketplaceSecurityError);
  });

  it("creates, negotiates, accepts, cancels and histories contract offers", () => {
    const state = createEmptyMarketplaceState();
    const contract = createContractOffer(state, leader, { from: band, to: company, terms: fixedTerms, templateId: "session-player-v1" });

    expect(contract.status).toBe("offer");
    expect(state.notifications).toContainEqual(expect.objectContaining({ channel: "messages", type: "contract.offer_created" }));

    reviseContractOffer(state, manager, contract.id, { ...fixedTerms, amount: 1500 });
    transitionContract(state, manager, contract.id, "accepted");
    transitionContract(state, leader, contract.id, "cancelled", "artist unavailable");

    expect(contract.revision).toBe(2);
    expect(state.history.map((event) => event.toStatus)).toEqual(["offer", "negotiating", "accepted", "cancelled"]);
    expect(state.reputationEvents).toContainEqual(expect.objectContaining({ type: "contract_cancelled", contractId: contract.id }));
  });

  it("checks funds and availability before commitments", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00Z"));
    const state = createEmptyMarketplaceState();
    const brokeActor: MarketplaceActor = { ...leader, funds: 100 };

    expect(() => createContractOffer(state, brokeActor, { from: band, to: company, terms: fixedTerms })).toThrow(MarketplaceSecurityError);

    const listing = createMarketplaceListing(state, leader, {
      owner: band,
      kind: "studio_booking",
      title: "Studio A evening slot",
      terms: fixedTerms,
      availability: { endsAt: "2026-07-12T23:59:59Z", capacity: 1, committed: 0 },
    });

    expect(() => transitionListing(state, leader, listing.id, "published")).toThrow(MarketplaceSecurityError);
    vi.useRealTimers();
  });

  it("emits notification and reputation integration hooks without duplicating those systems", () => {
    const state = createEmptyMarketplaceState();
    const contract = createContractOffer(state, leader, { from: band, to: company, terms: fixedTerms });

    transitionContract(state, manager, contract.id, "accepted");
    transitionContract(state, leader, contract.id, "completed");

    expect(state.notifications.some((event) => event.channel === "activity_feed" && event.type === "contract.accepted")).toBe(true);
    expect(state.reputationEvents).toEqual([expect.objectContaining({ type: "contract_succeeded", contractId: contract.id })]);
  });
});
