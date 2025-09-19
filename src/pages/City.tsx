import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { upcomingCityFestivals } from "@/data/festivals";
import { MapPin, Building2, Train, Plane, Music, Sparkles } from "lucide-react";

interface VenuePlaceholder {
  name: string;
  description: string;
  district: string;
  capacity: string;
}

interface StudioPlaceholder {
  name: string;
  specialties: string[];
  neighborhood: string;
}

interface TransportPlaceholder {
  type: "rail" | "air" | "local";
  name: string;
  description: string;
  distance: string;
}

const cityName = "Placeholder City";
const cityDescription =
  "A vibrant hub for aspiring musicians with a mix of legendary venues, intimate studios, an electric festival circuit, and easy transport links.";

const venuePlaceholders: VenuePlaceholder[] = [
  {
    name: "The Electric Plaza",
    description: "An iconic arena known for high-energy shows and a state-of-the-art light rig.",
    district: "Downtown Entertainment Quarter",
    capacity: "Large",
  },
  {
    name: "Riverfront Amphitheater",
    description: "Open-air venue overlooking the water, perfect for seasonal festivals and summer gigs.",
    district: "Harbor District",
    capacity: "Medium",
  },
  {
    name: "The Velvet Basement",
    description: "Intimate underground club where emerging acts cut their teeth.",
    district: "Old Town",
    capacity: "Small",
  },
];

const studioPlaceholders: StudioPlaceholder[] = [
  {
    name: "Skyline Studios",
    specialties: ["Full-band tracking", "Mixing & mastering", "Live session recording"],
    neighborhood: "Arts District",
  },
  {
    name: "Analog Alley",
    specialties: ["Vintage gear", "Tape recording", "Lo-fi production"],
    neighborhood: "Warehouse Row",
  },
  {
    name: "Pulse Lab",
    specialties: ["Electronic production", "Sample crafting", "Collaborative songwriting"],
    neighborhood: "Innovation Square",
  },
];

const transportPlaceholders: TransportPlaceholder[] = [
  {
    type: "rail",
    name: "Central Rail Terminal",
    description: "Direct lines to all major cities with late-night departures for touring crews.",
    distance: "8 minute walk from city center",
  },
  {
    type: "air",
    name: "Rockmundo International Airport",
    description: "Regional and international flights, plus dedicated cargo services for touring equipment.",
    distance: "25 minute express shuttle",
  },
  {
    type: "local",
    name: "Metro Loop",
    description: "Reliable subway loop connecting venues, rehearsal spaces, and accommodation zones.",
    distance: "Stations every 4-6 blocks",
  },
];

const transportIconMap: Record<TransportPlaceholder["type"], typeof Train> = {
  rail: Train,
  air: Plane,
  local: MapPin,
};

export default function City() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2 text-center md:text-left">
        <Badge variant="secondary" className="text-sm uppercase tracking-wide">
          City Overview
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{cityName}</h1>
        <p className="max-w-3xl text-muted-foreground md:text-base">
          {cityDescription} This page will soon adapt dynamically to your current location. For now, explore the
          placeholder highlights below to understand the information that will live here.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Key District Highlights
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {venuePlaceholders.map((venue) => (
            <div key={venue.name} className="rounded-lg border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{venue.name}</h3>
                  <p className="text-sm text-muted-foreground">{venue.district}</p>
                </div>
                <Badge variant="outline">{venue.capacity}</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{venue.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Studios & Creative Spaces
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {studioPlaceholders.map((studio) => (
              <div key={studio.name} className="rounded-lg border border-border/60 p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold">{studio.name}</h3>
                    <p className="text-sm text-muted-foreground">{studio.neighborhood}</p>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {studio.specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Train className="h-5 w-5 text-primary" />
              Transport Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transportPlaceholders.map((option) => {
              const Icon = transportIconMap[option.type];
              return (
                <div key={option.name} className="rounded-lg border border-border/60 p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="text-base font-semibold">{option.name}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {option.distance}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Festival Circuit Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcomingCityFestivals.map((festival) => (
              <div key={festival.name} className="flex flex-col justify-between rounded-lg border border-border/60 p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold leading-snug">{festival.name}</h3>
                      <p className="text-sm text-muted-foreground">{festival.location}</p>
                    </div>
                    <Badge variant="outline">{festival.dateRange}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">Headliners:</span> {festival.headliners.join(", ")}
                    </p>
                    <p className="flex flex-wrap gap-x-2">
                      <span className="font-semibold text-foreground">Attendance:</span>
                      <span>{festival.attendance}</span>
                    </p>
                    <p className="flex flex-wrap gap-x-2">
                      <span className="font-semibold text-foreground">Tickets:</span>
                      <span>{festival.ticketPrice}</span>
                    </p>
                  </div>
                </div>
                <div className="pt-4">
                  <Button asChild className="w-full" variant="secondary">
                    <a href={festival.lineupUrl} target="_blank" rel="noreferrer">
                      View Full Lineup
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
