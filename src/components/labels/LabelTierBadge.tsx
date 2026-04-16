import { Badge } from "@/components/ui/badge";
import { Crown, Building2, Rocket, Star, Disc } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_CONFIG = {
  indie: { label: "Indie", icon: Disc, color: "text-muted-foreground border-muted-foreground/30 bg-muted/30" },
  independent: { label: "Independent", icon: Star, color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  'mid-major': { label: "Mid-Major", icon: Building2, color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  major: { label: "Major", icon: Rocket, color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  'mega-label': { label: "Mega-Label", icon: Crown, color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
} as const;

interface LabelTierBadgeProps {
  tier: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function LabelTierBadge({ tier, size = 'sm', className }: LabelTierBadgeProps) {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.indie;
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <Badge variant="outline" className={cn(config.color, size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5', className)}>
      <Icon className={cn(iconSize, "mr-0.5")} />
      {config.label}
    </Badge>
  );
}

export function calculateLabelTier(reputation: number, activeArtists: number, totalRevenue: number): string {
  const score = reputation * 0.4 + Math.min(activeArtists * 5, 30) * 0.3 + Math.min(totalRevenue / 10000, 30) * 0.3;
  if (score >= 80) return 'mega-label';
  if (score >= 60) return 'major';
  if (score >= 40) return 'mid-major';
  if (score >= 20) return 'independent';
  return 'indie';
}

export function getTierMultipliers(tier: string) {
  const multipliers = {
    indie: { marketing: 1.0, distribution: 1.0, advancePool: 1.0, contractAppeal: 1.0 },
    independent: { marketing: 1.3, distribution: 1.2, advancePool: 1.3, contractAppeal: 1.2 },
    'mid-major': { marketing: 1.7, distribution: 1.5, advancePool: 1.7, contractAppeal: 1.5 },
    major: { marketing: 2.2, distribution: 2.0, advancePool: 2.5, contractAppeal: 2.0 },
    'mega-label': { marketing: 3.0, distribution: 2.5, advancePool: 3.0, contractAppeal: 2.5 },
  };
  return multipliers[tier as keyof typeof multipliers] || multipliers.indie;
}
