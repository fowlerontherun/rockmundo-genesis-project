import { useMemo, useEffect } from "react";
import { getCountryColors, getCountryData } from "@/data/countryData";
import { useGameData } from "./useGameData";

export interface LocationTheme {
  primaryColor: string;
  secondaryColor: string;
  gradient: string;
  cssVars: Record<string, string>;
  countryName: string;
  cityName: string;
}

export const useLocationTheme = (): LocationTheme | null => {
  const { currentCity } = useGameData();
  
  const theme = useMemo(() => {
    if (!currentCity) return null;
    
    const country = currentCity.country;
    const colors = getCountryColors(country);
    const countryData = getCountryData(country);
    
    return {
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      gradient: `linear-gradient(135deg, hsl(${colors.primary}), hsl(${colors.secondary}))`,
      cssVars: {
        "--location-primary": colors.primary,
        "--location-secondary": colors.secondary,
        "--location-gradient": `linear-gradient(135deg, hsl(${colors.primary}), hsl(${colors.secondary}))`,
        "--location-primary-light": `${colors.primary.split(' ').slice(0, 2).join(' ')} 70%`,
        "--location-glow": `0 0 20px hsl(${colors.primary} / 0.3)`
      },
      countryName: country,
      cityName: currentCity.name
    };
  }, [currentCity]);

  // Apply CSS variables to document root when theme changes
  useEffect(() => {
    if (!theme) return;
    
    const root = document.documentElement;
    Object.entries(theme.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Cleanup on unmount
    return () => {
      Object.keys(theme.cssVars).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [theme]);

  return theme;
};

// Hook to get just the colors without applying them
export const useLocationColors = (country: string | undefined) => {
  return useMemo(() => {
    if (!country) return { primary: "220 80% 45%", secondary: "0 80% 50%" };
    return getCountryColors(country);
  }, [country]);
};
