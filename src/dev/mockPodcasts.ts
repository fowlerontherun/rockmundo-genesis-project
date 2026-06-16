/**
 * Dev-only mock data for podcast browsing and submission flows.
 * Used as a fallback when Supabase is unreachable (e.g. project paused, 402)
 * so deep links and the MediaSubmissionDialog can be exercised without auth/data.
 *
 * Guarded by `import.meta.env.DEV` at every call site — never ships to prod.
 */

export const DEV_GUEST_BAND = {
  id: "00000000-0000-0000-0000-000000000b01",
  name: "Dev Guest Band",
  fame: 500,
  genre: "indie",
  total_fans: 12500,
};

export interface MockPodcast {
  id: string;
  podcast_name: string;
  host_name: string | null;
  podcast_type: string | null;
  listener_base: number;
  episodes_per_week: number | null;
  min_fame_required: number | null;
  genres: string[] | null;
  description: string | null;
  country: string | null;
  fame_boost_min: number | null;
  fame_boost_max: number | null;
  fan_boost_min: number | null;
  fan_boost_max: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
}

export const DEV_MOCK_PODCASTS: MockPodcast[] = [
  {
    id: "dev-pod-001",
    podcast_name: "Backstage Frequencies",
    host_name: "Marlowe Quinn",
    podcast_type: "interview",
    listener_base: 1_250_000,
    episodes_per_week: 2,
    min_fame_required: 50,
    genres: ["indie", "rock", "alternative"],
    description:
      "Long-form interviews with rising artists about the craft, the road, and the chaos. Recorded live in Brooklyn.",
    country: "USA",
    fame_boost_min: 15,
    fame_boost_max: 35,
    fan_boost_min: 800,
    fan_boost_max: 2400,
    compensation_min: 250,
    compensation_max: 900,
  },
  {
    id: "dev-pod-002",
    podcast_name: "Low End Theory",
    host_name: "Dee Okafor",
    podcast_type: "music_review",
    listener_base: 480_000,
    episodes_per_week: 1,
    min_fame_required: 200,
    genres: ["hip-hop", "electronic"],
    description:
      "A weekly deep-dive on production, sampling, and the artists shaping the underground sound.",
    country: "UK",
    fame_boost_min: 10,
    fame_boost_max: 25,
    fan_boost_min: 400,
    fan_boost_max: 1200,
    compensation_min: 150,
    compensation_max: 600,
  },
  {
    id: "dev-pod-003",
    podcast_name: "Tour Diaries",
    host_name: "Sasha Vermeer",
    podcast_type: "narrative",
    listener_base: 95_000,
    episodes_per_week: 1,
    min_fame_required: 0,
    genres: ["folk", "indie", "country"],
    description:
      "Stories from the van. New and emerging acts welcome — no fame minimum, just a good road story.",
    country: "Canada",
    fame_boost_min: 5,
    fame_boost_max: 12,
    fan_boost_min: 120,
    fan_boost_max: 480,
    compensation_min: 0,
    compensation_max: 150,
  },
  {
    id: "dev-pod-004",
    podcast_name: "Distortion Daily",
    host_name: "Rikard Salo",
    podcast_type: "news",
    listener_base: 3_400_000,
    episodes_per_week: 5,
    min_fame_required: 1500,
    genres: ["metal", "rock"],
    description:
      "Daily news, hot takes, and guest spots from the biggest names in heavy music.",
    country: "Sweden",
    fame_boost_min: 30,
    fame_boost_max: 80,
    fan_boost_min: 2500,
    fan_boost_max: 8000,
    compensation_min: 1200,
    compensation_max: 4500,
  },
];

export function getMockPodcastById(id: string | undefined): MockPodcast | null {
  if (!id) return null;
  return DEV_MOCK_PODCASTS.find((p) => p.id === id) ?? null;
}

/** Wrap a Supabase queryFn so it falls back to mock data in dev on error or empty result. */
export async function withDevPodcastFallback<T>(
  run: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  if (!import.meta.env.DEV) return run();
  try {
    const result = await run();
    if (result == null || (Array.isArray(result) && result.length === 0)) {
      return fallback();
    }
    return result;
  } catch (err) {
    console.warn("[dev-mock] podcast query failed, using mock data", err);
    return fallback();
  }
}
