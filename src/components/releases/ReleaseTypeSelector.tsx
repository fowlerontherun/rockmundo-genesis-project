import { Card } from "@/components/ui/card";
import { Disc, Music, Album } from "lucide-react";

interface ReleaseTypeSelectorProps {
  value: "single" | "ep" | "album";
  onChange: (value: "single" | "ep" | "album") => void;
}

export function ReleaseTypeSelector({ value, onChange }: ReleaseTypeSelectorProps) {
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
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {types.map((type) => {
        const Icon = type.icon;
        return (
          <Card
            key={type.value}
            className={`p-4 cursor-pointer transition-all ${
              value === type.value
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => onChange(type.value)}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <Icon className="h-8 w-8" />
              <div>
                <h3 className="font-semibold">{type.label}</h3>
                <p className="text-xs text-muted-foreground">{type.description}</p>
                <p className="text-xs font-medium mt-1">{type.songs}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
