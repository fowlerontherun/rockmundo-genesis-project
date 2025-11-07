export type FestivalOwnerType = "admin" | "player";

export interface FestivalTrack {
  id: string;
  ownerType: FestivalOwnerType;
  title: string;
  summary: string;
  coreBeats: string[];
  automationHighlights: string[];
  uniqueSystems: string[];
}

export interface FestivalSizeTier {
  id: "local" | "small" | "medium" | "large";
  label: string;
  capacityCap: number;
  dayRange: [number, number];
  staffLevel: "low" | "moderate" | "high" | "very high";
  recommendedTicketPrice: [number, number];
  difficulty: string;
  baseActsPerDay: number;
  description: string;
}

export interface FestivalLicenseDetail {
  sizeTier: FestivalSizeTier["id"];
  unlockCost: number;
  annualRenewal: number;
  oneOffStaffingCost: number;
  notes: string;
}

export interface FestivalCostProfile {
  sizeTier: FestivalSizeTier["id"];
  oneOffStaffing: number;
  securityPerDay: number;
  insuranceFlat: number;
  stagePerDay: number;
  wastePermits: number;
  marketingFlat: number;
}

export interface ProfitAndLossStream {
  id: string;
  title: string;
  description: string;
  levers: string[];
}

export interface FestivalPricingTier {
  category: "food" | "drink" | "merch";
  tier: "cheap" | "standard" | "pricey";
  spendPerHead: number;
  attachRateModifier: number;
  notes: string;
}

export interface FestivalDemandFactor {
  id: string;
  label: string;
  description: string;
  weight: number;
  notes?: string;
}

export interface FestivalSystemInterplay {
  id: string;
  title: string;
  description: string;
  impact: string;
}

export interface FestivalLifecycleBeat {
  id: string;
  title: string;
  description: string;
  outcomes: string[];
}

export interface FestivalDataModelTable {
  name: string;
  description: string;
  keyFields: string[];
  scope: "core" | "booking" | "operations" | "reporting";
}

export interface FestivalApiEndpoint {
  method: "GET" | "POST" | "PATCH";
  path: string;
  description: string;
  focus: "admin" | "player" | "shared";
}

export interface FestivalBackgroundJob {
  id: string;
  cadence: string;
  description: string;
}

export interface FestivalCalculatorSummary {
  id: string;
  title: string;
  summary: string;
  keyInputs: string[];
}

export const festivalTracks: FestivalTrack[] = [
  {
    id: "national-catalogue",
    ownerType: "admin",
    title: "Admin: National Festival Catalogue",
    summary:
      "Pre-seeded flagships recur every season, carrying brand prestige, canonical slots, and curated sponsor pools managed by GMs.",
    coreBeats: [
      "Create the festival shell with recurrence (RRULE) and canonical city/venue settings.",
      "Define size tier, brand fame, and popularity to drive booking priorities and fee guidance.",
      "Publish booking window to auto-dispatch invites to top-aligned bands with elastic fee suggestions.",
    ],
    automationHighlights: [
      "Auto-invite scripts use proximity + fame filters to keep line-ups era-appropriate.",
      "Sponsor bundles rotate seasonally with sentiment bias baked into forecasts.",
      "Historical brand fame updates based on Festival Score to fuel leaderboards.",
    ],
    uniqueSystems: [
      "Canonical schedule anchors world timeline for routing conflicts and Twaater coverage.",
      "Admin override tools for weather, disputes, and emergency settlements.",
      "Balance sheet editor to tweak cost coefficients live without patching clients.",
    ],
  },
  {
    id: "player-owned",
    ownerType: "player",
    title: "Player: Licensed Festival Entrepreneurship",
    summary:
      "Players unlock licenses, curate venues, and orchestrate every lever of profitability from lineup strategy to price elasticity.",
    coreBeats: [
      "Buy a license by size tier, then pay the one-off staffing outlay before planning begins.",
      "Set city, venue, days, and acts-per-day to open the booking board and send tailored invitations.",
      "Lock lineup, run the event through hourly ticks, and review full P&L with Next Year Preview recommendations.",
    ],
    automationHighlights: [
      "Booking console surfaces fee guidance per slot with demand attribution logic.",
      "Pricing console recomputes demand in real time across tickets and F&B/merch tiers.",
      "Reports auto-build retention, sentiment, and sponsor uplift suggestions for the next edition.",
    ],
    uniqueSystems: [
      "Licensing and renewals gate festival growth while keeping staffing pressure realistic.",
      "Twaater hype loops with schedule beats for announcements, lineup drops, and day recaps.",
      "Multi-year brand evolution adjusts future capacity targets and sponsor appetite.",
    ],
  },
];

export const festivalSizeTiers: FestivalSizeTier[] = [
  {
    id: "local",
    label: "Local",
    capacityCap: 1500,
    dayRange: [1, 2],
    staffLevel: "low",
    recommendedTicketPrice: [10, 15],
    difficulty: "Neighborhood pop-up; ideal for emerging promoters.",
    baseActsPerDay: 4,
    description: "Lower stakes events that prioritize community buzz, DIY staging, and lean staffing.",
  },
  {
    id: "small",
    label: "Small",
    capacityCap: 8000,
    dayRange: [1, 3],
    staffLevel: "moderate",
    recommendedTicketPrice: [25, 40],
    difficulty: "Regional draw requiring thoughtful sponsor fits and marketing spend.",
    baseActsPerDay: 6,
    description: "Adds complexity with multi-day schedules, moderate crew, and more sensitive pricing.",
  },
  {
    id: "medium",
    label: "Medium",
    capacityCap: 25000,
    dayRange: [2, 3],
    staffLevel: "high",
    recommendedTicketPrice: [60, 85],
    difficulty: "Established festival brand balancing big-name bookings with profitability.",
    baseActsPerDay: 8,
    description: "Demands serious sponsor work, layered production, and weather mitigation planning.",
  },
  {
    id: "large",
    label: "Large",
    capacityCap: 85000,
    dayRange: [3, 4],
    staffLevel: "very high",
    recommendedTicketPrice: [90, 130],
    difficulty: "Flagship experiences with high risk/high reward stakes across every system.",
    baseActsPerDay: 10,
    description: "Massive footprint with national media coverage, intricate routing locks, and layered sentiment management.",
  },
];

export const festivalLicenseDetails: FestivalLicenseDetail[] = [
  {
    sizeTier: "local",
    unlockCost: 2500,
    annualRenewal: 500,
    oneOffStaffingCost: 2000,
    notes: "Entry license intended for community promoters and early-stage crews.",
  },
  {
    sizeTier: "small",
    unlockCost: 12000,
    annualRenewal: 2000,
    oneOffStaffingCost: 10000,
    notes: "Unlocks moderate sponsor interest and early national press coverage.",
  },
  {
    sizeTier: "medium",
    unlockCost: 45000,
    annualRenewal: 6000,
    oneOffStaffingCost: 40000,
    notes: "Serious operations with crew contracts, risk management, and multi-channel marketing.",
  },
  {
    sizeTier: "large",
    unlockCost: 150000,
    annualRenewal: 15000,
    oneOffStaffingCost: 120000,
    notes: "Mega festival credentials; expect stringent sponsor negotiations and compliance reviews.",
  },
];

export const festivalCostProfiles: FestivalCostProfile[] = [
  {
    sizeTier: "local",
    oneOffStaffing: 2000,
    securityPerDay: 1000,
    insuranceFlat: 1000,
    stagePerDay: 1500,
    wastePermits: 500,
    marketingFlat: 1000,
  },
  {
    sizeTier: "small",
    oneOffStaffing: 10000,
    securityPerDay: 6000,
    insuranceFlat: 5000,
    stagePerDay: 8000,
    wastePermits: 3000,
    marketingFlat: 6000,
  },
  {
    sizeTier: "medium",
    oneOffStaffing: 40000,
    securityPerDay: 25000,
    insuranceFlat: 18000,
    stagePerDay: 30000,
    wastePermits: 10000,
    marketingFlat: 25000,
  },
  {
    sizeTier: "large",
    oneOffStaffing: 120000,
    securityPerDay: 80000,
    insuranceFlat: 60000,
    stagePerDay: 95000,
    wastePermits: 30000,
    marketingFlat: 90000,
  },
];

export const profitStreams: ProfitAndLossStream[] = [
  {
    id: "tickets",
    title: "Ticketing",
    description: "Elastic pricing across cheap, standard, and pricey policies with demand curves anchored to size-tier recommendations.",
    levers: [
      "Base capacity per tier plus venue modifiers drives the ceiling for sales.",
      "Pricing policy influences F_price and subsequently the Day Demand index.",
      "Season passes, VIP upsells, and resident discounts plug into ticket_price with separate attach rates.",
    ],
  },
  {
    id: "fnb",
    title: "Food & Beverage",
    description: "Per-head spend blended with attach rate modifiers to calculate F&B gross and COGS.",
    levers: [
      "Tier choice shifts spend per attendee: £6/£10/£14 for food, £8/£12/£17 for drink.",
      "Attach rates adjust by ~8% each tier movement to encourage smart pricing combos.",
      "Tents and rain mitigation can preserve attach rates when weather forecast is poor.",
    ],
  },
  {
    id: "merch",
    title: "Merchandise",
    description: "Festival-branded and artist-commission structures share infrastructure but have different COGS (approx 30%).",
    levers: [
      "Attach rate declines ~6% per tier increase; bundling with VIP perks mitigates drop-off.",
      "Exclusive designs tied to sponsor activations can add other_income and sentiment boosts.",
      "Weather and hype feed into merch impulse purchases via the same D_day multiplier.",
    ],
  },
  {
    id: "sponsors",
    title: "Sponsorship",
    description: "Fit scores, cash vs in-kind value, and exclusivity toggles plug directly into sponsor_income and sentiment bias.",
    levers: [
      "Exclusive deals increase cash but amplify negative sentiment if fit_score is low.",
      "Stacking conflicting sponsors suffers diminishing returns via sentiment dampening.",
      "High Festival Scores open access to richer sponsor pools in subsequent years.",
    ],
  },
  {
    id: "operations",
    title: "Operations & Fixed Costs",
    description: "Staffing, security, insurance, stage rental, waste, permits, and marketing roll into ops_total.",
    levers: [
      "Size-tier coefficients feed calculators; admin tools can rebalance mid-season.",
      "Sponsor contra reduces ops_total when activations offset expenses (e.g., staging).",
      "Weather mitigation (tents, drainage) adds to ops_total but protects attendance and sentiment.",
    ],
  },
];

export const pricingTiers: FestivalPricingTier[] = [
  { category: "food", tier: "cheap", spendPerHead: 6, attachRateModifier: 1.05, notes: "Street-food style vendors and community stalls." },
  { category: "food", tier: "standard", spendPerHead: 10, attachRateModifier: 1, notes: "Balanced mix of vendors and price points." },
  { category: "food", tier: "pricey", spendPerHead: 14, attachRateModifier: 0.9, notes: "Premium culinary curation that slightly narrows reach." },
  { category: "drink", tier: "cheap", spendPerHead: 8, attachRateModifier: 1.08, notes: "Happy-hour style pricing keeps queues flowing." },
  { category: "drink", tier: "standard", spendPerHead: 12, attachRateModifier: 1, notes: "Baseline assumption for most simulations." },
  { category: "drink", tier: "pricey", spendPerHead: 17, attachRateModifier: 0.88, notes: "Craft cocktails & mixology pop-ups elevate experience at cost." },
  { category: "merch", tier: "cheap", spendPerHead: 5, attachRateModifier: 1.02, notes: "Sticker packs and essentials optimized for volume." },
  { category: "merch", tier: "standard", spendPerHead: 8, attachRateModifier: 1, notes: "Balanced mix of apparel and collectibles." },
  { category: "merch", tier: "pricey", spendPerHead: 12, attachRateModifier: 0.94, notes: "Limited runs, artist collabs, and premium bundles." },
];

export const demandFactors: FestivalDemandFactor[] = [
  {
    id: "hype",
    label: "F_hype",
    description: "Normalized hype score (0-1) sourced from Twaater mentions, press cycles, and lineup cadence.",
    weight: 0.35,
    notes: "Announcement posts, lineup drops, and pricing changes all trigger Twaater hooks to influence hype.",
  },
  {
    id: "lineup",
    label: "F_lineup",
    description: "Weighted sum of band fame^α multiplied by slot weights and style match per day.",
    weight: 0.45,
    notes: "Headline slots contribute ~28% of attribution with diminishing returns down the bill.",
  },
  {
    id: "price",
    label: "F_price",
    description: "Elasticity curve comparing ticket_price to tier recommendation (cheap boost, pricey penalty).",
    weight: 0.1,
    notes: "Cheap pricing adds up to +10% demand (capped) while pricey subtracts up to -18%.",
  },
  {
    id: "sentiment",
    label: "F_sentiment",
    description: "Composite of sponsor sentiment, historical satisfaction, and current price sentiment.",
    weight: 0.15,
    notes: "Exclusive sponsor deals can swing sentiment ±0.15 based on bias and fit score.",
  },
  {
    id: "weather",
    label: "F_weather",
    description: "Per-day modifier: sun (+0.06), cloud (0), rain (-0.08), storm (-0.15).",
    weight: 0.06,
    notes: "Weather mitigation upgrades add +0.04 buffer against rain/storm penalties.",
  },
];

export const systemsInterplay: FestivalSystemInterplay[] = [
  {
    id: "weather-performance",
    title: "Weather ↔ Performance",
    description: "Weather seeds set expectations days ahead; poor conditions reduce attendance and can dampen performance sentiment.",
    impact: "Investing in cover or shifting stage times mitigates losses and feeds better visitor sentiment.",
  },
  {
    id: "band-quality",
    title: "Band Quality ↔ Festival Score",
    description: "Live performance ratings adjust performance_sentiment, feeding the FestivalScore and future brand_fame.",
    impact: "High-scoring artists boost return attendee multipliers and unlock prestige achievements.",
  },
  {
    id: "sponsor-fit",
    title: "Sponsor Fit ↔ Sentiment",
    description: "Sponsors with low fit_score or high sentiment_bias drag visitor sentiment, affecting attendance and merch uptake.",
    impact: "Curating aligned sponsors yields better FestivalScore and richer future sponsor offers.",
  },
  {
    id: "twaater-hype",
    title: "Twaater Hype ↔ Sales",
    description: "Event-driven posts maintain hype; dips between beats encourage using marketing spend or lineup reveals.",
    impact: "Sustained hype keeps F_hype high, directly boosting demand and fee guidance confidence.",
  },
];

export const lifecycleBeats: FestivalLifecycleBeat[] = [
  {
    id: "license-and-setup",
    title: "License & Setup",
    description: "Acquire license, pay staffing, set venue/city, configure days and acts per day to open booking window.",
    outcomes: [
      "Festival status moves from draft → booking.",
      "Pricing policy defaults derived from owner profile.",
      "Weather forecast seeded for the scheduled window.",
    ],
  },
  {
    id: "booking-and-lock",
    title: "Booking Window",
    description: "Send invites with fee guidance, negotiate counter offers, and lock lineup before deadlines.",
    outcomes: [
      "festival_slots map to festival_bands_booked once agreements land.",
      "Sponsor selections adjust sentiment forecasts immediately.",
      "Pricing adjustments recalculate demand in real time via simulate-forecast.",
    ],
  },
  {
    id: "live-operations",
    title: "Live Operations",
    description: "Go-live triggers hourly tick simulation for sales, sentiment, weather updates, and performance scoring.",
    outcomes: [
      "Revenue and expense tables update with actuals for each tick.",
      "FestivalScore computed nightly to drive achievements and dynamic bonuses.",
      "Twaater posts emit daily highlights and weather alerts automatically.",
    ],
  },
  {
    id: "settlement-and-preview",
    title: "Settlement & Preview",
    description: "Settle final P&L, update brand_fame, and present Next Year Preview with recommended pricing and headliner targets.",
    outcomes: [
      "festival_revenue and festival_expenses persist edition data.",
      "festival_sentiment finalizes overall sentiment for archives.",
      "Preview service recommends sponsor bundles (safe/edgy/high-cash) and pricing adjustments.",
    ],
  },
];

export const dataModelTables: FestivalDataModelTable[] = [
  {
    name: "festivals",
    description: "Canonical festival definition with ownership, recurrence, capacity, and pricing posture.",
    keyFields: ["owner_type", "size_tier", "annual_rule", "status", "pricing_policy"],
    scope: "core",
  },
  {
    name: "festival_licenses",
    description: "Player-owned license unlocks and renewal tracking including staffing pre-payment flag.",
    keyFields: ["player_id", "size_tier", "expires_date", "one_off_staff_cost_paid"],
    scope: "core",
  },
  {
    name: "festival_costs",
    description: "Edition-specific cost captures covering staffing, security, insurance, waste, stage, permits, marketing, sponsor contra.",
    keyFields: ["festival_id", "staffing_cost", "security_cost", "sponsor_contra"],
    scope: "operations",
  },
  {
    name: "festival_days",
    description: "Per-day schedule with expected weather and confidence, supporting demand forecast per day.",
    keyFields: ["festival_id", "day_index", "expected_weather", "weather_confidence"],
    scope: "operations",
  },
  {
    name: "festival_slots",
    description: "Slot layout with type, start times, durations, and capacity modifiers for demand attribution.",
    keyFields: ["festival_day_id", "slot_type", "capacity_modifier"],
    scope: "booking",
  },
  {
    name: "festival_invites",
    description: "Offer tracking with fee guidance snapshot, counter offers, and acceptance status per band.",
    keyFields: ["band_id", "slot_id", "offer_fee", "status"],
    scope: "booking",
  },
  {
    name: "festival_bands_booked",
    description: "Confirmed bookings linking bands to slots with agreed fee and rider level.",
    keyFields: ["slot_id", "agreed_fee", "rider_level"],
    scope: "booking",
  },
  {
    name: "festival_pricing",
    description: "Owner-set pricing for tickets and F&B/merch tiers.",
    keyFields: ["ticket_price", "food_price_tier", "drink_price_tier", "merch_price_tier"],
    scope: "core",
  },
  {
    name: "festival_revenue",
    description: "Aggregated gross revenue streams post-settlement.",
    keyFields: ["tickets_gross", "fnb_gross", "merch_gross", "sponsor_income"],
    scope: "reporting",
  },
  {
    name: "festival_expenses",
    description: "Aggregated expense streams including artist fees and operating totals.",
    keyFields: ["artist_fees_total", "ops_total", "fnb_cogs", "merch_cogs"],
    scope: "reporting",
  },
  {
    name: "festival_sponsors",
    description: "Selected sponsors with fit scores, cash, in-kind value, sentiment bias, and exclusivity.",
    keyFields: ["sponsor_id", "fit_score", "sentiment_bias", "exclusive"],
    scope: "booking",
  },
  {
    name: "festival_sentiment",
    description: "Composite sentiment metrics before, during, and after the event.",
    keyFields: ["pre_hype", "price_sentiment", "performance_sentiment", "overall"],
    scope: "reporting",
  },
  {
    name: "festival_editions",
    description: "Snapshot table for immutable yearly records tying all metrics to a year/edition.",
    keyFields: ["edition_id", "festival_id", "year"],
    scope: "reporting",
  },
  {
    name: "twaater_posts",
    description: "Hooks for festival milestones: announcements, lineup drops, pricing changes, alerts, highlights, aftermovie.",
    keyFields: ["festival_id", "post_type", "published_at"],
    scope: "shared",
  },
];

export const apiEndpoints: FestivalApiEndpoint[] = [
  { method: "POST", path: "/festivals", description: "Create admin or player festival shells with tier, days, acts/day, pricing policy, and recurrence.", focus: "shared" },
  { method: "POST", path: "/festival/{id}/open-booking", description: "Compute booking window, publish schedule, and trigger auto-invite flows.", focus: "shared" },
  { method: "PATCH", path: "/festival/{id}/pricing", description: "Adjust ticket, food, drink, and merch tiers with live demand feedback.", focus: "player" },
  { method: "POST", path: "/festival/{id}/simulate-forecast", description: "Return demand per day, estimated revenue, and fee guidance per slot.", focus: "shared" },
  { method: "POST", path: "/festival/{id}/invite", description: "Send an invite with current fee guidance and predicted acceptance probability.", focus: "player" },
  { method: "POST", path: "/festival/invite/{invite_id}/respond", description: "Accept, reject, or counter an invite with updated fee guidance snapshot.", focus: "shared" },
  { method: "POST", path: "/festival/{id}/lock-lineup", description: "Lock lineup before cut-off, moving status to scheduled.", focus: "player" },
  { method: "POST", path: "/festival/{id}/go-live", description: "Transition a scheduled festival into live simulation mode.", focus: "shared" },
  { method: "POST", path: "/festival/{id}/tick", description: "Advance hourly simulation loop for attendance, spend, sentiment, and weather resolution.", focus: "shared" },
  { method: "POST", path: "/festival/{id}/settle", description: "Finalize revenue/expenses, update brand fame, and write reports.", focus: "shared" },
  { method: "GET", path: "/festival/{id}/report", description: "Return current and historical edition reports with sentiment and profitability trends.", focus: "shared" },
  { method: "GET", path: "/festival/{id}/preview-next", description: "Generate Next Year Preview recommendations for pricing, lineup targets, and sponsor bundles.", focus: "player" },
  { method: "POST", path: "/festival-licenses", description: "Purchase a license for a specific tier and mark staffing fee as paid.", focus: "player" },
  { method: "GET", path: "/festival-licenses/me", description: "List the player's active and expired festival licenses.", focus: "player" },
  { method: "POST", path: "/festival/{id}/sponsors/select", description: "Select sponsors, toggling exclusivity and applying sentiment bias to forecasts.", focus: "player" },
  { method: "POST", path: "/twaater/publish", description: "Emit Twaater moments tied to festival lifecycle beats.", focus: "shared" },
];

export const backgroundJobs: FestivalBackgroundJob[] = [
  {
    id: "forecast-refresh",
    cadence: "Nightly",
    description: "Recalculate demand forecasts for active festivals, updating fee guidance and sponsor probabilities.",
  },
  {
    id: "sponsor-rotation",
    cadence: "Nightly",
    description: "Rotate available sponsor offers, expire stale deals, and surface new bundles based on Festival Score trends.",
  },
  {
    id: "booking-status",
    cadence: "Hourly",
    description: "Advance festivals through draft → booking → scheduled once criteria are met (license paid, lineup locked).",
  },
  {
    id: "weather-finalization",
    cadence: "Daily",
    description: "Finalize weather outcomes for festivals about to go live, adjusting F_weather modifiers.",
  },
  {
    id: "post-event-sentiment",
    cadence: "Nightly",
    description: "Aggregate visitor and artist sentiment, update brand fame, and generate dispute audits if anomalies detected.",
  },
];

export const calculators: FestivalCalculatorSummary[] = [
  {
    id: "headline-fee",
    title: "Headline Fee Guidance",
    summary: "Forecast attendance * ticket price * headliner attribution yields low/high guidance values per invite.",
    keyInputs: ["forecast_attendance", "ticket_price", "band_fame", "style_match", "size_tier minimums"],
  },
  {
    id: "demand-index",
    title: "Daily Demand Index",
    summary: "Combines hype, lineup strength, pricing, sentiment, and weather to cap attendance at 115% of capacity.",
    keyInputs: ["F_hype", "F_lineup", "F_price", "F_sentiment", "F_weather", "base_capacity"],
  },
  {
    id: "fnb-merch",
    title: "F&B + Merch Revenue",
    summary: "Per attendee spend multiplied by attach modifiers drives gross, with cost-of-goods approximations applied post-sim.",
    keyInputs: ["attendees", "food_price_tier", "drink_price_tier", "merch_price_tier", "elasticity tables"],
  },
  {
    id: "festival-score",
    title: "Festival Score",
    summary: "Z-scored blend of profit margin, attendance rate, artist satisfaction, and visitor sentiment for leaderboards.",
    keyInputs: ["profit_margin", "attendance_rate", "artist_satisfaction", "visitor_sentiment"],
  },
  {
    id: "next-year-preview",
    title: "Next Year Preview",
    summary: "Analyzes prior editions to suggest pricing adjustments, lineup targets, and sponsor packages.",
    keyInputs: ["last_year_profit", "last_year_score", "sentiment_trends", "sponsor_fit_history"],
  },
];
