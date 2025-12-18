import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCityFlavor } from "@/data/cityFlavor";
import { getCountryData } from "@/data/countryData";
import { Utensils, Landmark, Lightbulb, Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationFlavorCardProps {
  cityName: string;
  country: string;
  className?: string;
  autoRotate?: boolean;
  rotateInterval?: number;
}

type FlavorTab = "cuisine" | "landmarks" | "facts" | "music";

const tabConfig: Record<FlavorTab, { icon: typeof Utensils; label: string; emoji: string }> = {
  cuisine: { icon: Utensils, label: "Local Cuisine", emoji: "🍽️" },
  landmarks: { icon: Landmark, label: "Landmarks", emoji: "🏛️" },
  facts: { icon: Lightbulb, label: "Fun Facts", emoji: "💡" },
  music: { icon: Music, label: "Music Scene", emoji: "🎵" }
};

export const LocationFlavorCard = ({
  cityName,
  country,
  className,
  autoRotate = true,
  rotateInterval = 5000
}: LocationFlavorCardProps) => {
  const [activeTab, setActiveTab] = useState<FlavorTab>("cuisine");
  const cityFlavor = getCityFlavor(cityName);
  const countryData = getCountryData(country);
  
  const tabs: FlavorTab[] = ["cuisine", "landmarks", "facts", "music"];
  
  // Auto-rotate tabs
  useEffect(() => {
    if (!autoRotate) return;
    
    const interval = setInterval(() => {
      setActiveTab(current => {
        const currentIndex = tabs.indexOf(current);
        return tabs[(currentIndex + 1) % tabs.length];
      });
    }, rotateInterval);
    
    return () => clearInterval(interval);
  }, [autoRotate, rotateInterval]);

  const getContent = () => {
    switch (activeTab) {
      case "cuisine":
        return cityFlavor.cuisine;
      case "landmarks":
        return cityFlavor.landmarks;
      case "facts":
        return cityFlavor.funFacts;
      case "music":
        return countryData?.musicFact 
          ? [countryData.musicFact, ...cityFlavor.musicVenues]
          : cityFlavor.musicVenues;
    }
  };

  const primaryColor = countryData?.primaryColor || "220 80% 45%";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {tabConfig[activeTab].emoji} Discover {cityName}
          </CardTitle>
          
          {/* Tab dots */}
          <div className="flex items-center gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  activeTab === tab 
                    ? "w-4" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                style={{
                  backgroundColor: activeTab === tab ? `hsl(${primaryColor})` : undefined
                }}
                aria-label={tabConfig[tab].label}
              />
            ))}
          </div>
        </div>
        
        {/* Tab labels */}
        <div className="flex items-center gap-1 mt-2">
          {tabs.map((tab) => {
            const Icon = tabConfig[tab].icon;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                  activeTab === tab 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{tabConfig[tab].label}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent>
        <ul className="space-y-2">
          {getContent().slice(0, 4).map((item, index) => (
            <li 
              key={index}
              className="flex items-start gap-2 text-sm"
            >
              <span 
                className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: `hsl(${primaryColor})` }}
              />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
