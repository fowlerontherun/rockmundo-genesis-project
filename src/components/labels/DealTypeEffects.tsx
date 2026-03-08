import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Building2, Music, ShoppingBag, Truck, Radio, 
  Crown, Scale, Disc3, FileText, Info 
} from "lucide-react";

/**
 * Deal type definitions with their gameplay effects.
 * These map to label_deal_types.name values in the database.
 */
export interface DealTypeEffect {
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  revenueStreams: string[];
  labelCovers: string[];
  artistBenefits: string[];
  typicalAdvance: string;
  typicalRoyalty: string;
}

export const DEAL_TYPE_EFFECTS: Record<string, DealTypeEffect> = {
  "360 Deal": {
    name: "360 Deal",
    icon: <Crown className="h-4 w-4" />,
    description: "Label takes a cut of ALL revenue streams — recordings, merch, touring, streaming. Highest advance, lowest artist freedom.",
    color: "text-amber-500",
    revenueStreams: ["Recordings", "Streaming", "Merch Sales", "Touring", "Licensing"],
    labelCovers: ["Manufacturing", "Marketing", "Distribution", "Tour Support", "Music Videos"],
    artistBenefits: ["Highest advance", "Full marketing push", "Tour funding", "Video budget"],
    typicalAdvance: "$50,000 – $500,000",
    typicalRoyalty: "15-20% artist / 80-85% label",
  },
  "Standard Deal": {
    name: "Standard Deal",
    icon: <Disc3 className="h-4 w-4" />,
    description: "Traditional record deal — label owns masters, splits recording revenue. Artist keeps merch and touring income.",
    color: "text-primary",
    revenueStreams: ["Recordings", "Streaming", "Digital Sales", "Physical Sales"],
    labelCovers: ["Manufacturing", "Marketing", "Distribution"],
    artistBenefits: ["Moderate advance", "Keep merch/touring revenue", "Marketing support"],
    typicalAdvance: "$10,000 – $100,000",
    typicalRoyalty: "20-30% artist / 70-80% label",
  },
  "Distribution Deal": {
    name: "Distribution Deal",
    icon: <Truck className="h-4 w-4" />,
    description: "Label only handles distribution. Artist retains ownership of masters. Small label cut on sales only.",
    color: "text-emerald-500",
    revenueStreams: ["Physical Sales", "Digital Distribution"],
    labelCovers: ["Distribution logistics", "Retail placement"],
    artistBenefits: ["Own your masters", "Maximum artist share", "Creative freedom"],
    typicalAdvance: "$0 – $10,000",
    typicalRoyalty: "70-85% artist / 15-30% label",
  },
  "Production Deal": {
    name: "Production Deal",
    icon: <Music className="h-4 w-4" />,
    description: "Label covers all recording costs. Moderate revenue share. Good for artists needing studio access.",
    color: "text-blue-500",
    revenueStreams: ["Recordings", "Streaming"],
    labelCovers: ["Recording costs", "Studio time", "Mixing & mastering", "Manufacturing"],
    artistBenefits: ["Free recording", "Studio access", "Production expertise"],
    typicalAdvance: "$5,000 – $50,000",
    typicalRoyalty: "30-40% artist / 60-70% label",
  },
  "Licensing Deal": {
    name: "Licensing Deal",
    icon: <FileText className="h-4 w-4" />,
    description: "Time-limited license to distribute. Masters revert to artist after contract ends. Most artist-friendly.",
    color: "text-purple-500",
    revenueStreams: ["Recordings (time-limited)", "Streaming (time-limited)"],
    labelCovers: ["Marketing", "Distribution (during term)"],
    artistBenefits: ["Masters revert after contract", "Time-limited commitment", "Re-license to other labels"],
    typicalAdvance: "$5,000 – $30,000",
    typicalRoyalty: "40-50% artist / 50-60% label",
  },
};

export function getDealTypeEffect(dealTypeName: string): DealTypeEffect | null {
  return DEAL_TYPE_EFFECTS[dealTypeName] || null;
}

interface DealTypeInfoCardProps {
  dealTypeName: string;
  compact?: boolean;
}

export function DealTypeInfoCard({ dealTypeName, compact = false }: DealTypeInfoCardProps) {
  const effect = getDealTypeEffect(dealTypeName);
  if (!effect) return null;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${effect.color} cursor-help`}>
              {effect.icon}
              <span className="ml-1">{effect.name}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{effect.description}</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Typical: {effect.typicalRoyalty}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className={effect.color}>{effect.icon}</span>
          {effect.name}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{effect.description}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div>
          <p className="font-medium mb-1">Revenue Streams Affected:</p>
          <div className="flex flex-wrap gap-1">
            {effect.revenueStreams.map(s => (
              <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="font-medium mb-1">Label Covers:</p>
          <div className="flex flex-wrap gap-1">
            {effect.labelCovers.map(s => (
              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="font-medium mb-1">Artist Benefits:</p>
          <ul className="list-disc list-inside text-muted-foreground">
            {effect.artistBenefits.map(b => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 border-t">
          <div>
            <p className="text-muted-foreground">Typical Advance</p>
            <p className="font-medium">{effect.typicalAdvance}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Typical Split</p>
            <p className="font-medium">{effect.typicalRoyalty}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
