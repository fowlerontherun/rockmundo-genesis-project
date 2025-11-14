import { cn } from "@/lib/utils";
import {
  Award,
  BadgeCheck,
  Crown,
  Flame,
  Guitar,
  Medal,
  Mic2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

const ICON_REGISTRY = {
  trophy: Trophy,
  crown: Crown,
  star: Star,
  flame: Flame,
  sparkles: Sparkles,
  rocket: Rocket,
  shield: ShieldCheck,
  medal: Medal,
  guitar: Guitar,
  mic: Mic2,
  target: Target,
  zap: Zap,
  badge: BadgeCheck,
} as const;

export interface BadgeIconProps {
  icon?: string | null;
  className?: string;
}

export const BadgeIcon = ({ icon, className }: BadgeIconProps) => {
  const IconComponent = (icon && ICON_REGISTRY[icon as keyof typeof ICON_REGISTRY]) || Award;

  return <IconComponent className={cn("h-8 w-8 text-primary", className)} strokeWidth={1.75} />;
};
