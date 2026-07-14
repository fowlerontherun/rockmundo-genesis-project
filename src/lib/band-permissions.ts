export type BandPermissionRisk = "low" | "standard" | "sensitive" | "critical";
export type BandPermissionCategory =
  | "membership" | "scheduling" | "gigs_tours" | "creative" | "finance" | "publicity" | "merch" | "administration";

export type BandPermissionKey = (typeof BAND_PERMISSION_CATALOGUE)[number]["key"];

export interface BandPermissionDefinition {
  key: string;
  label: string;
  category: BandPermissionCategory;
  risk: BandPermissionRisk;
}

export const BAND_PERMISSION_CATALOGUE = [
  { key: "membership.view_roster", label: "View full member roster", category: "membership", risk: "low" },
  { key: "membership.invite_player", label: "Invite player", category: "membership", risk: "standard" },
  { key: "membership.review_applications", label: "Review applications", category: "membership", risk: "standard" },
  { key: "membership.send_offer", label: "Send membership offer", category: "membership", risk: "standard" },
  { key: "membership.remove_member", label: "Remove member", category: "membership", risk: "sensitive" },
  { key: "membership.approve_departure", label: "Approve member departure", category: "membership", risk: "sensitive" },
  { key: "membership.manage_trials", label: "Manage trial members", category: "membership", risk: "standard" },
  { key: "membership.change_positions", label: "Change musical positions", category: "membership", risk: "standard" },
  { key: "membership.assign_responsibilities", label: "Assign responsibilities", category: "membership", risk: "sensitive" },
  { key: "scheduling.create_rehearsal", label: "Create rehearsal", category: "scheduling", risk: "standard" },
  { key: "scheduling.edit_rehearsal", label: "Edit rehearsal", category: "scheduling", risk: "standard" },
  { key: "scheduling.cancel_rehearsal", label: "Cancel rehearsal", category: "scheduling", risk: "sensitive" },
  { key: "scheduling.create_jam", label: "Create jam session", category: "scheduling", risk: "standard" },
  { key: "scheduling.schedule_activity", label: "Schedule band activity", category: "scheduling", risk: "standard" },
  { key: "scheduling.manage_attendance", label: "Manage attendance", category: "scheduling", risk: "standard" },
  { key: "scheduling.view_private", label: "View private band schedule", category: "scheduling", risk: "low" },
  { key: "gigs.apply", label: "Apply for gig", category: "gigs_tours", risk: "standard" },
  { key: "gigs.accept", label: "Accept gig", category: "gigs_tours", risk: "sensitive" },
  { key: "gigs.decline", label: "Decline gig", category: "gigs_tours", risk: "sensitive" },
  { key: "gigs.prepare", label: "Create gig preparation", category: "gigs_tours", risk: "standard" },
  { key: "gigs.edit_setlist", label: "Edit setlist", category: "gigs_tours", risk: "standard" },
  { key: "tours.schedule", label: "Schedule tour", category: "gigs_tours", risk: "sensitive" },
  { key: "tours.edit", label: "Edit tour", category: "gigs_tours", risk: "standard" },
  { key: "tours.cancel", label: "Cancel tour", category: "gigs_tours", risk: "critical" },
  { key: "tours.book_transport", label: "Book transport", category: "gigs_tours", risk: "sensitive" },
  { key: "tours.book_accommodation", label: "Book accommodation", category: "gigs_tours", risk: "sensitive" },
  { key: "creative.propose_song", label: "Propose song", category: "creative", risk: "low" },
  { key: "creative.approve_song", label: "Approve band song", category: "creative", risk: "sensitive" },
  { key: "creative.manage_songwriting", label: "Manage songwriting session", category: "creative", risk: "standard" },
  { key: "creative.assign_contributors", label: "Assign song contributors", category: "creative", risk: "standard" },
  { key: "creative.approve_recording", label: "Approve recording", category: "creative", risk: "sensitive" },
  { key: "creative.select_studio", label: "Select recording studio", category: "creative", risk: "standard" },
  { key: "creative.approve_release", label: "Approve release", category: "creative", risk: "sensitive" },
  { key: "creative.manage_credits", label: "Manage credits", category: "creative", risk: "sensitive" },
  { key: "creative.manage_repertoire", label: "Manage repertoire", category: "creative", risk: "standard" },
  { key: "finance.view_summary", label: "View summary finances", category: "finance", risk: "standard" },
  { key: "finance.view_transactions", label: "View full transaction history", category: "finance", risk: "sensitive" },
  { key: "finance.approve_expense", label: "Approve expense", category: "finance", risk: "sensitive" },
  { key: "finance.make_payment", label: "Make payment", category: "finance", risk: "critical" },
  { key: "finance.set_spending_limits", label: "Set spending limits", category: "finance", risk: "critical" },
  { key: "finance.manage_revenue_splits", label: "Manage revenue splits", category: "finance", risk: "critical" },
  { key: "finance.manage_budget", label: "Manage band budget", category: "finance", risk: "sensitive" },
  { key: "finance.purchase_equipment", label: "Purchase equipment", category: "finance", risk: "sensitive" },
  { key: "finance.sell_assets", label: "Sell band assets", category: "finance", risk: "sensitive" },
  { key: "publicity.edit_profile", label: "Edit band profile", category: "publicity", risk: "low" },
  { key: "publicity.post_updates", label: "Post band updates", category: "publicity", risk: "standard" },
  { key: "publicity.manage_twaater", label: "Manage Twaater account", category: "publicity", risk: "standard" },
  { key: "publicity.manage_campaigns", label: "Manage publicity campaigns", category: "publicity", risk: "standard" },
  { key: "publicity.update_recruitment", label: "Update recruitment status", category: "publicity", risk: "standard" },
  { key: "publicity.manage_fans", label: "Manage fan communications", category: "publicity", risk: "standard" },
  { key: "merch.create", label: "Create merchandise", category: "merch", risk: "standard" },
  { key: "merch.set_prices", label: "Set prices", category: "merch", risk: "sensitive" },
  { key: "merch.order_stock", label: "Order stock", category: "merch", risk: "sensitive" },
  { key: "merch.manage_inventory", label: "Manage inventory", category: "merch", risk: "standard" },
  { key: "merch.view_finances", label: "View merch finances", category: "merch", risk: "sensitive" },
  { key: "admin.manage_roles", label: "Manage roles", category: "administration", risk: "sensitive" },
  { key: "admin.manage_permissions", label: "Manage permissions", category: "administration", risk: "critical" },
  { key: "admin.transfer_ownership", label: "Transfer ownership", category: "administration", risk: "critical" },
  { key: "admin.change_settings", label: "Change band settings", category: "administration", risk: "sensitive" },
  { key: "admin.disband", label: "Disband band", category: "administration", risk: "critical" },
  { key: "admin.view_audit", label: "View audit history", category: "administration", risk: "sensitive" },
] as const satisfies readonly BandPermissionDefinition[];

export interface BandRoleTemplate {
  roleType: string;
  name: string;
  description: string;
  protected: boolean;
  primaryLeadership: boolean;
  permissions: BandPermissionKey[];
}

const allOperational: BandPermissionKey[] = BAND_PERMISSION_CATALOGUE
  .filter((p) => p.risk !== "critical")
  .map((p) => p.key);
const memberBase: BandPermissionKey[] = [
  "membership.view_roster",
  "scheduling.view_private",
  "creative.propose_song",
];

const perms = (...keys: BandPermissionKey[]): BandPermissionKey[] => keys;

export const DEFAULT_BAND_ROLE_TEMPLATES: BandRoleTemplate[] = [
  { roleType: "founder", name: "Founder", description: "Historical creator marker; not permanently authoritative by itself.", protected: true, primaryLeadership: false, permissions: memberBase },
  { roleType: "band_leader", name: "Band leader", description: "Broad active operational control without ownership-transfer powers.", protected: true, primaryLeadership: true, permissions: allOperational },
  { roleType: "co_leader", name: "Co-leader", description: "Shared leadership for sensitive operations and day-to-day control.", protected: false, primaryLeadership: true, permissions: allOperational.filter((k) => !k.startsWith("finance.view_transactions")) },
  { roleType: "manager", name: "Manager", description: "Recruitment, scheduling, gigs, tours and publicity without ownership or unrestricted finance.", protected: false, primaryLeadership: false, permissions: allOperational.filter((k) => !k.startsWith("finance.") || (["finance.view_summary", "finance.manage_budget"] as BandPermissionKey[]).includes(k)) },
  { roleType: "musical_director", name: "Musical director", description: "Repertoire, setlists, song approvals, rehearsal planning and recording preparation.", protected: false, primaryLeadership: false, permissions: perms("creative.approve_song", "creative.manage_songwriting", "creative.assign_contributors", "creative.select_studio", "creative.manage_repertoire", "gigs.edit_setlist", "scheduling.create_rehearsal", "scheduling.edit_rehearsal") },
  { roleType: "recruitment_manager", name: "Recruitment manager", description: "Vacancies, applications, invitations and trial-member management.", protected: false, primaryLeadership: false, permissions: perms("membership.invite_player", "membership.review_applications", "membership.send_offer", "membership.manage_trials", "publicity.update_recruitment") },
  { roleType: "booking_manager", name: "Booking manager", description: "Gig applications, offer responses, venue communication and tour scheduling.", protected: false, primaryLeadership: false, permissions: perms("gigs.apply", "gigs.accept", "gigs.decline", "gigs.prepare", "tours.schedule", "tours.edit") },
  { roleType: "tour_manager", name: "Tour manager", description: "Tour planning, logistics, transport, accommodation and attendance coordination.", protected: false, primaryLeadership: false, permissions: perms("tours.schedule", "tours.edit", "tours.book_transport", "tours.book_accommodation", "scheduling.manage_attendance") },
  { roleType: "finance_manager", name: "Finance manager", description: "Reports, budgets, expense approval and limited payments; no ownership control.", protected: false, primaryLeadership: false, permissions: perms("finance.view_summary", "finance.view_transactions", "finance.approve_expense", "finance.manage_budget", "finance.purchase_equipment") },
  { roleType: "recording_manager", name: "Recording manager", description: "Recording approvals, studios, sessions and release preparation.", protected: false, primaryLeadership: false, permissions: perms("creative.approve_recording", "creative.select_studio", "creative.approve_release", "creative.manage_credits") },
  { roleType: "songwriting_coordinator", name: "Songwriting coordinator", description: "Song pipeline, collaboration sessions and contributor assignments.", protected: false, primaryLeadership: false, permissions: perms("creative.propose_song", "creative.manage_songwriting", "creative.assign_contributors") },
  { roleType: "publicity_manager", name: "Publicity manager", description: "Public profile, social posts, campaigns, gigs, releases and fan announcements.", protected: false, primaryLeadership: false, permissions: perms("publicity.edit_profile", "publicity.post_updates", "publicity.manage_twaater", "publicity.manage_campaigns", "publicity.update_recruitment", "publicity.manage_fans") },
  { roleType: "merch_manager", name: "Merch manager", description: "Products, sale prices, stock orders, inventory and merch performance.", protected: false, primaryLeadership: false, permissions: perms("merch.create", "merch.set_prices", "merch.order_stock", "merch.manage_inventory", "merch.view_finances") },
  { roleType: "member", name: "Member", description: "Ordinary member access to roster, private schedule and creative proposals.", protected: false, primaryLeadership: false, permissions: memberBase },
  { roleType: "trial_member", name: "Trial member", description: "Limited rehearsal and internal access while under review.", protected: false, primaryLeadership: false, permissions: perms("scheduling.view_private", "creative.propose_song") },
];

const riskWeight: Record<BandPermissionRisk, number> = { low: 1, standard: 2, sensitive: 3, critical: 4 };
export const permissionByKey: Map<BandPermissionKey, (typeof BAND_PERMISSION_CATALOGUE)[number]> = new Map(BAND_PERMISSION_CATALOGUE.map((permission) => [permission.key, permission]));

export interface EffectivePermissionInput {
  isOwner?: boolean;
  isActiveMember?: boolean;
  isSuspended?: boolean;
  rolePermissions?: string[];
  temporaryPermissions?: Array<{ key: string; expiresAt?: string | Date | null }>;
  overrides?: Array<{ key: string; effect: "allow" | "deny"; expiresAt?: string | Date | null }>;
  now?: Date;
}

export interface EffectivePermissionResult {
  allowed: Set<string>;
  denied: Set<string>;
  sources: Record<string, string[]>;
}

function isActiveExpiry(value: string | Date | null | undefined, now: Date) {
  if (!value) return true;
  const expires = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(expires.getTime()) && expires > now;
}

export class BandPermissionService {
  static resolveEffectivePermissions(input: EffectivePermissionInput): EffectivePermissionResult {
    const now = input.now ?? new Date();
    const allowed = new Set<string>();
    const denied = new Set<string>();
    const sources: Record<string, string[]> = {};
    const add = (key: string, source: string) => {
      if (!permissionByKey.has(key)) return;
      allowed.add(key);
      sources[key] = [...(sources[key] ?? []), source];
    };
    if (!input.isActiveMember || input.isSuspended) return { allowed, denied, sources };
    if (input.isOwner) BAND_PERMISSION_CATALOGUE.forEach((permission) => add(permission.key, "Band owner"));
    input.rolePermissions?.forEach((key) => add(key, "Assigned role"));
    input.temporaryPermissions?.filter((entry) => isActiveExpiry(entry.expiresAt, now)).forEach((entry) => add(entry.key, "Temporary delegation"));
    input.overrides?.filter((entry) => isActiveExpiry(entry.expiresAt, now)).forEach((entry) => {
      if (entry.effect === "deny") {
        allowed.delete(entry.key);
        denied.add(entry.key);
        sources[entry.key] = ["Direct deny override"];
      } else if (!denied.has(entry.key)) {
        add(entry.key, "Direct allow override");
      }
    });
    return { allowed, denied, sources };
  }

  static canGrant(granterPermissions: Iterable<string>, targetPermission: string, allowPeerGrant = false) {
    const granterRisks = [...granterPermissions].map((key) => permissionByKey.get(key)?.risk).filter(Boolean) as BandPermissionRisk[];
    const highest = Math.max(0, ...granterRisks.map((risk) => riskWeight[risk]));
    const targetRisk = permissionByKey.get(targetPermission)?.risk;
    if (!targetRisk) return false;
    const required = riskWeight[targetRisk];
    return allowPeerGrant ? highest >= required : highest > required;
  }
}
