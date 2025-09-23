// Updated Busking page with selectable locations and session lengths
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SESSION_LENGTHS = [30, 60, 120] as const;

type SessionLength = (typeof SESSION_LENGTHS)[number];

type SessionReward = {
  experience: number;
  cash: number;
};

type BuskingLocation = {
  id: string;
  name: string;
  neighborhood: string;
  description: string;
  vibe: string;
  tip: string;
  rewards: Record<SessionLength, SessionReward>;
};

const buskingLocations: BuskingLocation[] = [
  {
    id: 'market-square',
    name: 'Market Square',
    neighborhood: 'Old Town',
    description: 'Bustling stalls and coffee carts keep lunchtime crowds lingering.',
    vibe: 'Midday bustle',
    tip: 'Great spot for upbeat covers that catch shoppers on the move.',
    rewards: {
      30: { experience: 45, cash: 32 },
      60: { experience: 90, cash: 74 },
      120: { experience: 180, cash: 150 },
    },
  },
  {
    id: 'river-promenade',
    name: 'River Promenade',
    neighborhood: 'Harborfront',
    description: 'Evening strollers and bus tours bring a steady flow of tipsy tippers.',
    vibe: 'Sunset rush',
    tip: 'Lean into soulful ballads as the lights bounce off the water.',
    rewards: {
      30: { experience: 55, cash: 40 },
      60: { experience: 110, cash: 92 },
      120: { experience: 210, cash: 175 },
    },
  },
  {
    id: 'night-market',
    name: 'Neon Night Market',
    neighborhood: 'Arts District',
    description: 'Street food, neon booths, and late-night creatives pack the walkways.',
    vibe: 'After-dark energy',
    tip: 'Long-form jams thrive as the crowd settles in for the night.',
    rewards: {
      30: { experience: 70, cash: 52 },
      60: { experience: 135, cash: 108 },
      120: { experience: 260, cash: 210 },
    },
  },
];

const sessionOptions: { value: SessionLength; label: string; description: string }[] = [
  { value: 30, label: '30 minutes', description: 'Quick warm-up set.' },
  { value: 60, label: '1 hour', description: 'Prime-time showcase.' },
  { value: 120, label: '2 hours', description: 'Full evening takeover.' },
];

export default function Busking() {
  const [selectedLocationId, setSelectedLocationId] = React.useState(buskingLocations[0]?.id ?? '');
  const [selectedLength, setSelectedLength] = React.useState<SessionLength>(SESSION_LENGTHS[0]);

  const activeLocation = React.useMemo(() => {
    return buskingLocations.find((location) => location.id === selectedLocationId) ?? buskingLocations[0];
  }, [selectedLocationId]);

  const activeReward = activeLocation.rewards[selectedLength];

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Street Busking</CardTitle>
          <CardDescription>
            Pick a spot, choose how long to play, and see what kind of experience and cash you might pull in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Choose a location</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {buskingLocations.map((location) => {
                const isSelected = location.id === activeLocation.id;
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => setSelectedLocationId(location.id)}
                    className={cn(
                      'flex h-full flex-col justify-between rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-background hover:border-primary/40 hover:shadow-sm',
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-semibold leading-tight">{location.name}</h4>
                          <p className="text-sm text-muted-foreground">{location.description}</p>
                        </div>
                        <Badge variant="outline" className="whitespace-nowrap text-xs font-medium">
                          {location.vibe}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {location.neighborhood}
                      </p>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">{location.tip}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Set your session length</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {sessionOptions.map((option) => {
                const reward = activeLocation.rewards[option.value];
                const isSelected = option.value === selectedLength;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedLength(option.value)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-background hover:border-primary/40 hover:shadow-sm',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      <Badge variant={isSelected ? 'default' : 'outline'} className="text-xs">
                        {isSelected ? 'Selected' : 'Preview'}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">XP</dt>
                        <dd className="text-lg font-semibold text-primary">{reward.experience}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cash</dt>
                        <dd className="text-lg font-semibold text-emerald-600">${reward.cash}</dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="rounded-lg border bg-muted/40 p-6">
              <p className="text-sm text-muted-foreground">Ready to take the stage?</p>
              <p className="mt-2 text-lg font-semibold">
                {activeLocation.name} · {sessionOptions.find((option) => option.value === selectedLength)?.label}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-primary/40 bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected XP</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{activeReward.experience}</p>
                </div>
                <div className="rounded-md border border-emerald-400/40 bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Cash</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">${activeReward.cash}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                This placeholder simulates upcoming busking runs. Rewards will connect to your character once the full feature is
                live.
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
