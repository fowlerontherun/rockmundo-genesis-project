import {
  fetchCityEnvironmentDetails,
  fetchWorldEnvironmentSnapshot,
  type City as CityRecord,
  type CityEnvironmentDetails,
} from "@/utils/worldEnvironment";

export interface CityPageLoadResult {
  city: CityRecord;
  details: CityEnvironmentDetails | null;
  detailsError: string | null;
}

export const CITY_NOT_FOUND_ERROR = "CITY_NOT_FOUND";

export const loadCityPageData = async (cityId: string): Promise<CityPageLoadResult> => {
  const snapshot = await fetchWorldEnvironmentSnapshot();
  const matchedCity = snapshot.cities.find((entry) => entry.id === cityId);

  if (!matchedCity) {
    throw new Error(CITY_NOT_FOUND_ERROR);
  }

  let details: CityEnvironmentDetails | null = null;
  let detailsError: string | null = null;

  try {
    details = await fetchCityEnvironmentDetails(matchedCity.id, {
      cityName: matchedCity.name,
      country: matchedCity.country,
    });
  } catch (error) {
    console.error(`Failed to load city environment details for ${matchedCity.name}`, error);
    detailsError = "We couldn't load extended city details right now.";
  }

  return {
    city: matchedCity,
    details,
    detailsError,
  };
};
