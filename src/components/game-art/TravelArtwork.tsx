import { ArrowRight, Bus, Compass, MapPin, Plane, Ship, Train } from 'lucide-react';
import { format } from 'date-fns';
import { ArtworkImage, artworkPalette } from './GameArtwork';
import { recentDestinationStamps, type StampJourney } from './travelStampModel';

const transportIcons = { plane: Plane, train: Train, bus: Bus, tour_bus: Bus, ship: Ship };

/** Schematic route only: no implied location, distance or arrival status. */
export function TravelRouteArtwork({ from, to, transport }: { from?: string | null; to: string; transport: string }) {
  const Icon = transportIcons[transport.toLowerCase() as keyof typeof transportIcons] || Compass;
  return <div className="relative overflow-hidden rounded-lg border bg-slate-950 text-white">
    <ArtworkImage src="/hub-tiles/travel.png" className="absolute inset-0 h-full w-full object-cover opacity-20" />
    <div className="relative bg-gradient-to-r from-slate-950/80 to-slate-950/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-300"><Icon className="h-4 w-4" aria-hidden="true" />{transport.replaceAll('_', ' ') || 'Travel'}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0"><span className="text-[10px] uppercase text-slate-400">From</span><p className="break-words text-sm font-semibold">{from || 'Origin unavailable'}</p></div>
        <ArrowRight className="h-5 w-5 text-amber-200" aria-hidden="true" />
        <div className="min-w-0 text-right"><span className="text-[10px] uppercase text-slate-400">To</span><p className="break-words text-sm font-semibold">{to}</p></div>
      </div>
      <div aria-hidden="true" className="mt-3 flex items-center gap-2 text-amber-200"><span className="h-2 w-2 rounded-full border border-current" /><span className="flex-1 border-t border-dashed border-white/30" /><MapPin className="h-3 w-3" /></div>
    </div>
  </div>;
}

export function TravelPassport({ journeys }: { journeys: StampJourney[] }) {
  const stamps = recentDestinationStamps(journeys);
  if (!stamps.length) return null;
  return <section aria-label="Travel passport" className="rounded-xl border bg-muted/20 p-4 sm:p-5">
    <div className="mb-4"><h3 className="font-semibold">Travel passport</h3><p className="text-xs text-muted-foreground">Your latest completed visit to each of these destinations. Full history below.</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stamps.map(journey => <div key={journey.to_city_id} style={artworkPalette(journey.to_city_id!)} className="min-w-0 rounded-lg border bg-background p-2">
        <div className="flex h-full min-h-36 flex-col items-center justify-center gap-1 rounded-[1.5rem] border-2 border-dashed p-3 text-center" style={{ borderColor: 'var(--art-accent)', background: 'var(--art-bg)', color: 'var(--art-highlight)' }}>
          <MapPin className="mb-1 h-5 w-5" aria-hidden="true" />
          <span className="text-[9px] uppercase tracking-widest">Visited</span>
          <strong className="break-words text-sm text-white">{journey.to_city.name}</strong>
          <span className="break-words text-[10px]">{journey.to_city.country}</span>
          <time dateTime={journey.arrival_time} className="mt-1 text-[10px] text-white/80">{format(new Date(journey.arrival_time), 'dd MMM yyyy')}</time>
        </div>
      </div>)}
    </div>
  </section>;
}
