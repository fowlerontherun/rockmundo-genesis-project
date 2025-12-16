import { Music, Radio, Disc3, Headphones, Cloud, Play, Globe } from "lucide-react";

interface PlatformIconProps {
  platformName: string;
  className?: string;
}

const platformIcons: Record<string, React.ReactNode> = {
  spotify: <Disc3 className="h-4 w-4 text-green-500" />,
  "apple music": <Music className="h-4 w-4 text-pink-500" />,
  "youtube music": <Play className="h-4 w-4 text-red-500" />,
  tidal: <Headphones className="h-4 w-4 text-cyan-500" />,
  soundcloud: <Cloud className="h-4 w-4 text-orange-500" />,
  "amazon music": <Music className="h-4 w-4 text-blue-500" />,
  deezer: <Radio className="h-4 w-4 text-purple-500" />,
  pandora: <Radio className="h-4 w-4 text-blue-400" />,
};

export function PlatformIcon({ platformName, className }: PlatformIconProps) {
  const normalizedName = platformName.toLowerCase();
  
  // Find matching icon
  for (const [key, icon] of Object.entries(platformIcons)) {
    if (normalizedName.includes(key)) {
      return <span className={className}>{icon}</span>;
    }
  }
  
  // Default icon
  return <Globe className={`h-4 w-4 text-muted-foreground ${className}`} />;
}

export function getPlatformColor(platformName: string): string {
  const normalizedName = platformName.toLowerCase();
  
  if (normalizedName.includes("spotify")) return "text-green-500";
  if (normalizedName.includes("apple")) return "text-pink-500";
  if (normalizedName.includes("youtube")) return "text-red-500";
  if (normalizedName.includes("tidal")) return "text-cyan-500";
  if (normalizedName.includes("soundcloud")) return "text-orange-500";
  if (normalizedName.includes("amazon")) return "text-blue-500";
  if (normalizedName.includes("deezer")) return "text-purple-500";
  if (normalizedName.includes("pandora")) return "text-blue-400";
  
  return "text-muted-foreground";
}