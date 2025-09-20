import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface CityOption {
  id: string;
  name: string;
  country: string;
  label: string;
}

const formatCityLabel = (name: string, country: string | null | undefined): string => {
  const cityName = name?.trim().length ? name : "Unknown city";
  if (country && country.trim().length > 0) {
    return `${cityName}, ${country}`;
  }
  return cityName;
};

export const useCityOptions = () => {
  const [options, setOptions] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("name", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const typedData = (data ?? []) as Array<Database["public"]["Tables"]["cities"]["Row"]>;
      const normalized = typedData.map((city) => ({
        id: city.id,
        name: city.name,
        country: city.country,
        label: formatCityLabel(city.name, city.country),
      }));

      setOptions(normalized);
    } catch (caughtError) {
      console.error("Failed to load city options", caughtError);
      const message =
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Unable to load cities. Please try again later.";
      setError(message);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  return { options, loading, error, refresh: fetchOptions } as const;
};

export type UseCityOptionsReturn = ReturnType<typeof useCityOptions>;
