import { Badge } from "@/components/ui/badge";
import { Building2, Sparkles } from "lucide-react";

// Venue traits assigned based on rehearsal room properties
const VENUE_TRAITS: Record<string, { label: string; description: string; icon: string; bonusKey: string; bonusValue: number }> = {
  acoustic_haven: { label: "Acoustic Haven", description: "+15% mood for acoustic sessions", icon: "🎵", bonusKey: "mood_bonus", bonusValue: 15 },
  electric_arena: { label: "Electric Arena", description: "+10% synergy for rock/metal genres", icon: "⚡", bonusKey: "synergy_bonus", bonusValue: 10 },
  intimate_lounge: { label: "Intimate Lounge", description: "+20% chemistry gain (≤4 participants)", icon: "🛋️", bonusKey: "chemistry_bonus", bonusValue: 20 },
  grand_stage: { label: "Grand Stage", description: "+25% XP for full capacity sessions", icon: "🎭", bonusKey: "xp_bonus", bonusValue: 25 },
  vintage_studio: { label: "Vintage Studio", description: "+10% chance of gifted song", icon: "🎙️", bonusKey: "song_chance_bonus", bonusValue: 10 },
  rooftop_vibe: { label: "Rooftop Vibe", description: "+15% mood score baseline", icon: "🌆", bonusKey: "mood_baseline", bonusValue: 15 },
  underground_den: { label: "Underground Den", description: "+20% XP for sessions at 160+ BPM", icon: "🔥", bonusKey: "tempo_xp_bonus", bonusValue: 20 },
  zen_garden: { label: "Zen Garden", description: "+10% to all scores for sessions under 100 BPM", icon: "🧘", bonusKey: "slow_bonus", bonusValue: 10 },
};

interface JamSessionVenueTraitsProps {
  venueTrait: string | null;
}

export const JamSessionVenueTraits = ({ venueTrait }: JamSessionVenueTraitsProps) => {
  if (!venueTrait || !VENUE_TRAITS[venueTrait]) return null;

  const trait = VENUE_TRAITS[venueTrait];

  return (
    <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
      <Building2 className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{trait.icon}</span>
          <span className="text-sm font-medium">{trait.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">{trait.description}</p>
      </div>
      <Badge variant="secondary" className="shrink-0 text-xs">
        <Sparkles className="h-3 w-3 mr-1" />
        Active
      </Badge>
    </div>
  );
};

export const getRandomVenueTrait = (): string => {
  const keys = Object.keys(VENUE_TRAITS);
  return keys[Math.floor(Math.random() * keys.length)];
};

export { VENUE_TRAITS };
