import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarClock, MapPin, Monitor, Plane, Search, Train, Bus, Ship } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { bookTravel } from "@/utils/travelSystem";
import { calculateDistance, getAvailableModes, type CityWithCoords, type TravelOption } from "@/utils/dynamicTravel";
import { formatDepartureDateTime, getNextAvailableDeparture } from "@/utils/transportSchedules";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { MobileEntityCard, MobileErrorState, MobileLoadingSkeleton, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

type DesktopSection = "venues" | "companies" | "jobs" | "marketplace" | "shops" | "charts" | "festivals" | "events" | "search" | "city" | "locations";
type TravelDisplayStatus = "scheduled" | "in_progress";

type MobileTravelRecord = {
  id: string;
  from_city_id: string | null;
  to_city_id: string | null;
  transport_type: string | null;
  cost_paid: number | null;
  departure_time: string | null;
  scheduled_departure_time: string | null;
  arrival_time: string | null;
  status: string | null;
  effectiveStatus: TravelDisplayStatus;
  fromCityName?: string;
  toCityName?: string;
};

type TravelDisplay = {
  status: TravelDisplayStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  fromName?: string | null;
  toName?: string | null;
  transportType?: string | null;
};

const desktopOnly: Record<DesktopSection, { title: string; description: string }> = {
  venues: { title: "Venue management", description: "Detailed venue discovery, booking and management remain desktop gameplay." },
  companies: { title: "Companies", description: "Company discovery, ownership and management remain desktop gameplay." },
  jobs: { title: "Jobs", description: "Job applications and employment management remain desktop gameplay. Scheduled work still appears in My Day." },
  marketplace: { title: "Marketplace", description: "Buying, selling and inventory-linked market actions remain desktop gameplay." },
  shops: { title: "Shops", description: "Equipment, clothing and other shopping flows remain desktop gameplay." },
  charts: { title: "Charts", description: "Detailed chart browsing and analysis remain desktop gameplay." },
  festivals: { title: "Festivals", description: "Festival setup, applications and management remain desktop gameplay." },
  events: { title: "Events", description: "Detailed event browsing and participation setup remain desktop gameplay." },
  search: { title: "World search", description: "Full world search stays on desktop. Mobile travel includes a focused city search." },
  city: { title: "City details", description: "Full city exploration and detailed local systems remain desktop gameplay." },
  locations: { title: "Locations", description: "Detailed location discovery remains desktop gameplay." },
};

const modeIcon = (mode: string) => {
  if (mode === "train") return <Train className="h-5 w-5" />;
  if (mode === "bus") return <Bus className="h-5 w-5" />;
  if (mode === "ship" || mode === "ferry") return <Ship className="h-5 w-5" />;
  return <Plane className="h-5 w-5" />;
};

const money = (value: number) => value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cashValue = (profile: any): number | null => {
  if (profile?.cash == null) return null;
  const value = Number(profile.cash);
  return Number.isFinite(value) ? value : null;
};
const cashLabel = (profile: any) => {
  const value = cashValue(profile);
  return value == null ? "Unavailable" : money(value);
};

const formatTravelTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

export function travelDepartureInstant(date: Date, hour: number, mode: string): Date {
  const departure = new Date(date);
  if (mode.toLowerCase() === "private_jet") return departure;
  departure.setHours(hour, 0, 0, 0);
  return departure;
}

function formatTravelDeparture(date: Date, hour: number, mode: string): string {
  if (mode.toLowerCase() !== "private_jet") return formatDepartureDateTime(date, hour);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function legacyCurrentTravel(activityStatus: any): TravelDisplay | null {
  if (!activityStatus) return null;
  const type = String(activityStatus.activity_type ?? "").toLowerCase();
  const status = String(activityStatus.status ?? "").toLowerCase();
  if (!type.includes("travel") || !["active", "in_progress"].includes(status)) return null;

  const now = Date.now();
  const start = activityStatus.started_at ? new Date(activityStatus.started_at).getTime() : NaN;
  const end = activityStatus.ends_at ? new Date(activityStatus.ends_at).getTime() : NaN;
  if (Number.isFinite(start) && start > now) return null;
  if (Number.isFinite(end) && end <= now) return null;

  return {
    status: "in_progress",
    startsAt: activityStatus.started_at,
    endsAt: activityStatus.ends_at,
    toName: activityStatus.metadata?.to_city_name ?? activityStatus.metadata?.destination,
    transportType: activityStatus.metadata?.transport_type,
  };
}

function travelFromHistory(record: MobileTravelRecord | null | undefined): TravelDisplay | null {
  if (!record) return null;
  return {
    status: record.effectiveStatus,
    startsAt: record.scheduled_departure_time ?? record.departure_time,
    endsAt: record.arrival_time,
    fromName: record.fromCityName,
    toName: record.toCityName,
    transportType: record.transport_type,
  };
}

function resolveTravelDisplay(record: MobileTravelRecord | null | undefined, activityStatus: any): TravelDisplay | null {
  return travelFromHistory(record) ?? legacyCurrentTravel(activityStatus);
}

function useMobileTravelState(profileId?: string | null) {
  return useQuery({
    queryKey: ["mobile-travel-state", profileId],
    enabled: !!profileId,
    staleTime: 15_000,
    queryFn: async (): Promise<MobileTravelRecord | null> => {
      if (!profileId) return null;
      const now = new Date();
      const { data, error } = await (supabase as any)
        .from("player_travel_history")
        .select("id,from_city_id,to_city_id,transport_type,cost_paid,departure_time,scheduled_departure_time,arrival_time,status")
        .eq("profile_id", profileId)
        .in("status", ["scheduled", "in_progress"])
        .gt("arrival_time", now.toISOString())
        .order("scheduled_departure_time", { ascending: true })
        .limit(5);
      if (error) throw error;

      const rows = (data ?? []) as Omit<MobileTravelRecord, "effectiveStatus">[];
      const row = rows.find((candidate) => {
        const end = candidate.arrival_time ? new Date(candidate.arrival_time).getTime() : NaN;
        return !Number.isFinite(end) || end > now.getTime();
      });
      if (!row) return null;

      const startValue = row.scheduled_departure_time ?? row.departure_time;
      const start = startValue ? new Date(startValue).getTime() : NaN;
      const end = row.arrival_time ? new Date(row.arrival_time).getTime() : NaN;
      const effectiveStatus: TravelDisplayStatus = Number.isFinite(start)
        && start <= now.getTime()
        && (!Number.isFinite(end) || end > now.getTime())
        ? "in_progress"
        : "scheduled";

      const cityIds = Array.from(new Set([row.from_city_id, row.to_city_id].filter(Boolean))) as string[];
      let cityMap = new Map<string, string>();
      if (cityIds.length) {
        const { data: cityRows, error: cityError } = await supabase
          .from("cities")
          .select("id,name,country")
          .in("id", cityIds);
        if (cityError) {
          console.warn("[RockMundo mobile travel] city labels unavailable", cityError);
        } else {
          cityMap = new Map((cityRows ?? []).map((city) => [city.id, `${city.name}, ${city.country}`]));
        }
      }

      return {
        ...row,
        effectiveStatus,
        fromCityName: row.from_city_id ? cityMap.get(row.from_city_id) : undefined,
        toCityName: row.to_city_id ? cityMap.get(row.to_city_id) : undefined,
      };
    },
  });
}

function travelBookingMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("Insufficient funds")) return "You do not have enough character funds for this journey.";
  if (message.includes("Time slot conflict")) return message;
  if (message.includes("active character")) return "The active character could not be verified. Refresh and try again.";
  if (message.includes("Not authenticated")) return "Your session could not be verified. Sign in again and retry.";
  return "Travel could not be booked. Refresh your travel state and try again.";
}

function Shell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <MobilePageShell>
      <MobileSectionHeader eyebrow="World" title={title} description={description} />
      <nav aria-label="World companion sections" className="grid grid-cols-2 gap-2">
        <Link to="/mobile/world" className="rm-tap rounded-xl border p-3 text-center text-sm font-semibold">Overview</Link>
        <Link to="/mobile/world/travel" className="rm-tap rounded-xl border p-3 text-center text-sm font-semibold">Travel</Link>
      </nav>
      {children}
    </MobilePageShell>
  );
}

export default function MobileWorldPhase5() {
  const { section } = useParams();
  if (section === "travel") return <TravelMobile />;
  if (section && section in desktopOnly) return <DesktopOnly section={section as DesktopSection} />;
  return <WorldOverviewMobile />;
}

function WorldOverviewMobile() {
  const { currentCity, activityStatus, profile, refetch: refetchGameData } = useGameData();
  const travelState = useMobileTravelState(profile?.id);
  const travel = resolveTravelDisplay(travelState.data, activityStatus);
  const travelling = travel?.status === "in_progress";
  const scheduled = travel?.status === "scheduled";
  const locationMissing = !currentCity && !travel;
  const travelEnd = formatTravelTime(travel?.endsAt);
  const travelStart = formatTravelTime(travel?.startsAt);

  const statusTitle = travelling
    ? `Travelling${travel?.toName ? ` to ${travel.toName}` : ""}`
    : scheduled
      ? `Travel booked${travel?.toName ? ` to ${travel.toName}` : ""}`
      : currentCity?.name ?? "Location unavailable";
  const statusSubtitle = travelling
    ? travelEnd ? `Journey due to finish ${travelEnd}` : "Journey in progress"
    : scheduled
      ? travelStart ? `Departs ${travelStart}` : "Future journey booked"
      : [currentCity?.country, currentCity?.region].filter(Boolean).join(" • ") || "Current city unavailable";

  return (
    <Shell title={currentCity?.name ?? "World"} description="Mobile World is intentionally lightweight: check where you are, monitor travel and book a simple journey.">
      {travelState.isError && <MobileErrorState title="Travel status unavailable" message="Your booked journeys could not be checked." onRetry={() => travelState.refetch()} />}
      <MobileSectionCard title="Current status">
        <MobileEntityCard
          title={statusTitle}
          subtitle={statusSubtitle}
          icon={travel ? <Plane className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          meta={<MobileStatusBadge tone={travelling || scheduled ? "info" : locationMissing ? "warning" : "success"}>{travelling ? "Travelling" : scheduled ? "Booked" : locationMissing ? "Unavailable" : "Available"}</MobileStatusBadge>}
        />
      </MobileSectionCard>

      {locationMissing && (
        <MobileErrorState
          title="Location unavailable"
          message="Your current city could not be loaded, so travel cannot be planned safely."
          onRetry={() => refetchGameData()}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link to="/mobile/world/travel" className="rm-tap rounded-2xl border p-4">
          <Plane className="mb-2 h-6 w-6" />
          <div className="font-semibold">Plan travel</div>
          <div className="mt-1 text-xs text-muted-foreground">Choose a city and transport option.</div>
        </Link>
        <Link to="/mobile?view=day" className="rm-tap rounded-2xl border p-4">
          <CalendarClock className="mb-2 h-6 w-6" />
          <div className="font-semibold">My Day</div>
          <div className="mt-1 text-xs text-muted-foreground">See travel alongside today’s schedule.</div>
        </Link>
      </div>

      <MobileSectionCard title="Character funds" subtitle="Travel booking uses the same balance and conflict checks as desktop.">
        <p className="text-2xl font-bold">{cashLabel(profile)}</p>
      </MobileSectionCard>

      <MobileSectionCard title="Desktop world gameplay" subtitle="Deliberately not duplicated on mobile.">
        <p className="text-sm text-muted-foreground">
          Shops, marketplace trading, detailed jobs, companies, venue management, festivals, city administration and deeper exploration stay on desktop.
        </p>
      </MobileSectionCard>
    </Shell>
  );
}

function useCities() {
  return useQuery({
    queryKey: ["mobile-travel-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id,name,country,region,latitude,longitude,music_scene,population,is_coastal,has_train_network")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CityWithCoords[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function TravelMobile() {
  const { currentCity, activityStatus, profile, refetch: refetchGameData } = useGameData();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const cities = useCities();
  const travelState = useMobileTravelState(profileId);
  const [term, setTerm] = useState("");
  const [destination, setDestination] = useState<CityWithCoords | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const fromCity = currentCity as CityWithCoords | null;
  const travel = resolveTravelDisplay(travelState.data, activityStatus);
  const travelling = travel?.status === "in_progress";
  const scheduledTravel = travel?.status === "scheduled";
  const hasTravelCommitment = travelling || scheduledTravel;
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (cities.data ?? [])
      .filter((city) => city.id !== fromCity?.id)
      .filter((city) => !q || `${city.name} ${city.country} ${city.region ?? ""}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [cities.data, fromCity?.id, term]);

  const options = useMemo(() => {
    if (!fromCity || !destination || fromCity.latitude == null || fromCity.longitude == null || destination.latitude == null || destination.longitude == null) return [] as TravelOption[];
    const distanceKm = calculateDistance(fromCity.latitude, fromCity.longitude, destination.latitude, destination.longitude);
    return getAvailableModes(distanceKm, fromCity, destination).filter((option) => option.available);
  }, [fromCity, destination]);

  const chosen = options.find((option) => option.mode === selectedMode) ?? options[0] ?? null;
  const departure = chosen ? getNextAvailableDeparture(chosen.mode) : null;
  const funds = cashValue(profile);
  const insufficientFunds = !!chosen && funds != null && funds < chosen.cost;

  const chooseDestination = (city: CityWithCoords) => {
    setDestination(city);
    if (!fromCity || fromCity.latitude == null || fromCity.longitude == null || city.latitude == null || city.longitude == null) {
      setSelectedMode(null);
      return;
    }
    const distanceKm = calculateDistance(fromCity.latitude, fromCity.longitude, city.latitude, city.longitude);
    const available = getAvailableModes(distanceKm, fromCity, city).filter((option) => option.available);
    const cheapest = available.length ? available.reduce((best, option) => option.cost < best.cost ? option : best) : null;
    setSelectedMode(cheapest?.mode ?? null);
  };

  const confirmTravel = async () => {
    if (!profileId || !fromCity || !destination || !chosen || !departure || hasTravelCommitment || travelState.isError || travelState.isLoading) return;
    if (insufficientFunds) {
      toast.error("You do not have enough character funds for this journey.");
      return;
    }
    const scheduledDeparture = travelDepartureInstant(departure.date, departure.hour, chosen.mode);
    setBooking(true);
    try {
      await bookTravel({
        profileId,
        fromCityId: fromCity.id,
        toCityId: destination.id,
        routeId: `dynamic-${fromCity.id}-${destination.id}`,
        transportType: chosen.mode,
        cost: chosen.cost,
        durationHours: chosen.durationHours,
        comfortRating: chosen.comfort,
        scheduledDepartureTime: scheduledDeparture.toISOString(),
      });
      toast.success(`Travel booked to ${destination.name}`, {
        description: `Departure ${scheduledDeparture.toLocaleString()}`,
      });
      await Promise.all([
        refetchGameData(),
        queryClient.invalidateQueries({ queryKey: ["mobile-travel-state"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-day-schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["week-scheduled-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] }),
      ]);
      setDestination(null);
      setSelectedMode(null);
    } catch (error: unknown) {
      toast.error(travelBookingMessage(error));
    } finally {
      setBooking(false);
    }
  };

  const travelStart = formatTravelTime(travel?.startsAt);
  const travelEnd = formatTravelTime(travel?.endsAt);

  return (
    <Shell title="Travel" description="Choose a destination, compare the available transport modes and book the next valid departure.">
      {travelState.isLoading && <MobileLoadingSkeleton cards={1} />}
      {travelState.isError && <MobileErrorState title="Travel status unavailable" message="Existing journeys could not be checked. Retry before booking another trip." onRetry={() => travelState.refetch()} />}

      {travel && (
        <MobileSectionCard title={travelling ? "Journey in progress" : "Journey booked"}>
          <MobileEntityCard
            title={travelling ? `Travelling${travel.toName ? ` to ${travel.toName}` : ""}` : `Upcoming travel${travel.toName ? ` to ${travel.toName}` : ""}`}
            subtitle={travelling
              ? travelEnd ? `Expected completion ${travelEnd}` : "Your journey is in progress."
              : [travelStart ? `Departs ${travelStart}` : null, travelEnd ? `arrives ${travelEnd}` : null].filter(Boolean).join(" · ") || "Future journey booked"}
            icon={<Plane className="h-5 w-5" />}
            meta={<MobileStatusBadge tone="info">{travelling ? "Active" : "Scheduled"}</MobileStatusBadge>}
          />
        </MobileSectionCard>
      )}

      <MobileSectionCard title="From">
        <MobileEntityCard
          title={fromCity?.name ?? "Current city unavailable"}
          subtitle={[fromCity?.country, fromCity?.region].filter(Boolean).join(" • ") || "Travel data unavailable"}
          icon={<MapPin className="h-5 w-5" />}
          meta={<MobileStatusBadge tone={fromCity ? "neutral" : "warning"}>{fromCity ? cashLabel(profile) : "Unavailable"}</MobileStatusBadge>}
        />
      </MobileSectionCard>

      {!fromCity && (
        <MobileErrorState
          title="Current city unavailable"
          message="A journey cannot be priced or booked safely until your current city is loaded."
          onRetry={() => refetchGameData()}
        />
      )}

      {hasTravelCommitment && (
        <MobileSectionCard title="Travel already planned" subtitle="Mobile keeps one journey at a time simple and location-safe.">
          <p className="text-sm text-muted-foreground">Check the journey in My Day. Plan another trip after this journey finishes so the next route starts from your actual city.</p>
          <Link to="/mobile?view=day" className="rm-tap mt-3 block rounded-xl border p-3 text-center text-sm font-semibold">Open My Day</Link>
        </MobileSectionCard>
      )}

      {fromCity && !hasTravelCommitment && !travelState.isLoading && !travelState.isError && (
        <MobileSectionCard title="Find destination" subtitle="City search only; deeper world discovery remains desktop-only.">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border px-3">
            <Search className="h-4 w-4" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search city or country" className="min-h-11 flex-1 bg-transparent outline-none" aria-label="Search destinations" />
          </div>
          {cities.isLoading ? <MobileLoadingSkeleton /> : cities.isError ? (
            <MobileErrorState message="Destinations could not be loaded." onRetry={() => cities.refetch()} />
          ) : filtered.length ? (
            <div className="mt-3 space-y-2">
              {filtered.map((city) => (
                <MobileEntityCard
                  key={city.id}
                  title={city.name}
                  subtitle={[city.country, city.region].filter(Boolean).join(" • ")}
                  icon={<MapPin className="h-5 w-5" />}
                  meta={destination?.id === city.id ? <MobileStatusBadge tone="success">Selected</MobileStatusBadge> : null}
                  onPress={() => chooseDestination(city)}
                />
              ))}
            </div>
          ) : <EmptyState title="No destinations found" message="Try another city or country." />}
        </MobileSectionCard>
      )}

      {destination && fromCity && !hasTravelCommitment && !travelState.isError && (
        <MobileSectionCard title={`Travel to ${destination.name}`} subtitle="The cheapest available option is selected initially; choose another mode if you prefer.">
          {options.length ? (
            <div className="space-y-3">
              {options.map((option) => (
                <button
                  type="button"
                  key={option.mode}
                  onClick={() => setSelectedMode(option.mode)}
                  className={`rm-tap flex w-full items-center justify-between rounded-xl border p-3 text-left ${chosen?.mode === option.mode ? "border-primary bg-primary/5" : ""}`}
                >
                  <span className="flex items-center gap-3">
                    {modeIcon(option.mode)}
                    <span>
                      <span className="block font-semibold capitalize">{option.mode.replace("_", " ")}</span>
                      <span className="block text-xs text-muted-foreground">{option.durationHours.toFixed(1)}h · comfort {option.comfort}/100</span>
                    </span>
                  </span>
                  <span className="font-semibold">{money(option.cost)}</span>
                </button>
              ))}

              {chosen && departure && (
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="font-semibold">Next departure</div>
                  <div className="text-muted-foreground">{formatTravelDeparture(departure.date, departure.hour, chosen.mode)}</div>
                </div>
              )}

              {insufficientFunds && <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">You need {chosen ? money(chosen.cost) : "more funds"} for this journey. Your current balance is {cashLabel(profile)}.</p>}
              <Button className="min-h-11 w-full" disabled={!chosen || !departure || booking || insufficientFunds} onClick={confirmTravel}>
                {booking ? "Booking…" : insufficientFunds ? "Insufficient funds" : chosen ? `Book ${chosen.mode.replace("_", " ")} · ${money(chosen.cost)}` : "Choose transport"}
              </Button>
              <p className="text-xs text-muted-foreground">Balance and schedule conflicts are rechecked by the same travel system used on desktop.</p>
            </div>
          ) : (
            <EmptyState title="No route available" message="This city pair does not currently have an available transport mode." />
          )}
        </MobileSectionCard>
      )}
    </Shell>
  );
}

function DesktopOnly({ section }: { section: DesktopSection }) {
  const item = desktopOnly[section];
  return (
    <Shell title={item.title} description={item.description}>
      <MobileSectionCard title="Desktop gameplay" subtitle="This is intentionally outside the mobile companion scope.">
        <div className="flex gap-3">
          <Monitor className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm text-muted-foreground">Use the desktop game for the full workflow. Mobile keeps the related status and scheduled outcomes visible through Home and My Day where relevant.</p>
        </div>
      </MobileSectionCard>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/mobile" className="rm-tap rounded-xl border p-3 text-center text-sm font-semibold">Mobile Home</Link>
        <Link to="/mobile?view=day" className="rm-tap rounded-xl border p-3 text-center text-sm font-semibold">My Day</Link>
      </div>
    </Shell>
  );
}
