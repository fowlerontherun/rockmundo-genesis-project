export const DEFAULT_CITY_CHANNEL = "city:lobby" as const;

export const deriveCityChannel = (cityId?: string | null) => {
  if (typeof cityId !== "string") {
    return DEFAULT_CITY_CHANNEL;
  }

  const trimmed = cityId.trim();
  return trimmed.length > 0 ? `city:${trimmed}` : DEFAULT_CITY_CHANNEL;
};
