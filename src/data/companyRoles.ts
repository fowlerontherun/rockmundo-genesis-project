// Canonical staff roles for every company type.
// Each entry defines what a company owner can hire for. Values feed the vacancy
// creation form (title, category, wage) and the marketplace listings.

export type CompanyRoleCategory =
  | "manager"
  | "assistant_manager"
  | "customer_service"
  | "sales"
  | "marketing"
  | "finance"
  | "security"
  | "technician"
  | "cleaner"
  | "specialist"
  | "creative"
  | "operations"
  | "hospitality"
  | "medical"
  | "legal";

export interface CompanyRole {
  key: string;
  title: string;
  category: CompanyRoleCategory;
  weeklyWage: number;
  description: string;
}

const generic: CompanyRole[] = [
  { key: "gm", title: "General Manager", category: "manager", weeklyWage: 1600, description: "Runs day-to-day operations and reports to the owner." },
  { key: "assistant_manager", title: "Assistant Manager", category: "assistant_manager", weeklyWage: 950, description: "Supports the GM, covers shifts, oversees staff." },
  { key: "accountant", title: "Accountant", category: "finance", weeklyWage: 900, description: "Handles bookkeeping, payroll and tax filings." },
  { key: "marketing_lead", title: "Marketing Lead", category: "marketing", weeklyWage: 950, description: "Plans campaigns, promotions and social media." },
  { key: "receptionist", title: "Receptionist", category: "customer_service", weeklyWage: 500, description: "First point of contact for visitors and enquiries." },
  { key: "cleaner", title: "Cleaner", category: "cleaner", weeklyWage: 380, description: "Keeps facilities presentable and stocked." },
  { key: "security_guard", title: "Security Guard", category: "security", weeklyWage: 560, description: "Protects staff, guests and premises." },
];

export const COMPANY_ROLES: Record<string, CompanyRole[]> = {
  // ==== Core ====
  holding: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead"].includes(r.key)),
    { key: "cfo", title: "Chief Financial Officer", category: "finance", weeklyWage: 3200, description: "Consolidated group finance and investor relations." },
    { key: "coo", title: "Chief Operating Officer", category: "manager", weeklyWage: 3000, description: "Oversees all subsidiaries and inter-company operations." },
    { key: "legal_counsel", title: "General Counsel", category: "legal", weeklyWage: 2400, description: "Corporate legal affairs and contract review." },
    { key: "corp_dev", title: "Corporate Development", category: "specialist", weeklyWage: 2100, description: "M&A, subsidiary launches and strategic partnerships." },
    { key: "ir_manager", title: "Investor Relations Manager", category: "specialist", weeklyWage: 1800, description: "Manages shareholder communications and dividends." },
  ],
  label: [
    ...generic.filter((r) => ["accountant","marketing_lead"].includes(r.key)),
    { key: "a_and_r", title: "A&R Scout", category: "creative", weeklyWage: 1400, description: "Scouts and signs new artists to the label roster." },
    { key: "producer", title: "Staff Producer", category: "creative", weeklyWage: 1700, description: "In-house producer for signed artists." },
    { key: "publicist", title: "Label Publicist", category: "marketing", weeklyWage: 1100, description: "Runs press, radio and streaming outreach." },
    { key: "distribution_manager", title: "Distribution Manager", category: "operations", weeklyWage: 1300, description: "Coordinates physical and digital distribution." },
    { key: "royalty_accountant", title: "Royalty Accountant", category: "finance", weeklyWage: 1200, description: "Calculates and pays artist royalties." },
    { key: "brand_manager", title: "Artist Brand Manager", category: "marketing", weeklyWage: 1250, description: "Manages an artist's image, releases and touring cadence." },
    { key: "sync_licensing", title: "Sync Licensing Agent", category: "specialist", weeklyWage: 1150, description: "Pitches label catalogue to film, TV and games." },
  ],
  recording_studio: [
    ...generic,
    { key: "engineer", title: "Recording Engineer", category: "technician", weeklyWage: 1400, description: "Tracks and captures sessions to a professional standard." },
    { key: "mixer", title: "Mix Engineer", category: "technician", weeklyWage: 1500, description: "Mixes multitrack sessions for release." },
    { key: "mastering_engineer", title: "Mastering Engineer", category: "technician", weeklyWage: 1600, description: "Final polish and format-ready masters." },
    { key: "session_musician", title: "Session Musician", category: "creative", weeklyWage: 900, description: "Studio-ready player available for client sessions." },
    { key: "studio_tech", title: "Studio Technician", category: "technician", weeklyWage: 800, description: "Maintains outboard gear, mics and patch bays." },
    { key: "booking_coordinator", title: "Booking Coordinator", category: "operations", weeklyWage: 750, description: "Schedules sessions and manages client comms." },
  ],
  rehearsal: [
    ...generic.filter((r) => ["gm","assistant_manager","receptionist","cleaner","security_guard"].includes(r.key)),
    { key: "room_tech", title: "Rehearsal Room Technician", category: "technician", weeklyWage: 700, description: "Sets up backline and troubleshoots gear." },
    { key: "gear_rental_clerk", title: "Gear Rental Clerk", category: "sales", weeklyWage: 550, description: "Handles instrument and PA rentals." },
  ],
  venue: [
    ...generic,
    { key: "booker", title: "Talent Booker", category: "specialist", weeklyWage: 1350, description: "Books bands and negotiates performance fees." },
    { key: "sound_engineer", title: "Front-of-House Engineer", category: "technician", weeklyWage: 1200, description: "Runs live sound for every show." },
    { key: "monitor_engineer", title: "Monitor Engineer", category: "technician", weeklyWage: 1100, description: "Handles stage monitors and in-ears." },
    { key: "lighting_tech", title: "Lighting Technician", category: "technician", weeklyWage: 1050, description: "Programs and operates lighting rigs." },
    { key: "stage_manager", title: "Stage Manager", category: "operations", weeklyWage: 1200, description: "Runs changeovers and keeps the show on time." },
    { key: "bar_manager", title: "Bar Manager", category: "hospitality", weeklyWage: 950, description: "Runs bar operations, staff and inventory." },
    { key: "bartender", title: "Bartender", category: "hospitality", weeklyWage: 550, description: "Serves drinks and processes payments." },
    { key: "bouncer", title: "Bouncer / Door Security", category: "security", weeklyWage: 620, description: "Handles door and crowd security." },
    { key: "box_office", title: "Box Office Clerk", category: "customer_service", weeklyWage: 520, description: "Sells and validates tickets." },
  ],
  factory: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead","security_guard","cleaner"].includes(r.key)),
    { key: "production_manager", title: "Production Manager", category: "manager", weeklyWage: 1500, description: "Oversees the manufacturing lines." },
    { key: "line_worker", title: "Production Line Worker", category: "operations", weeklyWage: 620, description: "Runs printing, cutting and packing stations." },
    { key: "quality_control", title: "Quality Control Inspector", category: "specialist", weeklyWage: 780, description: "Ensures product meets brand and factory standards." },
    { key: "designer", title: "Merch Designer", category: "creative", weeklyWage: 1050, description: "Creates print-ready merchandise artwork." },
    { key: "warehouse_manager", title: "Warehouse Manager", category: "operations", weeklyWage: 1100, description: "Manages stock levels and outbound orders." },
    { key: "logistics_coordinator", title: "Logistics Coordinator", category: "operations", weeklyWage: 900, description: "Coordinates shipping to retailers and fans." },
  ],
  logistics: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead"].includes(r.key)),
    { key: "dispatcher", title: "Dispatcher", category: "operations", weeklyWage: 900, description: "Assigns drivers to contracts and monitors routes." },
    { key: "driver", title: "Truck Driver", category: "operations", weeklyWage: 850, description: "Long-haul crew and gear transport." },
    { key: "fleet_mechanic", title: "Fleet Mechanic", category: "technician", weeklyWage: 950, description: "Maintains and repairs the fleet." },
    { key: "route_planner", title: "Route Planner", category: "specialist", weeklyWage: 950, description: "Optimises multi-city touring routes." },
    { key: "customs_clerk", title: "Customs Clerk", category: "specialist", weeklyWage: 850, description: "Handles cross-border paperwork for gear and merch." },
  ],
  security: [
    ...generic.filter((r) => ["gm","assistant_manager","accountant","marketing_lead"].includes(r.key)),
    { key: "personal_security", title: "Personal Security Officer", category: "security", weeklyWage: 1100, description: "Close-protection detail for artists and VIPs." },
    { key: "event_security", title: "Event Security Officer", category: "security", weeklyWage: 700, description: "Covers gigs, festivals and awards." },
    { key: "k9_handler", title: "K9 Handler", category: "security", weeklyWage: 1150, description: "Sweeps venues and events with a detection dog." },
    { key: "control_room", title: "Control Room Operator", category: "specialist", weeklyWage: 900, description: "Monitors CCTV and radio comms during events." },
  ],

  // ==== Retail ====
  clothing_store: [
    ...generic.filter((r) => ["gm","assistant_manager","cleaner","security_guard"].includes(r.key)),
    { key: "sales_associate", title: "Sales Associate", category: "sales", weeklyWage: 520, description: "Serves customers and processes sales." },
    { key: "visual_merchandiser", title: "Visual Merchandiser", category: "creative", weeklyWage: 780, description: "Designs window displays and in-store layout." },
    { key: "buyer", title: "Buyer", category: "specialist", weeklyWage: 1100, description: "Sources product lines from suppliers." },
    { key: "stock_clerk", title: "Stock Clerk", category: "operations", weeklyWage: 500, description: "Manages inventory and replenishment." },
  ],
  instrument_shop: [
    ...generic.filter((r) => ["gm","assistant_manager","cleaner","security_guard"].includes(r.key)),
    { key: "instrument_specialist", title: "Instrument Specialist", category: "sales", weeklyWage: 750, description: "Expert advisor for guitars, keys, drums, etc." },
    { key: "luthier", title: "In-house Luthier", category: "technician", weeklyWage: 1250, description: "Repairs and sets up stringed instruments." },
    { key: "gear_tech", title: "Gear Technician", category: "technician", weeklyWage: 950, description: "Services amps, pedals and electronics." },
    { key: "sales_associate", title: "Sales Associate", category: "sales", weeklyWage: 550, description: "Serves walk-in customers and online orders." },
  ],

  // ==== Nightlife / Hospitality ====
  bar: [
    ...generic.filter((r) => ["gm","assistant_manager","cleaner"].includes(r.key)),
    { key: "head_bartender", title: "Head Bartender", category: "hospitality", weeklyWage: 850, description: "Leads bar staff and designs the cocktail menu." },
    { key: "bartender", title: "Bartender", category: "hospitality", weeklyWage: 550, description: "Serves drinks and runs tabs." },
    { key: "barback", title: "Barback", category: "hospitality", weeklyWage: 380, description: "Restocks and supports the bar team." },
    { key: "bouncer", title: "Bouncer", category: "security", weeklyWage: 620, description: "Door security and crowd control." },
    { key: "dj", title: "House DJ", category: "creative", weeklyWage: 900, description: "Regular DJ residency on weekend nights." },
  ],
  restaurant: [
    ...generic.filter((r) => ["gm","assistant_manager","cleaner","marketing_lead"].includes(r.key)),
    { key: "head_chef", title: "Head Chef", category: "hospitality", weeklyWage: 1600, description: "Leads the kitchen and designs the menu." },
    { key: "sous_chef", title: "Sous Chef", category: "hospitality", weeklyWage: 1050, description: "Second in command in the kitchen." },
    { key: "line_cook", title: "Line Cook", category: "hospitality", weeklyWage: 620, description: "Cooks each service on the line." },
    { key: "waiter", title: "Waiter / Server", category: "hospitality", weeklyWage: 500, description: "Takes orders and serves tables." },
    { key: "sommelier", title: "Sommelier", category: "hospitality", weeklyWage: 1100, description: "Wine service and pairings." },
    { key: "host", title: "Host / Hostess", category: "customer_service", weeklyWage: 480, description: "Greets guests and manages reservations." },
  ],
  casino: [
    ...generic,
    { key: "pit_boss", title: "Pit Boss", category: "manager", weeklyWage: 1500, description: "Supervises table games and dealers." },
    { key: "dealer", title: "Card Dealer", category: "hospitality", weeklyWage: 800, description: "Deals blackjack, poker and other card games." },
    { key: "croupier", title: "Roulette Croupier", category: "hospitality", weeklyWage: 800, description: "Runs the roulette tables." },
    { key: "vip_host", title: "VIP Host", category: "customer_service", weeklyWage: 1400, description: "Manages high rollers and comps." },
    { key: "surveillance", title: "Surveillance Operator", category: "security", weeklyWage: 900, description: "Watches the floor from the CCTV suite." },
    { key: "cashier", title: "Cage Cashier", category: "finance", weeklyWage: 700, description: "Exchanges chips and processes payouts." },
  ],
  hotel: [
    ...generic.filter((r) => ["gm","assistant_manager","accountant","marketing_lead","cleaner","security_guard"].includes(r.key)),
    { key: "front_desk", title: "Front Desk Agent", category: "customer_service", weeklyWage: 550, description: "Check-in, check-out and guest requests." },
    { key: "concierge", title: "Concierge", category: "hospitality", weeklyWage: 850, description: "Arranges bookings, tours and VIP touches." },
    { key: "housekeeping", title: "Housekeeper", category: "cleaner", weeklyWage: 420, description: "Cleans rooms and turns over stays." },
    { key: "maintenance", title: "Maintenance Technician", category: "technician", weeklyWage: 700, description: "Handles repairs across the property." },
    { key: "restaurant_manager", title: "Restaurant Manager", category: "hospitality", weeklyWage: 1200, description: "Runs the in-house restaurant and bar." },
  ],

  // ==== Services ====
  clinic: [
    ...generic.filter((r) => ["gm","accountant","receptionist","cleaner"].includes(r.key)),
    { key: "doctor", title: "General Practitioner", category: "medical", weeklyWage: 2600, description: "Diagnoses and treats musicians and industry clients." },
    { key: "physio", title: "Physiotherapist", category: "medical", weeklyWage: 1400, description: "Rehab for performance injuries." },
    { key: "ent_specialist", title: "ENT Specialist", category: "medical", weeklyWage: 2800, description: "Specialist care for hearing and vocal health." },
    { key: "psychologist", title: "Psychologist", category: "medical", weeklyWage: 2100, description: "Mental health support for artists." },
    { key: "nurse", title: "Nurse", category: "medical", weeklyWage: 950, description: "Clinical support and patient care." },
  ],
  gym: [
    ...generic.filter((r) => ["gm","assistant_manager","cleaner","marketing_lead"].includes(r.key)),
    { key: "personal_trainer", title: "Personal Trainer", category: "specialist", weeklyWage: 950, description: "1-on-1 training for artists and members." },
    { key: "class_instructor", title: "Class Instructor", category: "specialist", weeklyWage: 700, description: "Runs group fitness classes." },
    { key: "nutritionist", title: "Nutritionist", category: "specialist", weeklyWage: 1100, description: "Diet plans for touring artists." },
    { key: "front_desk", title: "Front Desk", category: "customer_service", weeklyWage: 480, description: "Membership sign-ups and check-ins." },
  ],
  hair_salon: [
    ...generic.filter((r) => ["gm","accountant","receptionist","cleaner"].includes(r.key)),
    { key: "senior_stylist", title: "Senior Stylist", category: "creative", weeklyWage: 900, description: "Signature stylist for high-profile clients." },
    { key: "stylist", title: "Stylist", category: "creative", weeklyWage: 600, description: "Cuts, colours and styles clients." },
    { key: "colourist", title: "Colour Specialist", category: "creative", weeklyWage: 950, description: "Colour transformations and corrections." },
    { key: "apprentice", title: "Apprentice", category: "specialist", weeklyWage: 320, description: "Learning role, assists senior stylists." },
  ],
  tattoo_parlour: [
    ...generic.filter((r) => ["gm","accountant","receptionist","cleaner"].includes(r.key)),
    { key: "resident_artist", title: "Resident Tattoo Artist", category: "creative", weeklyWage: 1400, description: "Full-time artist producing signature work." },
    { key: "guest_artist", title: "Guest Artist Coordinator", category: "operations", weeklyWage: 700, description: "Books touring guest artists." },
    { key: "piercer", title: "Body Piercer", category: "specialist", weeklyWage: 900, description: "Handles piercings alongside the parlour." },
    { key: "sterilisation_tech", title: "Sterilisation Technician", category: "technician", weeklyWage: 500, description: "Maintains hygiene and equipment sterilisation." },
  ],
  music_school: [
    ...generic.filter((r) => ["gm","accountant","receptionist","cleaner","marketing_lead"].includes(r.key)),
    { key: "instrument_teacher", title: "Instrument Teacher", category: "specialist", weeklyWage: 800, description: "Teaches guitar, keys, drums, bass etc." },
    { key: "vocal_coach", title: "Vocal Coach", category: "specialist", weeklyWage: 900, description: "Vocal technique and performance." },
    { key: "theory_tutor", title: "Music Theory Tutor", category: "specialist", weeklyWage: 700, description: "Teaches theory, harmony and composition." },
    { key: "production_tutor", title: "Production Tutor", category: "specialist", weeklyWage: 950, description: "DAW, mixing and beatmaking classes." },
    { key: "admissions", title: "Admissions Officer", category: "operations", weeklyWage: 650, description: "Handles enrolments and student support." },
  ],
  pr_agency: [
    ...generic.filter((r) => ["gm","accountant","receptionist"].includes(r.key)),
    { key: "publicist", title: "Publicist", category: "specialist", weeklyWage: 1400, description: "Runs press campaigns for artist clients." },
    { key: "media_relations", title: "Media Relations Manager", category: "specialist", weeklyWage: 1500, description: "Owns relationships with press outlets." },
    { key: "social_manager", title: "Social Media Manager", category: "marketing", weeklyWage: 950, description: "Runs client social presence and analytics." },
    { key: "crisis_manager", title: "Crisis Manager", category: "specialist", weeklyWage: 2200, description: "Damage control for scandals and PR fires." },
    { key: "content_writer", title: "Content Writer", category: "creative", weeklyWage: 750, description: "Press releases and long-form storytelling." },
  ],
  talent_agency: [
    ...generic.filter((r) => ["gm","accountant","receptionist","marketing_lead"].includes(r.key)),
    { key: "booking_agent", title: "Booking Agent", category: "specialist", weeklyWage: 1600, description: "Books tours and shows for signed artists." },
    { key: "scout", title: "Talent Scout", category: "specialist", weeklyWage: 1100, description: "Finds new artists to sign." },
    { key: "contract_negotiator", title: "Contract Negotiator", category: "legal", weeklyWage: 1800, description: "Negotiates deals with venues and labels." },
    { key: "tour_manager", title: "Tour Manager", category: "operations", weeklyWage: 1400, description: "Runs an artist's tour on the road." },
  ],
  real_estate: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead","receptionist"].includes(r.key)),
    { key: "sales_agent", title: "Sales Agent", category: "sales", weeklyWage: 900, description: "Handles residential and studio-property sales." },
    { key: "leasing_agent", title: "Leasing Agent", category: "sales", weeklyWage: 750, description: "Manages rentals for artists and companies." },
    { key: "appraiser", title: "Property Appraiser", category: "specialist", weeklyWage: 1100, description: "Values studios, venues and homes." },
    { key: "property_manager", title: "Property Manager", category: "operations", weeklyWage: 950, description: "Manages owner portfolios day to day." },
  ],

  // ==== Media ====
  magazine_publisher: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead","receptionist"].includes(r.key)),
    { key: "editor_in_chief", title: "Editor-in-Chief", category: "creative", weeklyWage: 2200, description: "Owns editorial direction of the magazine." },
    { key: "features_editor", title: "Features Editor", category: "creative", weeklyWage: 1400, description: "Commissions and edits long-form features." },
    { key: "staff_writer", title: "Staff Writer", category: "creative", weeklyWage: 800, description: "Writes news, reviews and interviews." },
    { key: "photographer", title: "Staff Photographer", category: "creative", weeklyWage: 900, description: "Shoots covers, live shows and portraits." },
    { key: "art_director", title: "Art Director", category: "creative", weeklyWage: 1500, description: "Designs the visual identity of the magazine." },
    { key: "ad_sales", title: "Ad Sales Executive", category: "sales", weeklyWage: 950, description: "Sells ad pages to labels and brands." },
  ],
  newspaper: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead","receptionist"].includes(r.key)),
    { key: "editor", title: "Editor", category: "creative", weeklyWage: 1800, description: "Owns day-to-day editorial output." },
    { key: "reporter", title: "Reporter", category: "creative", weeklyWage: 750, description: "Breaking news and investigative reporting." },
    { key: "columnist", title: "Music Columnist", category: "creative", weeklyWage: 950, description: "Signature weekly music opinion column." },
    { key: "photographer", title: "News Photographer", category: "creative", weeklyWage: 800, description: "Photojournalism for stories." },
    { key: "ad_sales", title: "Ad Sales Executive", category: "sales", weeklyWage: 900, description: "Sells display and classified ads." },
  ],
  radio_station: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead","receptionist"].includes(r.key)),
    { key: "program_director", title: "Program Director", category: "manager", weeklyWage: 1800, description: "Owns scheduling and station format." },
    { key: "presenter", title: "On-air Presenter", category: "creative", weeklyWage: 1200, description: "Hosts a daily show." },
    { key: "music_director", title: "Music Director", category: "creative", weeklyWage: 1400, description: "Owns the playlist and A-list rotations." },
    { key: "producer", title: "Show Producer", category: "creative", weeklyWage: 950, description: "Produces content, interviews and packages." },
    { key: "broadcast_engineer", title: "Broadcast Engineer", category: "technician", weeklyWage: 1100, description: "Keeps the station on-air." },
    { key: "ad_sales", title: "Ad Sales Executive", category: "sales", weeklyWage: 950, description: "Sells radio ad slots." },
  ],
  podcast_network: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead"].includes(r.key)),
    { key: "showrunner", title: "Showrunner", category: "manager", weeklyWage: 1500, description: "Runs a flagship podcast end-to-end." },
    { key: "audio_producer", title: "Audio Producer", category: "creative", weeklyWage: 1050, description: "Edits and mixes episodes." },
    { key: "host", title: "Host / Interviewer", category: "creative", weeklyWage: 1200, description: "On-mic host for shows." },
    { key: "booker", title: "Guest Booker", category: "operations", weeklyWage: 800, description: "Books artist and industry guests." },
    { key: "sponsor_manager", title: "Sponsorship Manager", category: "sales", weeklyWage: 1100, description: "Sells and services sponsor read-outs." },
  ],
  modelling_agency: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead","receptionist"].includes(r.key)),
    { key: "booker", title: "Model Booker", category: "specialist", weeklyWage: 1200, description: "Books models onto shoots and campaigns." },
    { key: "scout", title: "Talent Scout", category: "specialist", weeklyWage: 900, description: "Signs new models to the roster." },
    { key: "portfolio_manager", title: "Portfolio Manager", category: "creative", weeklyWage: 950, description: "Curates models' portfolios and comp cards." },
    { key: "contract_manager", title: "Contract Manager", category: "legal", weeklyWage: 1400, description: "Negotiates shoots and campaigns." },
  ],

  // ==== Finance ====
  crypto_exchange: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead","security_guard"].includes(r.key)),
    { key: "compliance_officer", title: "Compliance Officer", category: "legal", weeklyWage: 2200, description: "Owns KYC/AML compliance." },
    { key: "trading_desk", title: "Trading Desk Analyst", category: "finance", weeklyWage: 1900, description: "Runs the market-making desk." },
    { key: "risk_manager", title: "Risk Manager", category: "finance", weeklyWage: 2100, description: "Monitors exposure and liquidity." },
    { key: "customer_support", title: "Customer Support", category: "customer_service", weeklyWage: 550, description: "Handles user tickets." },
    { key: "security_engineer", title: "Security Engineer", category: "technician", weeklyWage: 2400, description: "Protects the platform from breaches." },
  ],

  // ==== Logistics extras ====
  taxi: [
    ...generic.filter((r) => ["gm","accountant","marketing_lead"].includes(r.key)),
    { key: "dispatcher", title: "Dispatcher", category: "operations", weeklyWage: 750, description: "Assigns fares to drivers." },
    { key: "driver", title: "Taxi Driver", category: "operations", weeklyWage: 600, description: "Drives passengers around the city." },
    { key: "fleet_mechanic", title: "Fleet Mechanic", category: "technician", weeklyWage: 850, description: "Maintains the taxi fleet." },
  ],
};

export const DEFAULT_ROLES: CompanyRole[] = [
  generic[0], // gm
  generic[1], // assistant manager
  generic[2], // accountant
  generic[3], // marketing lead
  generic[4], // receptionist
  generic[5], // cleaner
  generic[6], // security guard
];

export function getRolesForCompanyType(typeKey?: string | null): CompanyRole[] {
  if (!typeKey) return DEFAULT_ROLES;
  return COMPANY_ROLES[typeKey] ?? DEFAULT_ROLES;
}
