import { Music2, Mic2, Guitar, Drum, Piano } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OnboardingData } from "../OnboardingWizard";

interface MusicIdentityStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const GENRE_SUGGESTIONS = [
  "Rock", "Punk", "Metal", "Indie", "Alternative",
  "Pop", "R&B", "Hip-Hop", "Electronic", "Folk",
  "Jazz", "Blues", "Country", "Classical", "Experimental"
];

const INSTRUMENT_ICONS: Record<string, React.ReactNode> = {
  vocals: <Mic2 className="h-4 w-4" />,
  guitar: <Guitar className="h-4 w-4" />,
  drums: <Drum className="h-4 w-4" />,
  keys: <Piano className="h-4 w-4" />,
};

export const MusicIdentityStep = ({ data, updateData }: MusicIdentityStepProps) => {
  const handleGenreClick = (genre: string) => {
    const current = data.musicalStyle.trim();
    if (current.toLowerCase().includes(genre.toLowerCase())) return;
    
    const newStyle = current ? `${current}, ${genre}` : genre;
    updateData({ musicalStyle: newStyle });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Music2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Define Your Sound
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What kind of music speaks to your soul?
        </p>
      </div>

      {/* Musical style input */}
      <div className="mx-auto max-w-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="musicalStyle" className="text-base">
            Your Musical Style
          </Label>
          <Input
            id="musicalStyle"
            placeholder="e.g., Punk Rock, Alternative, Indie"
            value={data.musicalStyle}
            onChange={(e) => updateData({ musicalStyle: e.target.value })}
            className="h-12"
          />
        </div>

        {/* Genre suggestions */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Quick picks:</Label>
          <div className="flex flex-wrap gap-2">
            {GENRE_SUGGESTIONS.map((genre) => {
              const isSelected = data.musicalStyle
                .toLowerCase()
                .includes(genre.toLowerCase());
              return (
                <Badge
                  key={genre}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary"
                      : "hover:bg-primary/10 hover:text-primary"
                  )}
                  onClick={() => handleGenreClick(genre)}
                >
                  {genre}
                </Badge>
              );
            })}
          </div>
        </div>
      </div>

      {/* Musical influences (optional) */}
      <div className="mx-auto max-w-lg space-y-2">
        <Label htmlFor="influences" className="text-base">
          Musical Influences (Optional)
        </Label>
        <Textarea
          id="influences"
          placeholder="Who inspires your music? Artists, bands, or movements that shaped your sound..."
          className="min-h-[100px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          This helps shape your character's artistic identity.
        </p>
      </div>
    </div>
  );
};
