import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { festivalCatalog, festivalCityKeys } from "@/data/festivals";
import { CalendarDays, MapPin, Ticket, Users } from "lucide-react";

export default function Festivals() {
  const defaultCity = festivalCityKeys[0] ?? "";
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [expandedFestivalId, setExpandedFestivalId] = useState<string | null>(null);

  const activeCity = festivalCatalog[selectedCity];

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2 text-center md:text-left">
        <Badge variant="secondary" className="text-sm uppercase tracking-wide">
          Festival Network Preview
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Festival Planning Hub</h1>
        <p className="max-w-3xl text-muted-foreground md:text-base">
          Explore how Rockmundo will surface festival intelligence once live feeds from partners, promoters, and booking teams
          connect. These placeholders help us shape the experience while real data pipelines are finalized.
        </p>
      </header>

      <Card className="border-dashed border-primary/40">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">Choose a host city</CardTitle>
            <CardDescription>
              Each city card will eventually mirror your routing priorities, radius clauses, and seasonal holds.
            </CardDescription>
          </div>
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              {festivalCityKeys.map((cityKey) => (
                <SelectItem key={cityKey} value={cityKey}>
                  {festivalCatalog[cityKey].cityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Currently viewing: <span className="font-medium text-foreground">{activeCity.cityName}</span>. Expect this summary to
            auto-adapt based on routing suggestions and fan engagement signals soon.
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {activeCity.description}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {activeCity.festivals.map((festival) => {
          const isExpanded = expandedFestivalId === festival.id;

          return (
            <Card key={festival.id} className="flex flex-col justify-between">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="uppercase tracking-wide">
                    {festival.dates}
                  </Badge>
                  {festival.genreTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{festival.name}</CardTitle>
                  <CardDescription>{festival.description}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {festival.venue}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {festival.dates}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {festival.attendance.typical} (max {festival.attendance.capacity})
                  </span>
                  <span className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" />
                    GA {festival.pricing.generalAdmission} · VIP {festival.pricing.vip}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Headliners preview
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {festival.currentLineup.headliners.map((artist) => (
                      <Badge key={artist} variant="outline" className="border-dashed">
                        {artist}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Ticketing notes: {festival.pricing.notes}
                  </p>
                  <p>Operations insight: {festival.attendance.capacity} expected once scheduling locks are confirmed.</p>
                </div>
                <Button
                  variant={isExpanded ? "secondary" : "outline"}
                  onClick={() => setExpandedFestivalId(isExpanded ? null : festival.id)}
                  aria-expanded={isExpanded}
                  className="w-full justify-center"
                >
                  {isExpanded ? "Hide detailed lineup" : "View full lineup"}
                </Button>

                {isExpanded && (
                  <div className="space-y-6">
                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Day-by-day breakdown
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {festival.currentLineup.daySplits.map((day) => (
                          <div
                            key={day.day}
                            className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 space-y-2"
                          >
                            <p className="text-sm font-semibold text-foreground">{day.day}</p>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              {day.highlightActs.map((act) => (
                                <li key={act} className="flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                                  {act}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Previous editions
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {festival.historicalLineups.map((history) => (
                          <div key={history.year} className="rounded-lg border border-border/60 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">{history.year}</Badge>
                              <span className="text-xs text-muted-foreground">{history.notes}</span>
                            </div>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              {history.headliners.map((act) => (
                                <li key={act}>{act}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <footer className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        These festival profiles are placeholders. Once the festival intelligence service goes live, this hub will update in
        real time with holds, travel logistics, and live ticket deltas. For now, use it to imagine how your team will plan
        multi-city runs.
      </footer>
    </div>
  );
}
