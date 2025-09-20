import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface MemorableGig {
  name: string;
  date: string;
  notes?: string;
}

interface Pedal {
  name: string;
  usage: string;
}

interface DrumSection {
  label: string;
  items: string[];
}

interface GearItem {
  id: string;
  name: string;
  category: string;
  acquiredOn: string;
  acquiredFrom: string;
  conditionLabel: string;
  conditionDetails: string;
  notes?: string;
  memorableGigs?: MemorableGig[];
  pedals?: Pedal[];
  drumSetup?: DrumSection[];
  extras?: string[];
}

const gearCollection: GearItem[] = [
  {
    id: "stratocaster",
    name: "Fender American Professional II Stratocaster",
    category: "Electric Guitar",
    acquiredOn: "2021-03-18",
    acquiredFrom: "Sunset Boulevard Music Shop, Los Angeles",
    conditionLabel: "Stage Ready",
    conditionDetails: "Freshly set up with stainless frets and noiseless pickups—primary axe for festival sets.",
    notes: "Balanced for versatile tones. Lives in Drop D for heavier tracks but returns to standard tuning for studio sessions.",
    memorableGigs: [
      {
        name: "Moonlight Stadium Headliner",
        date: "2023-08-12",
        notes: "Opened with a 12-minute solo—crowd singalong captured in the live album mix.",
      },
      {
        name: "Neon Desert Showcase",
        date: "2022-05-27",
        notes: "First show debuting the new in-ear rig; guitar handled 90°F stage heat without tuning drift.",
      },
    ],
    pedals: [
      { name: "Ibanez Tube Screamer TS808", usage: "Primary mid-gain crunch for choruses." },
      { name: "Strymon BigSky", usage: "Shimmer pads for intro swells and ambient sections." },
      { name: "Boss DD-500", usage: "Sync'd dotted eighth delays for the encore." },
    ],
    extras: ["Elixir Optiweb 10-46", "Schaller locking strap buttons"],
  },
  {
    id: "martin-d28",
    name: "Martin D-28 Reimagined",
    category: "Acoustic Guitar",
    acquiredOn: "2019-11-02",
    acquiredFrom: "Heritage Strings Boutique, Nashville",
    conditionLabel: "Well Loved",
    conditionDetails: "Seasoned spruce top with a few tour-earned scuffs; fretboard recently conditioned.",
    notes: "Studio go-to for unplugged sessions and intimate livestreams. Warm low end pairs well with vocal harmonies.",
    memorableGigs: [
      {
        name: "Redwood Sessions Vol. 1",
        date: "2020-06-18",
        notes: "Recorded live-to-tape under the pines—captured natural reverb that made the final master.",
      },
      {
        name: "City Rooftop Livestream",
        date: "2021-04-30",
        notes: "Used for an acoustic rendition that hit 1.2M views in 48 hours.",
      },
    ],
    extras: ["LR Baggs Anthem pickup", "Custom leather strap from Echo Workshop"],
  },
  {
    id: "stage-custom",
    name: "Yamaha Stage Custom Birch",
    category: "Drum Kit",
    acquiredOn: "2022-09-10",
    acquiredFrom: "Rhythm Exchange Warehouse, Chicago",
    conditionLabel: "Tour Condition",
    conditionDetails: "Bearing edges resealed this season; shells packed in SKB cases for transport.",
    notes: "Configured for fast set changes. Trigger-ready for hybrid shows with electronic cues.",
    drumSetup: [
      {
        label: "Shell Pack",
        items: ['22" kick', '10" & 12" rack toms', '16" floor tom'],
      },
      {
        label: "Cymbals",
        items: ['Zildjian K Custom 21" ride', 'Paiste Masters 18" crash', 'Paiste PSTX 10" stack'],
      },
      {
        label: "Hardware & Extras",
        items: ["DW 9000 double pedal", "Roland RT-30 triggers", "In-ear click track hub"],
      },
    ],
    memorableGigs: [
      {
        name: "Thunder Bay Arena",
        date: "2023-11-04",
        notes: "Handled extended encore medley—no hardware creep on polished stage flooring.",
      },
      {
        name: "Midnight Carnival Tour",
        date: "2024-02-22",
        notes: "Integrated hybrid set with SPD-SX cues; flawless transitions between acoustic and electronic hits.",
      },
    ],
  },
  {
    id: "pedalboard",
    name: "Helix Floor + Analog Loop",
    category: "Pedalboard & Signal Chain",
    acquiredOn: "2020-01-08",
    acquiredFrom: "Direct order + boutique builders",
    conditionLabel: "Optimized",
    conditionDetails: "Signal path rewired with soldered patch cables; quiet and reliable even on noisy stages.",
    notes: "Modular rig that switches between the Stratocaster and session guitars within seconds.",
    pedals: [
      { name: "Line 6 Helix Floor", usage: "Primary amp modeling and routing brain." },
      { name: "JHS Morning Glory", usage: "Transparent drive stacked after the Tube Screamer." },
      { name: "EarthQuaker Devices Avalanche Run", usage: "Reverse delay textures for ambient soundscapes." },
      { name: "MXR Phase 95", usage: "Classic swirl for retro-inspired tracks." },
    ],
    extras: ["Temple Audio Trio 28 board", "Custom switcher for quick preset changes"],
  },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const MyGear: React.FC = () => {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">My Gear Vault</h1>
        <p className="text-muted-foreground">
          A living log of the instruments, pedals, and performance rigs fueling upcoming shows. Track acquisition stories,
          memorable gigs, and current condition at a glance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon: Interactive Gear Tracking</CardTitle>
          <CardDescription>
            This placeholder showcases how Rockmundo will catalog personal instruments, pedalboards, and drum setups. Expect
            editable fields, maintenance reminders, and integration with the inventory system in future updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use this layout to plan the data you&apos;d like to track—acquisition dates, store memories, and the gigs where each
            instrument shined. Custom tags for tunings, backup gear, and loan status will land here soon.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {gearCollection.map((gear) => (
          <Card key={gear.id} className="flex h-full flex-col">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">{gear.name}</CardTitle>
                  <CardDescription>{gear.category}</CardDescription>
                </div>
                <Badge variant="secondary">{gear.conditionLabel}</Badge>
              </div>
              {gear.notes ? <p className="text-sm text-muted-foreground">{gear.notes}</p> : null}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-6 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Acquired</p>
                  <p className="font-medium">{dateFormatter.format(new Date(gear.acquiredOn))}</p>
                  <p className="text-muted-foreground">{gear.acquiredFrom}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Current Condition</p>
                  <p className="font-medium">{gear.conditionDetails}</p>
                </div>
              </div>

              {gear.extras ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Extras & Maintenance</p>
                  <div className="flex flex-wrap gap-2">
                    {gear.extras.map((extra) => (
                      <Badge key={extra} variant="outline">
                        {extra}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {gear.pedals ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Pedals & Signal Chain</p>
                  <div className="space-y-2">
                    {gear.pedals.map((pedal) => (
                      <div key={pedal.name} className="rounded-md border border-dashed p-3">
                        <p className="font-medium">{pedal.name}</p>
                        <p className="text-xs text-muted-foreground">{pedal.usage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {gear.drumSetup ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Drum Equipment Breakdown</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {gear.drumSetup.map((section) => (
                      <div key={section.label} className="rounded-md border bg-muted/40 p-3">
                        <p className="text-sm font-semibold">{section.label}</p>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {section.items.map((item) => (
                            <li key={item} className="list-disc list-inside">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {gear.memorableGigs && gear.memorableGigs.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Memorable Gigs</p>
                  <div className="space-y-2">
                    {gear.memorableGigs.map((gig) => (
                      <div key={`${gear.id}-${gig.name}`} className="rounded-md border border-muted/60 bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{gig.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {dateFormatter.format(new Date(gig.date))}
                          </span>
                        </div>
                        {gig.notes ? <p className="mt-1 text-xs text-muted-foreground">{gig.notes}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyGear;
