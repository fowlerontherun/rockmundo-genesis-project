import {
  Calendar,
  Music,
  Disc3,
  DollarSign,
  BarChart3,
  Users,
  Package,
  Mail,
  Mic2,
  FileSignature,
  Trophy,
  Radio,
  Star,
  type LucideIcon,
} from "lucide-react";

/**
 * Canonical domain icons for scannable surfaces across RockMundo.
 * Always import from here so the same concept renders the same glyph
 * everywhere (lists, breadcrumbs, dashboards, cards).
 */
export const DOMAIN_ICONS = {
  gigs: Calendar,
  songs: Music,
  releases: Disc3,
  money: DollarSign,
  charts: BarChart3,
  fans: Users,
  inventory: Package,
  messages: Mail,
  studio: Mic2,
  contracts: FileSignature,
  awards: Trophy,
  radio: Radio,
  fame: Star,
} as const satisfies Record<string, LucideIcon>;

export type DomainKey = keyof typeof DOMAIN_ICONS;

interface DomainIconProps {
  name: DomainKey;
  className?: string;
  size?: number;
  strokeWidth?: number;
  "aria-label"?: string;
}

/**
 * Render a canonical domain icon. Consistent stroke + sizing across the app.
 */
export const DomainIcon = ({
  name,
  className,
  size,
  strokeWidth = 2,
  ...rest
}: DomainIconProps) => {
  const Icon = DOMAIN_ICONS[name];
  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={rest["aria-label"] ? undefined : true}
      {...rest}
    />
  );
};

export default DomainIcon;
