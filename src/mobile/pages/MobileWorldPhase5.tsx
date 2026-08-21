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

const currentTravel = (activityStatus: any) => {
  if (!activityStatus) return null;
  const type = String(activityStatus.activity_type ?? "").toLowerCase();
  const status = String(activityStatus.status ?? "").toLowerCase();
  if (!type.includes("travel") || !["active", "in_progress"].includes(status)) return null;

  const now = Date.now();
  const start = activityStatus.started_at ? new Date(activityStatus.started_at).getTime() : NaN;
  const end = activityStatus.ends_at ? new Date(activityStatus.ends_at).getTime() : NaN;
  if (Number.isFinite(start) && start > now) return null;
  if (Number.isFinite(end) && end <= now) return null;
  return activityStatus;
};

const cashLabel = (profile: any) => profile?.cash == null ? "Unavailable" : money(Number(profile.cash));

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
  const { currentCity, activityStatus, profile } = useGameData();
  const activeTravel = currentTravel(activityStatus);
  const travelling = !!activeTravel;
  const endsAt = activeTravel?.ends_at;

  return (
    <Shell title={currentCity?.name ?? "World"} description="Mobile World is intentionally lightweight: check where you are, monitor travel and book a simple journey.">
      <MobileSectionCard title="Current status">
        <MobileEntityCard
          title={travelling ? "Travel in progress" : currentCity?.name ?? "Location unavailable"}
          subtitle={travelling && endsAt ? `Journey due to finish ${new Date(endsAt).toLocaleString()}` : [currentCity?.country, currentCity?.region].filter(Boolean).join(" • ") || "Current city"}
          icon={travelling ? <Plane className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          meta={<MobileStatusBadge tone={travelling ? "info" : "success"}>{travelling ? "Travelling" : "Available"}</MobileStatusBadge>}
        />
      </MobileSectionCard>

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
  const { currentCity, activityStatus, profile } = useGameData();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const cities = useCities();
  const [term, setTerm] = useState("");
  const [destination, setDestination] = useState<CityWithCoords | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const fromCity = currentCity as CityWithCoords | null;
  const activeTravel = currentTravel(activityStatus);
  const travelling = !!activeTravel;
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
    if (!profileId || !fromCity || !destination || !chosen || !departure) return;
    const scheduledDeparture = new Date(departure.date);
    scheduledDeparture.setHours(departure.hour, 0, 0, 0);
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
      toast.success(`Travel booked to ${destination.name}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["week-scheduled-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] }),
      ]);
      setDestination(null);
      setSelectedMode(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Travel could not be booked");
    } finally {
      setBooking(false);
    }
  };

  return (
    <Shell title="Travel" description="Choose a destination, compare the available transport modes and book the next valid departure.">
      {travelling && (
        <MobileSectionCard title="Journey in progress">
          <MobileEntityCard
            title="You are currently travelling"
            subtitle={activeTravel?.ends_at ? `Expected completion ${new Date(activeTravel.ends_at).toLocaleString()}` : "Your active journey is still in progress."}
            icon={<Plane className="h-5 w-5" />}
            meta={<MobileStatusBadge tone="info">Active</MobileStatusBadge>}
          />
        </MobileSectionCard>
      )}

      <MobileSectionCard title="From">
        <MobileEntityCard
          title={fromCity?.name ?? "Current city unavailable"}
          subtitle={[fromCity?.country, fromCity?.region].filter(Boolean).join(" • ") || "Travel data unavailable"}
          icon={<MapPin className="h-5 w-5" />}
          meta={<MobileStatusBadge>{cashLabel(profile)}</MobileStatusBadge>}
        />
      </MobileSectionCard>

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

      {destination && (
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
                  <div className="text-muted-foreground">{formatDepartureDateTime(departure.date, departure.hour)}</div>
                </div>
              )}

              <Button className="min-h-11 w-full" disabled={!chosen || !departure || booking || travelling} onClick={confirmTravel}>
                {travelling ? "Finish current journey first" : booking ? "Booking…" : chosen ? `Book ${chosen.mode.replace("_", " ")} · ${money(chosen.cost)}` : "Choose transport"}
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
