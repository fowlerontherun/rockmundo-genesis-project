import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle, Music, Users, TrendingUp, MapPin, Trophy, DollarSign,
  Mic, Calendar, Guitar, Headphones, Radio, Clock, Brain, Briefcase,
  Heart, Shield, Sparkles, Zap, Home, ShoppingBag, Plane, Star,
  Newspaper, Camera, Activity, Package, Award, Tv, BookOpen, Wrench,
  CloudSun, Baby, Building2, Bug, Coins, Skull, Gauge, Globe2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* -------------------------------------------------------------------------- */
/*  Building blocks (sentence case, accent bar, dense)                         */
/* -------------------------------------------------------------------------- */

const Section = ({
  icon: Icon,
  title,
  kicker,
  children,
}: {
  icon: any;
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) => (
  <div className="relative rounded-[12px] border border-border bg-card overflow-hidden">
    <span className="absolute left-0 top-0 h-full w-[3px] bg-primary/80" aria-hidden />
    <div className="pl-4 pr-4 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-foreground">{title}</h3>
          {kicker && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{kicker}</p>
          )}
        </div>
      </div>
      <div className="text-[13px] leading-relaxed text-muted-foreground space-y-2">
        {children}
      </div>
    </div>
  </div>
);

const Bullets = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2">
        <span className="mt-[7px] h-1 w-1 rounded-full bg-primary/70 shrink-0" />
        <span className="text-[13px] text-foreground/85">{item}</span>
      </li>
    ))}
  </ul>
);

const Access = ({ path }: { path: string }) => (
  <p className="text-[12px] text-muted-foreground">
    Access · <span className="text-foreground/90 font-medium">{path}</span>
  </p>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <Badge variant="secondary" className="rounded-md font-medium text-[11px]">
    {children}
  </Badge>
);

const Callout = ({
  icon: Icon,
  tone = "primary",
  title,
  children,
}: {
  icon: any;
  tone?: "primary" | "warning" | "muted";
  title: string;
  children: React.ReactNode;
}) => {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 border-primary/25",
    warning: "bg-amber-500/10 border-amber-500/25",
    muted: "bg-muted/50 border-border",
  };
  return (
    <div className={`rounded-[12px] border p-3.5 ${toneMap[tone]}`}>
      <h4 className="flex items-center gap-2 text-[13px] font-semibold text-foreground mb-1.5">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Dialog                                                                     */
/* -------------------------------------------------------------------------- */

const TABS: { value: string; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "music", label: "Music" },
  { value: "perform", label: "Perform" },
  { value: "skills", label: "Skills" },
  { value: "career", label: "Career" },
  { value: "social", label: "Social" },
  { value: "world", label: "World" },
  { value: "lifestyle", label: "Lifestyle" },
];

export const HowToPlayDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="How to play">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="relative px-6 pt-5 pb-4 border-b border-border bg-card">
          <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">
                Player guide · v2 systems
              </p>
              <DialogTitle className="text-[22px] font-semibold tracking-tight">
                How to play Rockmundo
              </DialogTitle>
              <p className="text-[12.5px] text-muted-foreground mt-1 max-w-2xl">
                A persistent music-industry MMO. Time runs at a 1:4 scale (one year = 120 real days),
                so weeks of in-game momentum take only days to build. Plan around your wellness, your
                calendar, and your regional fame.
              </p>
            </div>
            <div className="hidden md:flex flex-col items-end gap-1.5 shrink-0">
              <Pill>Epoch · Jan 2026</Pill>
              <Pill>180+ cities</Pill>
              <Pill>1,700+ jobs</Pill>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[72vh]">
          <div className="px-6 py-5">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList
                className="w-full h-auto p-1 mb-5 flex flex-wrap justify-start gap-1 bg-muted/60"
              >
                {TABS.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="text-[12px] px-3 py-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ========================== OVERVIEW ========================== */}
              <TabsContent value="overview" className="space-y-3 mt-0">
                <Section icon={Trophy} title="What you're building">
                  <p>
                    Start as an unknown busker and grow into a globe-spanning recording artist,
                    bandleader, label owner, or media celebrity. There is no single victory
                    condition — every system feeds the others.
                  </p>
                  <Bullets items={[
                    "Write, record, and release songs across singles, EPs, and albums",
                    "Form or join bands, hire crew, and run a label",
                    "Tour 180+ cities, build regional fame, and headline major events",
                    "Negotiate contracts, sponsorships, merch, and corporate subsidiaries",
                    "Marry, raise children, and pass your legacy to the next generation",
                  ]} />
                </Section>

                <Section icon={TrendingUp} title="Core loop">
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {[
                      ["1 · Learn", "University, books, mentors, and YouTube convert AP into SXP across 12+ skill trees."],
                      ["2 · Create", "Write in the Songwriting Studio (0–1000 project scale), then record at a city studio."],
                      ["3 · Rehearse", "Lift songs from Unrehearsed → Loose → Tight → Perfected with your band."],
                      ["4 · Perform", "Busk, open mic, gigs, festivals, tours, awards — wellness gates everything."],
                      ["5 · Release", "Wizard-built singles/EPs/albums distributed across territories, with passive hype."],
                      ["6 · Promote", "Radio, Twaater, DikCok, PR interviews, music videos, sponsorships."],
                      ["7 · Scale", "Labels, subsidiaries, real estate, charts, regional dominance, generational legacy."],
                    ].map(([title, desc]) => (
                      <div key={title} className="rounded-md border border-border bg-background/40 p-2.5">
                        <h4 className="text-[12.5px] font-semibold text-foreground">{title}</h4>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section icon={Clock} title="Time, scheduling, and conflicts" kicker="1 year = 120 real days · epoch January 2026">
                  <Bullets items={[
                    "Every activity (gig, rehearsal, class, shift, travel) has a real duration and posts to your calendar",
                    "Universal activity blocking: you cannot double-book — Smart Suggestions surface compatible slots",
                    "Open mic nights happen at 8 PM on each venue's specific weekday",
                    "Employment auto clock-ins for scheduled shifts if you are in the right city with enough health",
                    "Travel duration blocks transit time on your calendar; VIP jets lock duration to the minimum",
                  ]} />
                </Section>

                <Section icon={Gauge} title="Wellness gate" kicker="The most important system to internalise">
                  <p>
                    Every gig, recording, tour leg, and shift checks <span className="text-foreground font-medium">evaluate_wellness_gate</span>{" "}
                    before it runs. Ailments, fatigue, and active blocks can flat-out deny actions, with a
                    toast that deep-links you to recovery.
                  </p>
                  <Bullets items={[
                    "20 ailments across physical, vocal, and mental categories",
                    "Health, stamina, and energy are tracked separately — touring drains all three",
                    "Recovery actions (sleep, meals, holidays, rehab, reading) bypass the gate and clear blocks",
                    "Music Health & Endurance skills reduce drain and raise your cap",
                    "Luxury holidays and rehab clinics reset deep fatigue or addiction states",
                  ]} />
                </Section>
              </TabsContent>

              {/* ============================ MUSIC ============================ */}
              <TabsContent value="music" className="space-y-3 mt-0">
                <Section icon={Music} title="Songwriting Studio">
                  <Access path="Music → Songwriting" />
                  <Bullets items={[
                    "Project-based: each song progresses on a 0–1000 scale across lyrics, melody, arrangement, and polish",
                    "Write solo or co-write with bandmates and partners (royalties split automatically)",
                    "Music Theory grants a quality bonus up to 10%; genre expertise unlocks deeper structures",
                    "Breakthroughs are rare jumps in quality — chase them with rest and inspiration items",
                  ]} />
                </Section>

                <Section icon={Headphones} title="Recording & AI generation">
                  <Access path="Music → Recording Studio" />
                  <Bullets items={[
                    "Book strictly within the studio's home city — cross-city sessions are rejected",
                    "Producer (up to +30%), studio tier (up to +20%), and orchestra add-ons stack",
                    "Your Mixing, DAW, Vocal Production, and Theory skills add up to +30% combined",
                    "Unrehearsed songs are penalised; Perfected songs record cleanest",
                    <><strong className="text-foreground">AI music generation:</strong> MiniMax engine, 550-character lyric limit, capped retries per session</>,
                  ]} />
                </Section>

                <Section icon={Package} title="Release Manager">
                  <Access path="Music → Release Manager" />
                  <Bullets items={[
                    "Wizard packages recorded songs into singles, EPs, or albums (no duplicates across release types)",
                    "Choose format, artwork, distribution territories, and label routing",
                    "Manufacturing windows apply for physical formats — plan with the calendar",
                    "Passive hype accumulates per release with daily decay multipliers",
                    "Territory-based distribution scales cost with distance; each region sells independently",
                  ]} />
                </Section>

                <Section icon={Radio} title="Radio, streaming & charts">
                  <Bullets items={[
                    "Released songs auto-list on streaming platforms; royalties scale logarithmically with reach",
                    "Submit tracks to ~1,800+ media outlets — start hyper-local, climb to bridge tier, then national",
                    "Charts compute weekly with minimum thresholds; sustained airplay snowballs into discovery",
                    "Chart positions unlock festival applications, award nominations, and label interest",
                  ]} />
                </Section>

                <Section icon={Tv} title="Music videos">
                  <Access path="Music → Music Videos" />
                  <Bullets items={[
                    "Gemini and MiniMax generate AI visualiser loops for any released song",
                    "Higher production budgets unlock concept videos with directors and locations",
                    "Music videos boost DikCok virality and chart longevity",
                  ]} />
                </Section>

                <Section icon={Users} title="Rehearsals">
                  <Access path="Performance → Rehearsals" />
                  <Bullets items={[
                    "Book rehearsal rooms in your current city only",
                    "Instrument + theory skills give up to 1.6× efficiency — Perfected in ~3.75h vs 6h",
                    "Familiarity stages: Unrehearsed → Loose → Tight → Perfected",
                    "Rehearsing together builds band chemistry and unlocks setlist depth",
                  ]} />
                </Section>
              </TabsContent>

              {/* =========================== PERFORM =========================== */}
              <TabsContent value="perform" className="space-y-3 mt-0">
                <Section icon={Mic} title="Open mic & busking">
                  <Bullets items={[
                    "Open mic: weekly 8 PM slot per city venue, 2 songs, fame & fans only (no cash)",
                    "Busking: instant street performance, tips scale with quality and foot traffic",
                    "Both are wellness-gated but cheap on energy — great for early progression",
                  ]} />
                </Section>

                <Section icon={Guitar} title="Gigs">
                  <Access path="Performance → Gig Booking" />
                  <Bullets items={[
                    <><strong className="text-foreground">Performance weights:</strong> song quality 25% · rehearsal 20% · chemistry 15% · gear 12% · instrument 10% · stage 10% · crew 8%</>,
                    "Setlists need ≥6 songs; standard weighting balances hits vs deep cuts",
                    "Showmanship, crowd work, and stage tech roll directly into the rating",
                    "Higher improvisation skews random events toward amazing moments",
                    "Live commentary plays during the gig with skip tracking and fallbacks",
                    "Ticket operators take fees but boost sell-out chance and tout activity",
                  ]} />
                </Section>

                <Section icon={Users} title="Jam sessions">
                  <Access path="Performance → Jam Sessions" />
                  <Bullets items={[
                    "Free-form sessions with bandmates or visiting NPCs",
                    "Traits, cameos, and weighted drops can unlock songwriting inspiration",
                    "Boosts band chemistry; Improvisation skill raises payoff",
                  ]} />
                </Section>

                <Section icon={Plane} title="Touring">
                  <Access path="Performance → Tours" />
                  <Bullets items={[
                    "Plan multi-city tours; Haversine distance picks the recommended transport mode",
                    "Transit time blocks your calendar; arriving fatigued tanks performance",
                    "Crew, accommodation, and freight costs scale with leg count",
                    "Tour merch sales spike per city; regional fame builds 20% spillover to neighbours",
                  ]} />
                </Section>

                <Section icon={Award} title="Festivals & award shows">
                  <Bullets items={[
                    "Festivals: apply for slots, haggle schedules, run backstage dialogue for RP buffs",
                    "Eurovision and major events recur on the unified game calendar with cooldowns",
                    "Award ceremonies run as 6-phase events with outfit bonuses and live red carpet",
                    "Wins grant fame multipliers, prize money, and label leverage",
                  ]} />
                </Section>

                <Section icon={Activity} title="Stage practice minigame">
                  <Bullets items={[
                    "Rhythm minigame converts practice runs into Stage skill XP",
                    "Daily XP cap prevents grinding; combo and accuracy modify payout",
                    "Mastering it noticeably lifts gig and tour ratings over time",
                  ]} />
                </Section>
              </TabsContent>

              {/* ============================ SKILLS ============================ */}
              <TabsContent value="skills" className="space-y-3 mt-0">
                <Section icon={Brain} title="Skill trees" kicker="Basic → Professional → Mastery">
                  <div className="grid sm:grid-cols-2 gap-3 mt-1">
                    {[
                      ["Musical", ["Songwriting & Production (mixing, DAW, vocals)", "Instruments — strings, keys, percussion, wind, brass, electronic, world", "Genre Expertise across 52 standardised genres", "Music Theory & Ear Training"]],
                      ["Performance", ["Stage Showmanship — presence, crowd work, tech", "Improvisation — solos, recovery, jam payoff", "Vocal Performance & Rapping (flow, delivery, freestyle)"]],
                      ["Business", ["Contracts & Rights — deals, royalties, negotiation", "Marketing & Branding — PR, campaigns, sponsorship", "Booking & Touring — logistics, routing, freight"]],
                      ["Support", ["Audience Psychology — fan growth, viral content", "Music Health & Endurance — drain reduction, vocal care", "Mental resilience and burnout prevention"]],
                    ].map(([cat, items]) => (
                      <div key={cat as string} className="rounded-md border border-border bg-background/40 p-2.5">
                        <h4 className="text-[12.5px] font-semibold text-foreground mb-1.5">{cat as string}</h4>
                        <ul className="space-y-1 text-[11.5px] text-muted-foreground">
                          {(items as string[]).map((i) => (
                            <li key={i} className="flex gap-1.5">
                              <span className="mt-[6px] h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                              <span>{i}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section icon={Zap} title="How skills compound">
                  <div className="space-y-2">
                    {[
                      ["Recording", "Mixing + DAW + Production + Vocal + Theory stack to +30% quality."],
                      ["Rehearsals", "Instrument + Theory up to 1.6× efficiency — Perfected ~3.75h vs 6h."],
                      ["Gigs", "Instrument (10%) and Stage (10%) feed the rating; Improvisation tilts random rolls."],
                      ["Songwriting", "Composing, lyrics, genre, and production set base quality; Theory adds the multiplier."],
                      ["Social", "Audience Psychology boosts Twaater and DikCok fan growth and trending odds."],
                      ["Business", "Contracts improve deal terms; Marketing lifts PR; Booking cuts tour costs."],
                    ].map(([t, d]) => (
                      <div key={t} className="flex gap-3">
                        <span className="text-[12px] font-semibold text-foreground w-24 shrink-0">{t}</span>
                        <span className="text-[12px] text-muted-foreground">{d}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section icon={BookOpen} title="Education">
                  <Access path="Education" />
                  <Bullets items={[
                    <><strong className="text-foreground">University:</strong> 23,000+ courses across cities, daily 10 AM–2 PM classes, steady SXP</>,
                    <><strong className="text-foreground">Skill books:</strong> bought once, read across sessions for cumulative XP</>,
                    <><strong className="text-foreground">Mentors:</strong> 126 Legendary Masters, $15k–$250k+, unlocked via achievements and exploration</>,
                    <><strong className="text-foreground">YouTube:</strong> free quick-watch educational content</>,
                    <><strong className="text-foreground">AP → SXP:</strong> attributes multiply skill XP gains across every learning channel</>,
                  ]} />
                </Section>
              </TabsContent>

              {/* ============================ CAREER ============================ */}
              <TabsContent value="career" className="space-y-3 mt-0">
                <Section icon={DollarSign} title="Income streams">
                  <Bullets items={[
                    "Gig payouts (venue tier × fame × performance score)",
                    "Streaming royalties (logarithmic — chase reach, not just hits)",
                    "Physical sales with format-specific retail cuts (30% standard digital cut)",
                    "Merch — passive online store plus per-gig spikes",
                    "Employment wages with auto clock-in",
                    "Sponsorships paid weekly via cron distribution",
                    "Festival prizes, award winnings, and label advances",
                  ]} />
                </Section>

                <Section icon={Briefcase} title="Employment">
                  <Access path="Business → Employment" />
                  <Bullets items={[
                    "1,700+ jobs across all 180 cities — food, retail, music industry, white-collar",
                    "Auto clock-in fires when you're in the right city with enough health/energy",
                    "Some music-adjacent jobs grant skill XP alongside wages",
                    "Health and energy requirements gate shifts — overwork triggers ailments",
                  ]} />
                </Section>

                <Section icon={Sparkles} title="Labels & contracts">
                  <Access path="Business → Labels" />
                  <Bullets items={[
                    "Submit demos; offers evaluate fame, song quality, and regional reach",
                    "Negotiate advances, royalty splits, marketing budgets, and release quotas",
                    "Contract types: distribution, licensing, standard, 360",
                    "Run your own label — review demos, sign artists, allocate marketing, auto-hype",
                  ]} />
                </Section>

                <Section icon={Building2} title="Corporate empires">
                  <Bullets items={[
                    "Roll up subsidiaries (labels, studios, venues, merch) into a parent company",
                    "Vertical integration discounts internal services and unlocks transfers",
                    "Inter-company transfers move cash and IP between your entities",
                    "Boards, P&L, and treasury views available in the Business hub",
                  ]} />
                </Section>

                <Section icon={Newspaper} title="PR, media & interviews">
                  <Access path="Career → PR" />
                  <Bullets items={[
                    "Hyper-local outlets (community FM, zines) → bridge tier (Metro magazines) → national",
                    "Outlets you've earned with persist; over-saturation triggers cooldowns",
                    "Interview answers shift reputation across 4 RP axes",
                    "Marketing & Branding skills raise PR yield",
                  ]} />
                </Section>

                <Section icon={ShoppingBag} title="Merchandise">
                  <Access path="Commerce → Merch" />
                  <Bullets items={[
                    "Design SKUs (apparel, posters, vinyl), set price floors, manage inventory caps",
                    "Per-gig spikes plus passive online store income",
                    "Tour merch is your highest-margin road income",
                  ]} />
                </Section>

                <Section icon={Wrench} title="Equipment & gear">
                  <Access path="Commerce → Equipment Shop" />
                  <Bullets items={[
                    "Branded catalog with specs, plus generic genre boosters",
                    "Gear contributes 12% to gig rating; condition degrades with use",
                    "Upgrade paths matter more than total spend — match gear to your genre",
                  ]} />
                </Section>

                <Section icon={Globe2} title="Regional fame">
                  <Bullets items={[
                    "20 fame tiers tracked per city and per country, with 20% spillover to neighbours",
                    "Local fame unlocks bigger venues; country fame unlocks national media",
                    "Touring is the fastest way to convert one city's heat into a regional fanbase",
                  ]} />
                </Section>
              </TabsContent>

              {/* ============================ SOCIAL ============================ */}
              <TabsContent value="social" className="space-y-3 mt-0">
                <Section icon={Users} title="Bands & crew">
                  <Access path="Band Manager" />
                  <Bullets items={[
                    "Form a band or join one; chemistry builds via rehearsals, gigs, and jams",
                    "Daily automated stat updates for popularity and cohesion",
                    "Hire crew with star ratings — exclusivity contracts boost cohesion modifiers",
                    "Recruitment ads boost applicant volume and quality with budget scaling",
                    "Automated payroll runs Mondays via the ledger; hiatus pauses payouts",
                  ]} />
                </Section>

                <Section icon={Heart} title="Relationships, marriage & legacy">
                  <Bullets items={[
                    <><strong className="text-foreground">Tiers:</strong> Acquaintance → Bandmate → Inner Circle → Legendary Duo</>,
                    "Statuses: Best Friends, Rivals, Romance, Mentor",
                    "Affinity grows via chats, gifts, trades, jams, and gigs together",
                    "Marriage, gestation, children, and inheritance with legal constraints",
                    "Permadeath with limited resurrections — stats wipe partially on revive",
                  ]} />
                </Section>

                <Section icon={Tv} title="Twaater & DikCok">
                  <Access path="Social Media" />
                  <Bullets items={[
                    "Twaater: posts, fan growth, trending decay over ~8.3 hours, verification milestones",
                    "DikCok: short videos, exponential decay, genre affinity, tips and challenges",
                    "Cross-promotion: DikCok virality lifts Twaater following",
                    "Audience Psychology raises both engagement rate and trend odds",
                  ]} />
                </Section>

                <Section icon={Users} title="Gettit (community forum)">
                  <Access path="Social → Gettit" />
                  <Bullets items={[
                    "Reddit-style subreddits, posts, comments, and voting",
                    "Spin up your own community around your band or scene",
                  ]} />
                </Section>

                <Section icon={Star} title="Achievements">
                  <Bullets items={[
                    "6-phase milestone categories: music, performance, social, business, exploration, legacy",
                    "Rarity tiers grant scaling cash, fame, and item rewards",
                    "Tracked per character — explicit ID joins keep progress accurate",
                  ]} />
                </Section>

                <Section icon={Baby} title="Peer-to-peer activity">
                  <Bullets items={[
                    "Direct trades, mentorship, location presence lists",
                    "Real-time nightclub presence with branching RPG stances",
                    "Crypto P2P trading with 100-token cap and integrity checks",
                  ]} />
                </Section>
              </TabsContent>

              {/* ============================ WORLD ============================ */}
              <TabsContent value="world" className="space-y-3 mt-0">
                <Section icon={MapPin} title="180+ cities, real geography">
                  <Bullets items={[
                    "Each city has venues, studios, open mics, jobs, and a unique music scene",
                    "Districts inside cities cluster opportunities (creative quarters, financial zones)",
                    "City fame and country fame are tracked separately and decay if neglected",
                    "Some scenes are genre-loaded — Nashville, London, Tokyo, Berlin, Lagos, São Paulo",
                  ]} />
                </Section>

                <Section icon={Plane} title="Travel network">
                  <Bullets items={[
                    "Train, bus, plane, ship — costs and durations from real Haversine distances",
                    "Auto-mode picks the optimal transport; VIP jets lock minimum duration",
                    "Transit blocks your calendar; arriving in time saves a fatigue hit",
                    "Music Health skills cut travel drain by up to 10%",
                  ]} />
                </Section>

                <Section icon={Home} title="Housing & rentals">
                  <Bullets items={[
                    "Hostels through luxury apartments per city; better rest = faster recovery",
                    "Buy real estate — market prices fluctuate, upkeep applies, rental yields capped",
                    "Some accommodations include practice space or studio access",
                  ]} />
                </Section>

                <Section icon={Coins} title="City treasuries & population">
                  <Access path="World → Cities → Treasury" />
                  <Bullets items={[
                    "Each city has a public treasury and a live population trend (30-day chart)",
                    "Your activity moves both — gigs, tours, and travel shift attendance and growth",
                    "Yearly mayoral elections; mayors can adjust city policies and dashboards",
                  ]} />
                </Section>

                <Section icon={Calendar} title="Calendar, weather & seasons" kicker="Unified epoch, January 2026">
                  <Bullets items={[
                    "Seasonal effects feed festival schedules and outdoor performance multipliers",
                    "Weather is PRNG-generated per region — delays travel and shifts genre popularity",
                    "Major events (Eurovision, awards) recur on 3-year cooldowns with auto-history",
                    "Plan releases and tours around the calendar for maximum lift",
                  ]} />
                </Section>

                <Section icon={Skull} title="Underworld & casino">
                  <Access path="Underworld" />
                  <Bullets items={[
                    "Single-use consumables that boost stats, fame, cash, XP — some carry side effects",
                    "Casino minigames with risk-tuned algorithms; addiction is a real failure mode",
                    "Cravings trigger random pop-ups under stress — accept the buff or refuse the cost",
                  ]} />
                </Section>
              </TabsContent>

              {/* ========================== LIFESTYLE ========================== */}
              <TabsContent value="lifestyle" className="space-y-3 mt-0">
                <Section icon={Camera} title="Modeling & brand work">
                  <Access path="Career → Modeling" />
                  <Bullets items={[
                    "Fashion shoots, covers, brand deals scale with fame",
                    "Modeling lifts public image and unlocks sponsorship tiers",
                    "Outfit bonuses apply at award ceremonies",
                  ]} />
                </Section>

                <Section icon={Home} title="Character & identity">
                  <Access path="Character Hub" />
                  <Bullets items={[
                    "Customise avatar, origin story, wardrobe, tattoos, and equipped gear",
                    "AI photo-to-avatar generation with style presets and compressed payloads",
                    "Multi-character slots with permadeath and partial-stat resurrection",
                    "Reputation tracked across 4 RP axes for every social interaction",
                  ]} />
                </Section>

                <Section icon={Star} title="VIP & premium">
                  <Bullets items={[
                    "Tiered VIP unlocks elite venues, faster travel, and premium cosmetics",
                    "Time-limited cosmetic collections with FOMO rotations",
                    "VIP-only events and rare backstage opportunities",
                  ]} />
                </Section>

                <Section icon={Activity} title="Minigames & side hustles">
                  <Bullets items={[
                    <><strong className="text-foreground">Rhythm Challenge</strong> — timing for Stage XP and cash</>,
                    <><strong className="text-foreground">Lyric Scramble</strong> — wordplay for songwriting bonuses</>,
                    <><strong className="text-foreground">Soundcheck Mix</strong> — mixing minigame for recording XP</>,
                    "All minigames have daily XP caps so they supplement, not replace, the main loop",
                  ]} />
                </Section>

                <Section icon={CloudSun} title="Random events & cravings">
                  <Bullets items={[
                    "Surprise gig offers, fan encounters, gear breakdowns, and press ambushes",
                    "Skills and fame bias which events you encounter",
                    "Addiction cravings create real risk/reward choices under stress",
                  ]} />
                </Section>

                <Section icon={Bug} title="Bug reports & feedback">
                  <Bullets items={[
                    "The red bug button at the bottom of every page opens the report form",
                    "Player survey pop-ups appear randomly and feed the game config",
                    "Beta V2 sign-ups, Discord, and patch notes live on the landing page",
                  ]} />
                </Section>
              </TabsContent>
            </Tabs>

            {/* Footer callouts */}
            <div className="grid md:grid-cols-3 gap-3 mt-6">
              <Callout icon={Zap} title="Skills are everything">
                Every system reads your skills. Mixing lifts recordings, instruments speed
                rehearsals, showmanship wins gigs, audience psychology grows fans. Invest early
                — the bonuses compound across your whole career.
              </Callout>
              <Callout icon={Heart} tone="warning" title="Balance is non-negotiable">
                The wellness gate will block you. Touring without rest causes burnout, working
                while ill triggers ailments, and over-posting hurts engagement. Schedule
                recovery the same way you schedule shows.
              </Callout>
              <Callout icon={Sparkles} tone="muted" title="First 7 days checklist">
                Pick an origin · write one song · enrol in a class · play an open mic · grab a
                day job · join or form a band · rehearse to Tight · post on Twaater · submit to
                your local community FM.
              </Callout>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
