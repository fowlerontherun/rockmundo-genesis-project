/** Validate untrusted deep-link params before using them in band-directory filters. */
export function parseCityBandFilter(requestedCityId: string | null): { cityId: string | null; invalidCity: boolean } {
  const cityId = requestedCityId && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestedCityId)
    ? requestedCityId : null;
  return { cityId, invalidCity: requestedCityId !== null && !cityId };
}
