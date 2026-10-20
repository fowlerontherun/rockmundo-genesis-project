export interface StampJourney {
  id: string;
  to_city_id: string | null;
  to_city: { name: string; country: string };
  arrival_time: string;
  status: string;
}

/** One stamp per known destination, ordered by latest completed arrival. */
export function recentDestinationStamps(journeys: StampJourney[], limit = 6) {
  const seen = new Set<string>();
  return journeys
    .filter(journey => journey.status === 'completed' && journey.to_city_id && Number.isFinite(Date.parse(journey.arrival_time)))
    .slice()
    .sort((a, b) => Date.parse(b.arrival_time) - Date.parse(a.arrival_time) || a.id.localeCompare(b.id))
    .filter(journey => {
      if (seen.has(journey.to_city_id!)) return false;
      seen.add(journey.to_city_id!);
      return true;
    })
    .slice(0, Math.max(0, limit));
}
