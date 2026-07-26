import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Award, History, Radio, Trophy } from "lucide-react";
import { festivalLegacyService } from "@/features/festivals/legacy/service";
import type { FestivalAward, FestivalLegacyFilter, FestivalRecord, FestivalResult } from "@/features/festivals/legacy/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const links = [["Results", "/festivals/results"], ["History", "/festivals/history"], ["Awards", "/festivals/awards"], ["Hall of Fame", "/festivals/hall-of-fame"], ["World records", "/festivals/records"], ["Statistics", "/festivals/statistics"]];

export default function FestivalLegacyPage() {
  const { pathname } = useLocation();
  const section = pathname.split("/").pop() ?? "results";
  const [filter, setFilter] = useState<FestivalLegacyFilter>({});
  const [items, setItems] = useState<Array<FestivalResult | FestivalAward | FestivalRecord>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    const request = section === "awards" ? festivalLegacyService.awards(filter.year) : section === "records" ? festivalLegacyService.records() : section === "hall-of-fame" ? festivalLegacyService.hallOfFame() : section === "statistics" ? festivalLegacyService.statistics(filter).then((value) => [{ id: "statistics", holderName: "Festival totals", category: "statistics", value: value.attendance, unit: `attendees across ${value.editions} editions`, achievedYear: filter.year ?? new Date().getFullYear() } as FestivalRecord]) : festivalLegacyService[section === "history" ? "history" : "results"](filter);
    request.then(setItems).catch(() => setError("Festival legacy data is temporarily unavailable."));
  }, [filter, section]);

  return <main className="container mx-auto space-y-6 py-8" aria-labelledby="legacy-title">
    <header className="rounded-xl bg-gradient-to-r from-purple-950 to-slate-950 p-8 text-white">
      <div className="flex items-center gap-3"><Trophy /><h1 id="legacy-title" className="text-3xl font-bold">Festival Legacy</h1></div>
      <p className="mt-2 text-slate-300">Immutable results, honours and records from RockMundo festival history.</p>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label="Festival legacy sections">{links.map(([label, href]) => <Link key={href} to={href}><Badge variant={pathname === href ? "default" : "outline"}>{label}</Badge></Link>)}</nav>
    {!['awards','records','hall-of-fame'].includes(section) && <section className="grid gap-3 md:grid-cols-5" aria-label="Archive filters">
      <Input aria-label="Year" type="number" placeholder="Year" onChange={(e) => setFilter((v) => ({...v, year: e.target.value ? Number(e.target.value) : undefined}))}/>
      {(["country", "city", "festivalType", "genre"] as const).map((key) => <Input key={key} aria-label={key} placeholder={key === "festivalType" ? "Festival type" : key[0].toUpperCase()+key.slice(1)} onChange={(e) => setFilter((v) => ({...v, [key]: e.target.value || undefined}))}/>)}</section>}
    {error && <p role="alert">{error}</p>}
    {!error && items.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">No published festival legacy matches these filters.</CardContent></Card>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => {
      const result = item as FestivalResult; const award = item as FestivalAward; const record = item as FestivalRecord;
      return <Card key={item.id}><CardHeader><CardTitle className="flex items-center gap-2">{section === "awards" ? <Award /> : section === "records" ? <Radio /> : <History />}{result.festivalName ?? award.winnerName ?? record.holderName}</CardTitle></CardHeader><CardContent className="space-y-2">
        {result.editionYear && <><p>{result.city}, {result.country} · {result.editionYear}</p><p className="text-2xl font-semibold">{result.overallRating}/100</p><p>{result.attendance.toLocaleString()} attended · {result.soldOut ? "Sold out" : "Tickets available"}</p><p>{result.weatherSummary}</p></>}
        {award.category && <><Badge>{award.category.replaceAll("_", " ")}</Badge><p>{award.citation}</p><p>Score {award.score.toFixed(1)}</p></>}
        {record.category && <><Badge>{record.category.replaceAll("_", " ")}</Badge><p className="text-2xl font-semibold">{record.value.toLocaleString()} {record.unit}</p><p>Set in {record.achievedYear}</p></>}
      </CardContent></Card>;
    })}</section>
  </main>;
}
