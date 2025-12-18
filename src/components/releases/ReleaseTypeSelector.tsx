import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Disc, Music, Album, Trophy } from "lucide-react";

export type ReleaseType = "single" | "ep" | "album" | "greatest_hits";

interface ReleaseTypeSelectorProps {
  value: ReleaseType;
  onChange: (value: ReleaseType) => void;
  greatestHitsEligible?: boolean;
  greatestHitsReason?: string | null;
}

export function ReleaseTypeSelector({ 
  value, 
  onChange, 
  greatestHitsEligible = false,
  greatestHitsReason 
}: ReleaseTypeSelectorProps) {
  const types = [
    {
      value: "single" as const,
      label: "Single",
      description: "1 song + B-side",
      icon: Music,
      songs: "2 tracks"
    },
    {
      value: "ep" as const,
      label: "EP",
      description: "Extended Play",
      icon: Disc,
      songs: "4 tracks"
    },
    {
      value: "album" as const,
      label: "Album",
      description: "Full-length release",
      icon: Album,
      songs: "10-20 tracks"
    },
    {
      value: "greatest_hits" as const,
      label: "Greatest Hits",
      description: "Best of compilation",
      icon: Trophy,
      songs: "10-25 tracks",
      special: true
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {types.map((type) => {
        const Icon = type.icon;
        const isGreatestHits = type.value === "greatest_hits";
        const isDisabled = isGreatestHits && !greatestHitsEligible;
        
        return (
          <Card
            key={type.value}
            className={`p-4 cursor-pointer transition-all ${
              value === type.value
                ? "border-primary bg-primary/5"
                : isDisabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:border-primary/50"
            } ${type.special ? "border-amber-500/30" : ""}`}
            onClick={() => !isDisabled && onChange(type.value)}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <Icon className={`h-8 w-8 ${type.special ? "text-amber-500" : ""}`} />
              <div>
                <div className="flex items-center justify-center gap-2">
                  <h3 className="font-semibold">{type.label}</h3>
                  {type.special && (
                    <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                      Special
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{type.description}</p>
                <p className="text-xs font-medium mt-1">{type.songs}</p>
                {isGreatestHits && isDisabled && greatestHitsReason && (
                  <p className="text-xs text-destructive mt-1">{greatestHitsReason}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
