/** Only pre-confirmed, public mural checkpoints cross this API boundary. */
export type WorldSceneCity = {
  city_id: string;
  cadence: 'weekly' | 'monthly';
  ends_at: string;
  confirmed_stage: 0 | 25 | 50 | 75 | 100;
};
export type WorldSceneStatus = { cities: WorldSceneCity[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAGES = [0, 25, 50, 75, 100];
const PUBLIC_CITY_KEYS = ['city_id', 'cadence', 'ends_at', 'confirmed_stage'];

export function isWorldSceneStatus(input: unknown): input is WorldSceneStatus {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const data = input as Partial<WorldSceneStatus>;
  if (Object.keys(data).length !== 1 || !Array.isArray(data.cities) || data.cities.length > 200) return false;

  const seen = new Set<string>();
  return data.cities.every((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    if (Object.keys(row).length !== PUBLIC_CITY_KEYS.length ||
      !PUBLIC_CITY_KEYS.every(key => Object.prototype.hasOwnProperty.call(row, key))) return false;
    if (typeof row.city_id !== 'string' || !UUID.test(row.city_id) ||
      seen.has(row.city_id)) return false;
    seen.add(row.city_id);
    return (row.cadence === 'weekly' || row.cadence === 'monthly') &&
      typeof row.ends_at === 'string' && Number.isFinite(Date.parse(row.ends_at)) &&
      Number.isInteger(row.confirmed_stage) && STAGES.includes(row.confirmed_stage);
  });
}

/** Expired campaigns are hidden even if a cached response outlives its cycle. */
export function activeWorldScenes(
  data: WorldSceneStatus | undefined, nowMs: number,
): Record<string, WorldSceneCity> {
  if (!data || !Number.isFinite(nowMs)) return {};
  return Object.fromEntries(data.cities
    .filter(city => Date.parse(city.ends_at) > nowMs)
    .map(city => [city.city_id, city]));
}
