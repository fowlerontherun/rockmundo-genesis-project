import { supabase } from "@/integrations/supabase/client";

export interface FestivalDirectoryArtist {
  id: string;
  name: string;
  billingPosition: string | null;
  performanceDate: string | null;
}

export interface FestivalDirectoryCard {
  festivalCompanyId: string;
  festivalEditionId: string;
  festivalName: string;
  slug: string | null;
  tagline: string | null;
  description: string | null;
  status: string;
  startsOn: string;
  endsOn: string;
  cityId: string | null;
  cityName: string | null;
  expectedCapacity: number | null;
  confirmedArtists: FestivalDirectoryArtist[];
}

const isString = (value: unknown): value is string => typeof value === "string";

function parseArtist(value: unknown): FestivalDirectoryArtist | null {
  if (!value || typeof value !== "object") return null;
  const artist = value as Record<string, unknown>;
  if (!isString(artist.id) || !isString(artist.name)) return null;
  return {
    id: artist.id,
    name: artist.name,
    billingPosition: isString(artist.billingPosition) ? artist.billingPosition : null,
    performanceDate: isString(artist.performanceDate) ? artist.performanceDate : null,
  };
}

function parseCard(value: unknown): FestivalDirectoryCard | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Record<string, unknown>;
  if (
    !isString(card.festivalCompanyId) ||
    !isString(card.festivalEditionId) ||
    !isString(card.festivalName) ||
    !isString(card.status) ||
    !isString(card.startsOn) ||
    !isString(card.endsOn)
  ) {
    return null;
  }

  const artists = Array.isArray(card.confirmedArtists)
    ? card.confirmedArtists.map(parseArtist).filter((artist): artist is FestivalDirectoryArtist => Boolean(artist))
    : [];

  return {
    festivalCompanyId: card.festivalCompanyId,
    festivalEditionId: card.festivalEditionId,
    festivalName: card.festivalName,
    slug: isString(card.slug) ? card.slug : null,
    tagline: isString(card.tagline) ? card.tagline : null,
    description: isString(card.description) ? card.description : null,
    status: card.status,
    startsOn: card.startsOn,
    endsOn: card.endsOn,
    cityId: isString(card.cityId) ? card.cityId : null,
    cityName: isString(card.cityName) ? card.cityName : null,
    expectedCapacity: typeof card.expectedCapacity === "number" ? card.expectedCapacity : null,
    confirmedArtists: artists,
  };
}

export async function listFestivalDirectoryCards(): Promise<FestivalDirectoryCard[]> {
  const { data, error } = await (supabase as any).rpc("get_festival_directory_cards");
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map(parseCard).filter((card): card is FestivalDirectoryCard => Boolean(card));
}
