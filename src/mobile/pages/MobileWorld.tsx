import { useNavigate } from "react-router-dom";
import { Building2, CalendarClock, LineChart, MapPin, Plane, Store } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { QuickActionCard } from "../components/QuickActionCard";
import { EmptyState } from "../components/EmptyState";
import { MobileEntityCard, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge, MobileTimeline, MobileTimelineItem } from "../components/MobilePrimitives";

export default function MobileWorld() {
  const navigate = useNavigate();
  const { currentCity, activities, activityStatus } = useGameData();
  const travelActive = String((activityStatus as any)?.activity_type ?? "").includes("travel");
  const actions = [
    ["Travel", <Plane className="h-5 w-5" />, "/travel"], ["View City", <MapPin className="h-5 w-5" />, "/world/current-city"],
    ["Marketplace", <Store className="h-5 w-5" />, "/gear-shop"], ["Charts", <LineChart className="h-5 w-5" />, "/competitive-charts"],
    ["Venues", <Building2 className="h-5 w-5" />, "/venues"], ["Events", <CalendarClock className="h-5 w-5" />, "/major-events"],
    ["Companies", <Building2 className="h-5 w-5" />, "/companies/directory"],
  ] as const;
  return <MobilePageShell>
    <MobileSectionHeader eyebrow="World" title={currentCity?.name ?? "Explore"} description="Travel, venues, markets, charts and city events in one hand." action={<MobileStatusBadge tone={travelActive ? "info" : "neutral"}>{travelActive ? "Travelling" : "Local"}</MobileStatusBadge>} />
    <section><h2 className="mb-2 px-1 text-[15px] font-bold">Quick actions</h2><div className="grid grid-cols-4 gap-2">{actions.map(([label, icon, to]) => <QuickActionCard key={label} label={label} icon={icon} to={to} />)}</div></section>
    <MobileSectionCard title="Where you are" subtitle="Current city and nearby opportunities">
      <MobileEntityCard title={currentCity?.name ?? "No city loaded"} subtitle={currentCity ? [currentCity.country, currentCity.region].filter(Boolean).join(" • ") : "Travel data is unavailable"} icon={<MapPin className="h-5 w-5" />} onPress={() => navigate("/world/current-city")} />
    </MobileSectionCard>
    <MobileSectionCard title="World highlights"><div className="grid grid-cols-2 gap-2">{actions.slice(2).map(([label, icon, to]) => <MobileEntityCard key={label} title={label} subtitle="Open" icon={icon} onPress={() => navigate(to)} />)}</div></MobileSectionCard>
    <MobileSectionCard title="Recent world activity">{activities.length ? <MobileTimeline>{activities.slice(0, 4).map((a: any) => <MobileTimelineItem key={a.id} title={a.message ?? a.activity_type} detail={a.created_at ? new Date(a.created_at).toLocaleString() : undefined} />)}</MobileTimeline> : <EmptyState title="No world activity" message="Travel, events and marketplace updates will appear here." />}</MobileSectionCard>
  </MobilePageShell>;
}
