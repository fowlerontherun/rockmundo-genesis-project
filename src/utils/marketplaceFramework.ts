export type MarketplaceEntityType =
  | "player"
  | "band"
  | "company"
  | "venue"
  | "festival"
  | "studio"
  | "organisation"
  | "npc"
  | (string & {});

export interface MarketplaceEntityRef {
  type: MarketplaceEntityType;
  id: string;
}

export type MarketplaceActorRole = "owner" | "leader" | "manager" | "organiser" | "delegate";

export interface MarketplaceActor {
  playerId: string;
  funds?: number;
  roles: Array<{ entity: MarketplaceEntityRef; role: MarketplaceActorRole; permissions: MarketplacePermission[] }>;
}

export type MarketplacePermission =
  | "listing:create"
  | "listing:manage"
  | "listing:accept"
  | "contract:create"
  | "contract:negotiate"
  | "contract:accept"
  | "contract:cancel";

export type ListingStatus = "draft" | "published" | "hidden" | "paused" | "accepted" | "completed" | "cancelled" | "expired";
export type ContractStatus = "offer" | "negotiating" | "accepted" | "completed" | "cancelled" | "expired" | "historical";
export type ContractPaymentType =
  | "fixed_price"
  | "salary"
  | "revenue_share"
  | "royalty_percentage"
  | "commission"
  | "recurring_payment";
export type ContractDurationType = "one_off" | "time_based_employment" | "ongoing_agreement";

export interface ContractTerms {
  paymentType: ContractPaymentType;
  durationType: ContractDurationType;
  amount?: number;
  percentage?: number;
  currency?: string;
  startsAt?: string;
  endsAt?: string;
  recurrence?: "daily" | "weekly" | "monthly";
  deliverables?: string[];
}

export interface ContractTemplate {
  id: string;
  name: string;
  category: string;
  defaultTerms: ContractTerms;
  requiredPermissions?: MarketplacePermission[];
}

export interface MarketplaceListing {
  id: string;
  kind: string;
  owner: MarketplaceEntityRef;
  createdBy: string;
  status: ListingStatus;
  title: string;
  terms: ContractTerms;
  availability?: { startsAt?: string; endsAt?: string; capacity?: number; committed?: number };
  createdAt: string;
  updatedAt: string;
}

export interface ContractOffer {
  id: string;
  listingId?: string;
  templateId?: string;
  from: MarketplaceEntityRef;
  to: MarketplaceEntityRef;
  terms: ContractTerms;
  status: ContractStatus;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceHistoryEvent {
  id: string;
  targetType: "listing" | "contract" | "negotiation";
  targetId: string;
  fromStatus?: ListingStatus | ContractStatus;
  toStatus: ListingStatus | ContractStatus;
  actorId: string;
  reason?: string;
  at: string;
}

export interface MarketplaceNotificationEvent {
  channel: "messages" | "notifications" | "activity_feed" | "social_hub";
  type: string;
  target: MarketplaceEntityRef;
  payload: Record<string, unknown>;
}

export interface ReputationHookEvent {
  type: "contract_succeeded" | "contract_cancelled" | "late_delivery" | "failed_work" | "reliability" | "professionalism" | "player_review";
  contractId: string;
  actors: MarketplaceEntityRef[];
  metadata?: Record<string, unknown>;
}

export interface MarketplaceState {
  listings: MarketplaceListing[];
  contracts: ContractOffer[];
  history: MarketplaceHistoryEvent[];
  notifications: MarketplaceNotificationEvent[];
  reputationEvents: ReputationHookEvent[];
}

export class MarketplaceSecurityError extends Error {}
export class MarketplaceTransitionError extends Error {}

const listingTransitions: Record<ListingStatus, ListingStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["hidden", "paused", "accepted", "cancelled", "expired"],
  hidden: ["published", "cancelled", "expired"],
  paused: ["published", "cancelled", "expired"],
  accepted: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  expired: [],
};

const contractTransitions: Record<ContractStatus, ContractStatus[]> = {
  offer: ["negotiating", "accepted", "cancelled", "expired"],
  negotiating: ["offer", "accepted", "cancelled", "expired"],
  accepted: ["completed", "cancelled"],
  completed: ["historical"],
  cancelled: ["historical"],
  expired: ["historical"],
  historical: [],
};

const sameEntity = (a: MarketplaceEntityRef, b: MarketplaceEntityRef) => a.type === b.type && a.id === b.id;
const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export function hasMarketplacePermission(actor: MarketplaceActor, entity: MarketplaceEntityRef, permission: MarketplacePermission): boolean {
  return actor.roles.some((role) => sameEntity(role.entity, entity) && role.permissions.includes(permission));
}

export function assertMarketplacePermission(actor: MarketplaceActor, entity: MarketplaceEntityRef, permission: MarketplacePermission): void {
  if (!hasMarketplacePermission(actor, entity, permission)) {
    throw new MarketplaceSecurityError(`Player ${actor.playerId} is not authorised to ${permission} for ${entity.type}:${entity.id}`);
  }
}

export function validateAvailability(listing: MarketplaceListing): void {
  const { availability } = listing;
  if (!availability) return;
  if (availability.endsAt && new Date(availability.endsAt).getTime() < Date.now()) throw new MarketplaceSecurityError("Listing availability has expired");
  if (availability.capacity !== undefined && (availability.committed ?? 0) >= availability.capacity) throw new MarketplaceSecurityError("Listing has no remaining availability");
}

export function validateFunds(actor: MarketplaceActor, terms: ContractTerms): void {
  const required = terms.amount ?? 0;
  if (required > 0 && actor.funds !== undefined && actor.funds < required) throw new MarketplaceSecurityError("Actor has insufficient funds");
}

function pushHistory(state: MarketplaceState, targetType: MarketplaceHistoryEvent["targetType"], targetId: string, toStatus: ListingStatus | ContractStatus, actorId: string, fromStatus?: ListingStatus | ContractStatus, reason?: string) {
  state.history.push({ id: id("hist"), targetType, targetId, fromStatus, toStatus, actorId, reason, at: nowIso() });
}

export function createMarketplaceListing(state: MarketplaceState, actor: MarketplaceActor, input: Omit<MarketplaceListing, "id" | "createdBy" | "status" | "createdAt" | "updatedAt"> & { status?: ListingStatus }): MarketplaceListing {
  assertMarketplacePermission(actor, input.owner, "listing:create");
  const at = nowIso();
  const listing: MarketplaceListing = { ...input, id: id("list"), createdBy: actor.playerId, status: input.status ?? "draft", createdAt: at, updatedAt: at };
  state.listings.push(listing);
  pushHistory(state, "listing", listing.id, listing.status, actor.playerId, undefined, "created");
  return listing;
}

export function transitionListing(state: MarketplaceState, actor: MarketplaceActor, listingId: string, toStatus: ListingStatus, reason?: string): MarketplaceListing {
  const listing = state.listings.find((item) => item.id === listingId);
  if (!listing) throw new MarketplaceTransitionError("Listing not found");
  assertMarketplacePermission(actor, listing.owner, "listing:manage");
  if (!listingTransitions[listing.status].includes(toStatus)) throw new MarketplaceTransitionError(`Cannot move listing from ${listing.status} to ${toStatus}`);
  if (toStatus === "published" || toStatus === "accepted") validateAvailability(listing);
  const from = listing.status;
  listing.status = toStatus;
  listing.updatedAt = nowIso();
  pushHistory(state, "listing", listing.id, toStatus, actor.playerId, from, reason);
  state.notifications.push({ channel: "notifications", type: `listing.${toStatus}`, target: listing.owner, payload: { listingId } });
  return listing;
}

export function createContractOffer(state: MarketplaceState, actor: MarketplaceActor, input: Omit<ContractOffer, "id" | "createdBy" | "status" | "revision" | "createdAt" | "updatedAt"> & { status?: ContractStatus }): ContractOffer {
  assertMarketplacePermission(actor, input.from, "contract:create");
  validateFunds(actor, input.terms);
  const at = nowIso();
  const contract: ContractOffer = { ...input, id: id("contract"), createdBy: actor.playerId, status: input.status ?? "offer", revision: 1, createdAt: at, updatedAt: at };
  state.contracts.push(contract);
  pushHistory(state, "contract", contract.id, contract.status, actor.playerId, undefined, "created");
  state.notifications.push({ channel: "messages", type: "contract.offer_created", target: input.to, payload: { contractId: contract.id } });
  return contract;
}

export function reviseContractOffer(state: MarketplaceState, actor: MarketplaceActor, contractId: string, terms: ContractTerms): ContractOffer {
  const contract = state.contracts.find((item) => item.id === contractId);
  if (!contract) throw new MarketplaceTransitionError("Contract not found");
  if (!hasMarketplacePermission(actor, contract.from, "contract:negotiate") && !hasMarketplacePermission(actor, contract.to, "contract:negotiate")) throw new MarketplaceSecurityError("Actor cannot negotiate this contract");
  contract.terms = terms;
  contract.revision += 1;
  const from = contract.status;
  contract.status = "negotiating";
  contract.updatedAt = nowIso();
  pushHistory(state, "negotiation", contract.id, "negotiating", actor.playerId, from, "revised");
  return contract;
}

export function transitionContract(state: MarketplaceState, actor: MarketplaceActor, contractId: string, toStatus: ContractStatus, reason?: string): ContractOffer {
  const contract = state.contracts.find((item) => item.id === contractId);
  if (!contract) throw new MarketplaceTransitionError("Contract not found");
  const permission: MarketplacePermission = toStatus === "accepted" ? "contract:accept" : toStatus === "cancelled" ? "contract:cancel" : "contract:create";
  if (!hasMarketplacePermission(actor, contract.from, permission) && !hasMarketplacePermission(actor, contract.to, permission)) throw new MarketplaceSecurityError(`Actor cannot ${toStatus} this contract`);
  if (!contractTransitions[contract.status].includes(toStatus)) throw new MarketplaceTransitionError(`Cannot move contract from ${contract.status} to ${toStatus}`);
  const from = contract.status;
  contract.status = toStatus;
  contract.updatedAt = nowIso();
  pushHistory(state, "contract", contract.id, toStatus, actor.playerId, from, reason);
  if (toStatus === "accepted") state.notifications.push({ channel: "activity_feed", type: "contract.accepted", target: contract.from, payload: { contractId } });
  if (toStatus === "completed") state.reputationEvents.push({ type: "contract_succeeded", contractId, actors: [contract.from, contract.to] });
  if (toStatus === "cancelled") state.reputationEvents.push({ type: "contract_cancelled", contractId, actors: [contract.from, contract.to], metadata: { reason } });
  return contract;
}

export function createEmptyMarketplaceState(): MarketplaceState {
  return { listings: [], contracts: [], history: [], notifications: [], reputationEvents: [] };
}
