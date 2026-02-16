import { cn } from "@/lib/utils";
import { Tv } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NetworkBrand {
  abbr: string;
  bg: string;
  text: string;
  border?: string;
}

// Brand-styled badges for real-world TV networks
const NETWORK_BRANDS: Record<string, NetworkBrand> = {
  // UK
  "BBC One":        { abbr: "BBC1",   bg: "bg-[hsl(0,0%,10%)]",         text: "text-white" },
  "BBC Two":        { abbr: "BBC2",   bg: "bg-[hsl(120,50%,35%)]",      text: "text-white" },
  "BBC Three":      { abbr: "BBC3",   bg: "bg-[hsl(300,70%,45%)]",      text: "text-white" },
  "BBC Four":       { abbr: "BBC4",   bg: "bg-[hsl(210,30%,25%)]",      text: "text-white" },
  "ITV":            { abbr: "ITV",    bg: "bg-[hsl(200,70%,50%)]",      text: "text-white" },
  "ITV2":           { abbr: "ITV2",   bg: "bg-[hsl(330,80%,55%)]",      text: "text-white" },
  "ITV3":           { abbr: "ITV3",   bg: "bg-[hsl(270,50%,45%)]",      text: "text-white" },
  "ITV4":           { abbr: "ITV4",   bg: "bg-[hsl(30,90%,50%)]",       text: "text-white" },
  "ITVBe":          { abbr: "Be",     bg: "bg-[hsl(320,60%,60%)]",      text: "text-white" },
  "Channel 4":      { abbr: "C4",     bg: "bg-[hsl(0,0%,15%)]",         text: "text-white" },
  "Channel 5":      { abbr: "C5",     bg: "bg-[hsl(210,80%,45%)]",      text: "text-white" },
  "Channel 5 UK":   { abbr: "C5",     bg: "bg-[hsl(210,80%,45%)]",      text: "text-white" },
  "E4":             { abbr: "E4",     bg: "bg-[hsl(280,70%,55%)]",      text: "text-white" },
  "Film4":          { abbr: "F4",     bg: "bg-[hsl(0,70%,45%)]",        text: "text-white" },
  "More4":          { abbr: "M4",     bg: "bg-[hsl(190,60%,40%)]",      text: "text-white" },
  "5Star":          { abbr: "5★",     bg: "bg-[hsl(45,90%,50%)]",       text: "text-black" },
  "Dave":           { abbr: "DAVE",   bg: "bg-[hsl(210,20%,30%)]",      text: "text-white" },
  "Gold":           { abbr: "GOLD",   bg: "bg-[hsl(45,80%,50%)]",       text: "text-black" },
  "Drama":          { abbr: "DRA",    bg: "bg-[hsl(0,50%,40%)]",        text: "text-white" },
  "Quest":          { abbr: "Q",      bg: "bg-[hsl(30,70%,45%)]",       text: "text-white" },
  "MTV UK":         { abbr: "MTV",    bg: "bg-[hsl(50,90%,55%)]",       text: "text-black" },
  "London Live":    { abbr: "LL",     bg: "bg-[hsl(0,70%,50%)]",        text: "text-white" },
  "Made in Manchester": { abbr: "MiM", bg: "bg-[hsl(210,50%,40%)]",     text: "text-white" },
  "Netflix UK":     { abbr: "N",      bg: "bg-[hsl(0,70%,45%)]",        text: "text-white" },

  // US
  "NBC":            { abbr: "NBC",    bg: "bg-[hsl(220,60%,50%)]",      text: "text-white" },
  "ABC":            { abbr: "ABC",    bg: "bg-[hsl(0,0%,15%)]",         text: "text-white" },
  "CBS":            { abbr: "CBS",    bg: "bg-[hsl(215,60%,40%)]",      text: "text-white" },
  "Fox":            { abbr: "FOX",    bg: "bg-[hsl(210,80%,50%)]",      text: "text-white" },
  "HBO":            { abbr: "HBO",    bg: "bg-[hsl(0,0%,10%)]",         text: "text-white" },
  "PBS":            { abbr: "PBS",    bg: "bg-[hsl(210,50%,45%)]",      text: "text-white" },
  "BET":            { abbr: "BET",    bg: "bg-[hsl(0,0%,8%)]",          text: "text-white" },
  "Comedy Central": { abbr: "CC",     bg: "bg-[hsl(45,90%,55%)]",       text: "text-black" },
  "Fuse":           { abbr: "FUSE",   bg: "bg-[hsl(300,70%,50%)]",      text: "text-white" },
  "Hulu":           { abbr: "hulu",   bg: "bg-[hsl(150,70%,40%)]",      text: "text-white" },

  // France
  "France 2":       { abbr: "F2",     bg: "bg-[hsl(0,60%,50%)]",        text: "text-white" },
  "Canal+":         { abbr: "C+",     bg: "bg-[hsl(0,0%,10%)]",         text: "text-white" },

  // Germany
  "ARD":            { abbr: "ARD",    bg: "bg-[hsl(210,70%,45%)]",      text: "text-white" },
  "ProSieben":      { abbr: "P7",     bg: "bg-[hsl(0,75%,50%)]",        text: "text-white" },

  // Italy
  "Rai Uno":        { abbr: "RAI",    bg: "bg-[hsl(210,70%,40%)]",      text: "text-white" },
  "Canale 5":       { abbr: "C5",     bg: "bg-[hsl(210,60%,50%)]",      text: "text-white" },
  "Mediaset Italia": { abbr: "MSI",   bg: "bg-[hsl(200,50%,45%)]",      text: "text-white" },

  // Spain
  "Antena 3":       { abbr: "A3",     bg: "bg-[hsl(200,70%,50%)]",      text: "text-white" },

  // Japan
  "NHK":            { abbr: "NHK",    bg: "bg-[hsl(0,60%,45%)]",        text: "text-white" },
  "Fuji TV":        { abbr: "FUJI",   bg: "bg-[hsl(210,60%,50%)]",      text: "text-white" },

  // South Korea
  "KBS":            { abbr: "KBS",    bg: "bg-[hsl(210,70%,45%)]",      text: "text-white" },
  "MBC":            { abbr: "MBC",    bg: "bg-[hsl(120,50%,40%)]",      text: "text-white" },

  // Australia
  "ABC Australia":  { abbr: "ABC",    bg: "bg-[hsl(0,0%,15%)]",         text: "text-white" },
  "Channel 7":      { abbr: "7",      bg: "bg-[hsl(0,70%,50%)]",        text: "text-white" },
  "Network Ten":    { abbr: "10",     bg: "bg-[hsl(210,70%,50%)]",      text: "text-white" },

  // Canada
  "CBC":            { abbr: "CBC",    bg: "bg-[hsl(0,70%,50%)]",        text: "text-white" },
  "CTV":            { abbr: "CTV",    bg: "bg-[hsl(210,60%,45%)]",      text: "text-white" },

  // Global / Streaming
  "Amazon Prime Video": { abbr: "PRIME", bg: "bg-[hsl(200,80%,35%)]",   text: "text-white" },
  "Apple TV+":      { abbr: "TV+",    bg: "bg-[hsl(0,0%,12%)]",         text: "text-white" },
  "Disney+":        { abbr: "D+",     bg: "bg-[hsl(220,70%,45%)]",      text: "text-white" },
  "Paramount+":     { abbr: "P+",     bg: "bg-[hsl(220,70%,50%)]",      text: "text-white" },
};

function getInitials(name: string): string {
  // Attempt smart abbreviation
  const words = name.split(/\s+/);
  if (words.length === 1) return name.substring(0, 3).toUpperCase();
  return words.map(w => w[0]).join("").substring(0, 4).toUpperCase();
}

// Deterministic color from network name
function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

interface TVNetworkLogoProps {
  networkName: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-10 text-[9px]",
  md: "h-8 w-14 text-[11px]",
  lg: "h-10 w-18 text-xs",
};

export function TVNetworkLogo({ networkName, size = "md", showTooltip = true, className }: TVNetworkLogoProps) {
  const brand = NETWORK_BRANDS[networkName];

  const badge = brand ? (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded font-bold tracking-tight leading-none select-none shrink-0",
        brand.bg,
        brand.text,
        sizeClasses[size],
        className
      )}
    >
      {brand.abbr}
    </div>
  ) : (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded font-bold tracking-tight leading-none select-none shrink-0 text-white",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: hashColor(networkName) }}
    >
      {getInitials(networkName)}
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{networkName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TVNetworkLogoInline({ networkName, className }: { networkName: string; className?: string }) {
  return <TVNetworkLogo networkName={networkName} size="sm" className={className} />;
}
