import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, Star, Camera, Sparkles, 
  Crown, Award, Gem 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelingCareerProgressProps {
  totalGigsCompleted: number;
  totalEarnings: number;
  playerLooks: number;
  currentTier: string;
}

interface CareerTier {
  id: string;
  label: string;
  minGigs: number;
  minLooks: number;
  icon: React.ElementType;
  perks: string[];
  color: string;
}

const CAREER_TIERS: CareerTier[] = [
  {
    id: "amateur",
    label: "Amateur Model",
    minGigs: 0,
    minLooks: 0,
    icon: Camera,
    perks: ["Local photo shoots", "Basic catalog work"],
    color: "text-muted-foreground",
  },
  {
    id: "rising",
    label: "Rising Model",
    minGigs: 3,
    minLooks: 40,
    icon: TrendingUp,
    perks: ["National campaigns", "Runway shows", "Better compensation"],
    color: "text-blue-500",
  },
  {
    id: "established",
    label: "Established Model",
    minGigs: 8,
    minLooks: 60,
    icon: Star,
    perks: ["International work", "Cover shoots", "Brand ambassadorships"],
    color: "text-purple-500",
  },
  {
    id: "supermodel",
    label: "Supermodel",
    minGigs: 15,
    minLooks: 80,
    icon: Crown,
    perks: ["Fashion Week invites", "Elite agency representation", "Designer collaborations"],
    color: "text-amber-500",
  },
  {
    id: "icon",
    label: "Fashion Icon",
    minGigs: 25,
    minLooks: 90,
    icon: Gem,
    perks: ["Met Gala attendance", "Own fashion line", "Global brand deals"],
    color: "text-pink-500",
  },
];

const FASHION_WEEK_EVENTS = [
  { name: "New York Fashion Week", city: "New York", month: "February", prestige: 4 },
  { name: "London Fashion Week", city: "London", month: "February", prestige: 3 },
  { name: "Milan Fashion Week", city: "Milan", month: "February", prestige: 5 },
  { name: "Paris Fashion Week", city: "Paris", month: "March", prestige: 5 },
  { name: "Met Gala", city: "New York", month: "May", prestige: 5 },
];

export function ModelingCareerProgress({
  totalGigsCompleted,
  totalEarnings,
  playerLooks,
  currentTier,
}: ModelingCareerProgressProps) {
  const getCurrentTier = (): CareerTier => {
    let tier = CAREER_TIERS[0];
    for (const t of CAREER_TIERS) {
      if (totalGigsCompleted >= t.minGigs && playerLooks >= t.minLooks) {
        tier = t;
      }
    }
    return tier;
  };

  const getNextTier = (): CareerTier | null => {
    const current = getCurrentTier();
    const currentIndex = CAREER_TIERS.findIndex(t => t.id === current.id);
    return currentIndex < CAREER_TIERS.length - 1 ? CAREER_TIERS[currentIndex + 1] : null;
  };

  const tier = getCurrentTier();
  const nextTier = getNextTier();
  const TierIcon = tier.icon;

  const gigsProgress = nextTier
    ? Math.min(100, ((totalGigsCompleted - tier.minGigs) / (nextTier.minGigs - tier.minGigs)) * 100)
    : 100;
  const looksProgress = nextTier
    ? Math.min(100, ((playerLooks - tier.minLooks) / (nextTier.minLooks - tier.minLooks)) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Current Tier Card */}
      <Card className="bg-gradient-to-r from-pink-500/5 to-purple-500/5 border-pink-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={cn("w-14 h-14 rounded-full bg-background flex items-center justify-center border-2", 
              tier.id === "icon" ? "border-pink-500" : tier.id === "supermodel" ? "border-amber-500" : "border-primary"
            )}>
              <TierIcon className={cn("h-7 w-7", tier.color)} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className={cn("font-bold text-lg", tier.color)}>{tier.label}</h3>
                <Badge variant="outline" className="text-xs">
                  {totalGigsCompleted} gigs
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Total earnings: ${totalEarnings.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress to Next Tier */}
      {nextTier && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Progress to {nextTier.label}</span>
              <nextTier.icon className={cn("h-4 w-4", nextTier.color)} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Gigs ({totalGigsCompleted}/{nextTier.minGigs})</span>
                <span>{Math.round(gigsProgress)}%</span>
              </div>
              <Progress value={gigsProgress} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Looks ({playerLooks}/{nextTier.minLooks})</span>
                <span>{Math.round(looksProgress)}%</span>
              </div>
              <Progress value={looksProgress} className="h-2" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Unlocks:</p>
              <div className="flex flex-wrap gap-1">
                {nextTier.perks.map((perk, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{perk}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fashion Week Events */}
      {(tier.id === "supermodel" || tier.id === "icon") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-500" />
              Fashion Week Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {FASHION_WEEK_EVENTS.map((event, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{event.name}</p>
                  <p className="text-xs text-muted-foreground">{event.city} • {event.month}</p>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: event.prestige }, (_, j) => (
                    <Star key={j} className="h-3 w-3 text-amber-400 fill-amber-400" />
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              As a {tier.label}, you're eligible to attend these elite fashion events!
            </p>
          </CardContent>
        </Card>
      )}

      {/* All Tiers Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Career Tiers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {CAREER_TIERS.map((t) => {
            const isCurrentTier = t.id === tier.id;
            const isUnlocked = totalGigsCompleted >= t.minGigs && playerLooks >= t.minLooks;
            const Icon = t.icon;

            return (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all",
                  isCurrentTier && "bg-primary/10 border border-primary/30",
                  !isCurrentTier && isUnlocked && "opacity-60",
                  !isUnlocked && "opacity-30"
                )}
              >
                <Icon className={cn("h-5 w-5", isUnlocked ? t.color : "text-muted-foreground")} />
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", isCurrentTier && "text-primary")}>
                    {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.minGigs} gigs • {t.minLooks} looks
                  </p>
                </div>
                {isCurrentTier && <Badge>Current</Badge>}
                {isUnlocked && !isCurrentTier && <Badge variant="outline">Unlocked</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
