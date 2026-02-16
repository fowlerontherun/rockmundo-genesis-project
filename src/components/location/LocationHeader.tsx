import { CountryFlag } from "./CountryFlag";
import { getCountryData } from "@/data/countryData";
import { getCityFlavor } from "@/data/cityFlavor";
import { Badge } from "@/components/ui/badge";
import { MapPin, Music, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameCalendar } from "@/hooks/useGameCalendar";

interface LocationHeaderProps {
  cityName: string;
  country: string;
  musicScene?: number | null;
  timezone?: string | null;
  className?: string;
}

export const LocationHeader = ({
  cityName,
  country,
  musicScene,
  timezone,
  className
}: LocationHeaderProps) => {
  const countryData = getCountryData(country);
  const cityFlavorData = getCityFlavor(cityName);
  const { data: calendar } = useGameCalendar();
  
  // Get current time in city's timezone
  const getLocalTime = () => {
    if (!timezone) return null;
    try {
      return new Date().toLocaleTimeString('en-US', { 
        timeZone: timezone, 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return null;
    }
  };

  const localTime = getLocalTime();
  const primaryColor = countryData?.primaryColor || "220 80% 45%";
  const secondaryColor = countryData?.secondaryColor || "0 80% 50%";

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl border border-border",
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${primaryColor} / 0.15) 0%, hsl(var(--card)) 50%, hsl(${secondaryColor} / 0.1) 100%)`
      }}
    >
      {/* Accent bar using country colors */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: `linear-gradient(90deg, hsl(${primaryColor}), hsl(${secondaryColor}))`
        }}
      />
      
      <div className="p-4 md:p-6">
        <div className="flex items-start gap-4">
          {/* Large flag */}
          <div className="flex-shrink-0">
            <CountryFlag country={country} size="xl" showTooltip={false} />
          </div>
          
          {/* City info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl md:text-3xl font-bold truncate">
                {cityName}
              </h2>
              {musicScene !== null && musicScene !== undefined && (
                <Badge 
                  variant="secondary" 
                  className="flex items-center gap-1"
                  style={{
                    borderColor: `hsl(${primaryColor} / 0.5)`,
                    background: `hsl(${primaryColor} / 0.15)`
                  }}
                >
                  <Music className="h-3 w-3" />
                  {musicScene}% Music Scene
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{country}</span>
              {countryData?.musicFact && (
                <span className="hidden md:inline text-xs opacity-75">
                  • {countryData.musicFact.slice(0, 50)}...
                </span>
              )}
            </div>

            {/* Quick info row */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {localTime && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Local time: <span className="font-medium">{localTime}</span></span>
                </div>
              )}

              {calendar && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{calendar.seasonEmoji} {calendar.monthName}, Yr {calendar.gameYear}</span>
                </div>
              )}
              
              {cityFlavorData.landmarks.length > 0 && (
                <div className="text-sm text-muted-foreground hidden sm:block">
                  <span className="opacity-75">Near:</span>{" "}
                  <span className="font-medium">{cityFlavorData.landmarks[0]}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
