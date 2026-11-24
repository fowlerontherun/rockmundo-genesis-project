import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import PublicFestivalPage from "@/features/festival-company/ui/PublicFestivalPage";
import { ArrowLeft, CalendarDays, MapPin, Music2, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePublicFestival, usePublicFestivalDirectory } from "@/features/festival-company/application/useFestivalLaunch";
import { FestivalBrandArtwork } from "@/features/festival-company/ui/FestivalBrandArtwork";
import { getFestivalPublicEventPhase } from "@/features/festival-company/ui/festivalEventPhase";
import {
  festivalVisitorEventLabel,
  festivalVisitorSalesLabel,
  formatFestivalEditionDate,
  formatFestivalEditionTime,
  isPublishedFestivalPerformance,
} from "@/features/festival-company/ui/festivalPublicDisplay";
import { MobileSectionHeader } from "../components/MobilePrimitives";

/** The companion is a read-only festival guide; bookings and payments stay on desktop. */
export default function MobileFestivals() {
  const { data: editions = [], isPending, isError, refetch } = usePublicFestivalDirectory();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 10_000); return () => window.clearInterval(timer); }, []);
  return (
    <section className="min-w-0 space-y-4" aria-label="Festival guide">
      <MobileSectionHeader eyebrow="Mobile Companion" title="Festivals" description="Festival tickets, line-ups and your wristband" />
      {isPending && <p role="status">Loading festivals…</p>}
      {isError && <div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
        Festival information is unavailable. The last published availability cannot be verified.
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => void refetch()}>Retry festivals</Button>
      </div>}
      {!isPending && !isError && editions.length === 0 && <p role="status" className="rounded-xl border p-4 text-sm">No public festival editions are currently announced.</p>}
      {!isPending && !isError && editions.map((edition) => {
        const phase = getFestivalPublicEventPhase(edition.startsAt, edition.endsAt, now);
        const sales = edition.soldOut && edition.launchStatus === "tickets_on_sale" && phase !== "dates_ended"
          ? "Sold out" : festivalVisitorSalesLabel(phase, edition.launchStatus);
        return <Link to={`/mobile/festivals/${encodeURIComponent(edition.slug)}`} key={edition.id} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <Card className="overflow-hidden">
            <FestivalBrandArtwork festival={edition} />
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 font-bold">{edition.name}</h2><Badge variant="secondary">{festivalVisitorEventLabel(phase, edition.launchStatus)}</Badge></div>
              <p className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0" />{edition.city}, {edition.country}</p>
              <p className="flex items-start gap-2 text-sm"><CalendarDays className="h-4 w-4 shrink-0" />{formatFestivalEditionDate(edition.startsAt, edition.timezone)}</p>
              <p className="text-xs text-muted-foreground">{sales} · View festival details</p>
            </CardContent>
          </Card>
        </Link>;
      })}
    </section>
  );
}

export function MobileFestivalDetail() {
  const { festivalCompanyIdentifier } = useParams();
  return <section className="min-w-0"><Button variant="outline" size="sm" asChild><Link to="/mobile/festivals"><ArrowLeft className="mr-1 h-4 w-4" /> All festivals</Link></Button><PublicFestivalPage publicSlug={festivalCompanyIdentifier} /></section>;
}

export function MobileFestivalPublishedGuide() {
  const { festivalCompanyIdentifier } = useParams();
  const { data: edition, isPending, isError, refetch } = usePublicFestival(festivalCompanyIdentifier);
  const back = <Link to="/mobile/festivals" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" /> All festivals</Link>;
  if (isPending) return <section className="space-y-3">{back}<p role="status">Loading festival details…</p></section>;
  if (isError) return <section className="space-y-3">{back}<div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">Festival details could not be verified.<Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => void refetch()}>Retry festival details</Button></div></section>;
  if (!edition) return <section className="space-y-3">{back}<p role="alert">Festival not found.</p></section>;

  const phase = getFestivalPublicEventPhase(edition.startsAt, edition.endsAt, Date.now());
  const sales = edition.soldOut && edition.launchStatus === "tickets_on_sale" && phase !== "dates_ended"
    ? "Sold out" : festivalVisitorSalesLabel(phase, edition.launchStatus);
  const published = (edition.lineup ?? []).filter(isPublishedFestivalPerformance)
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
  return <article className="min-w-0 space-y-4" aria-label={`${edition.name} festival details`}>
    {back}
    <div className="overflow-hidden rounded-xl border">
      <FestivalBrandArtwork festival={edition} />
      <div className="space-y-2 p-3">
        <Badge>{festivalVisitorEventLabel(phase, edition.launchStatus)}</Badge>
        <h1 className="text-2xl font-bold">{edition.name}</h1>
        {edition.tagline && <p className="text-sm">{edition.tagline}</p>}
        <p className="text-sm"><MapPin className="mr-1 inline h-4 w-4" />{edition.city}, {edition.country}</p>
        <p className="text-sm"><CalendarDays className="mr-1 inline h-4 w-4" />{formatFestivalEditionDate(edition.startsAt, edition.timezone)} – {formatFestivalEditionDate(edition.endsAt, edition.timezone)}</p>
        <p className="text-xs text-muted-foreground">Festival local time: {edition.timezone}</p>
        <p className="text-sm">{edition.description}</p>
      </div>
    </div>
    <section className="space-y-2 rounded-xl border p-3" aria-labelledby="mobile-festival-tickets">
      <h2 id="mobile-festival-tickets" className="flex items-center gap-2 font-semibold"><Ticket className="h-4 w-4" /> Admission & tickets</h2>
      <p className="text-sm">{sales}</p>
      <p className="text-xs text-muted-foreground">Check admission, your ticket wallet and check-in in the full desktop game. Purchases are not available in the mobile companion.</p>
    </section>
    <section className="space-y-2" aria-labelledby="mobile-festival-lineup">
      <h2 id="mobile-festival-lineup" className="flex items-center gap-2 font-semibold"><Music2 className="h-4 w-4" /> Published stage times</h2>
      {!published.length && <p className="rounded-xl border p-3 text-sm text-muted-foreground">No confirmed performance times have been published yet.</p>}
      {published.map((act) => <Card key={act.id}><CardContent className="space-y-1 p-3">
        <h3 className="font-semibold">{act.artistName}</h3>
        <p className="text-sm text-muted-foreground">{act.stageName}</p>
        <p className="text-sm">{formatFestivalEditionDate(act.startsAt!, edition.timezone)} · {formatFestivalEditionTime(act.startsAt!, edition.timezone)}</p>
      </CardContent></Card>)}
    </section>
    {edition.information.accessibility && <section className="rounded-xl border p-3"><h2 className="font-semibold">Accessibility</h2><p className="mt-1 whitespace-pre-wrap text-sm">{edition.information.accessibility}</p></section>}
    {edition.information.travel && <section className="rounded-xl border p-3"><h2 className="font-semibold">Getting there</h2><p className="mt-1 whitespace-pre-wrap text-sm">{edition.information.travel}</p></section>}
  </article>;
}
