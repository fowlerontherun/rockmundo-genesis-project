import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Clock,
  TrendingUp,
  Star,
  Zap,
  Target,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlotProjection {
  slotType: string;
  stage: string;
  time: string;
  estimatedCrowd: number;
  crowdEnergy: "low" | "medium" | "high" | "peak";
  genreMatch: number;
  competition: string[];
  recommendation: "ideal" | "good" | "neutral" | "poor";
  reason: string;
}

interface AudienceDemographic {
  ageGroup: string;
  percentage: number;
  genrePreference: string[];
}

interface FestivalCrowdProjectionsProps {
  festivalName: string;
  totalCapacity: number;
  expectedAttendance: number;
  bandGenre: string;
  bandFame: number;
  projections: SlotProjection[];
  demographics?: AudienceDemographic[];
}

const MOCK_PROJECTIONS: SlotProjection[] = [
  {
    slotType: "opening",
    stage: "Main Stage",
    time: "12:00 PM",
    estimatedCrowd: 2500,
    crowdEnergy: "low",
    genreMatch: 65,
    competition: [],
    recommendation: "neutral",
    reason: "Early crowd still arriving, but less competition for attention",
  },
  {
    slotType: "support",
    stage: "Main Stage",
    time: "3:00 PM",
    estimatedCrowd: 8000,
    crowdEnergy: "medium",
    genreMatch: 78,
    competition: ["Side Stage Act"],
    recommendation: "good",
    reason: "Good crowd size with moderate energy levels",
  },
  {
    slotType: "main",
    stage: "Main Stage",
    time: "6:00 PM",
    estimatedCrowd: 15000,
    crowdEnergy: "high",
    genreMatch: 85,
    competition: ["Food rush", "Sunset slot"],
    recommendation: "ideal",
    reason: "Prime time with peak crowd and high energy",
  },
  {
    slotType: "headline",
    stage: "Main Stage",
    time: "9:00 PM",
    estimatedCrowd: 20000,
    crowdEnergy: "peak",
    genreMatch: 90,
    competition: ["Headline-worthy only"],
    recommendation: "ideal",
    reason: "Maximum exposure but requires proven draw power",
  },
];

const MOCK_DEMOGRAPHICS: AudienceDemographic[] = [
  { ageGroup: "18-24", percentage: 35, genrePreference: ["Rock", "Indie", "Electronic"] },
  { ageGroup: "25-34", percentage: 40, genrePreference: ["Rock", "Alternative", "Metal"] },
  { ageGroup: "35-44", percentage: 18, genrePreference: ["Classic Rock", "Alternative"] },
  { ageGroup: "45+", percentage: 7, genrePreference: ["Classic Rock", "Blues"] },
];

export function FestivalCrowdProjections({
  festivalName,
  totalCapacity,
  expectedAttendance,
  bandGenre,
  bandFame,
  projections = MOCK_PROJECTIONS,
  demographics = MOCK_DEMOGRAPHICS,
}: FestivalCrowdProjectionsProps) {
  const getEnergyColor = (energy: string) => {
    switch (energy) {
      case "peak": return "text-primary bg-primary/10";
      case "high": return "text-green-500 bg-green-500/10";
      case "medium": return "text-amber-500 bg-amber-500/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "ideal": return { variant: "default" as const, text: "★ Ideal Slot" };
      case "good": return { variant: "secondary" as const, text: "Good Fit" };
      case "neutral": return { variant: "outline" as const, text: "Neutral" };
      default: return { variant: "destructive" as const, text: "Not Recommended" };
    }
  };

  const calculateFameBonus = () => {
    if (bandFame >= 2000) return { bonus: "+50%", text: "High fame attracts dedicated fans" };
    if (bandFame >= 1000) return { bonus: "+25%", text: "Growing reputation helps draw crowd" };
    if (bandFame >= 500) return { bonus: "+10%", text: "Some fans will seek you out" };
    return { bonus: "+0%", text: "Build fame to increase your draw" };
  };

  const fameBonus = calculateFameBonus();
  
  // Calculate genre match for demographics
  const genreMatchScore = demographics.reduce((score, demo) => {
    const hasMatch = demo.genrePreference.some(g => 
      bandGenre.toLowerCase().includes(g.toLowerCase()) ||
      g.toLowerCase().includes(bandGenre.toLowerCase())
    );
    return score + (hasMatch ? demo.percentage : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Crowd Projections
          </CardTitle>
          <CardDescription>
            Estimated audience data for {festivalName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Expected</p>
              <p className="text-lg font-bold">{expectedAttendance.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="text-lg font-bold">{totalCapacity.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Star className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-xs text-muted-foreground">Your Draw</p>
              <p className="text-lg font-bold text-primary">{fameBonus.bonus}</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{fameBonus.text}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slot Projections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Slot Analysis
          </CardTitle>
          <CardDescription>
            Crowd projections by time slot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projections.map((slot, index) => {
            const recBadge = getRecommendationBadge(slot.recommendation);
            return (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{slot.slotType}</Badge>
                    <span className="font-medium">{slot.time}</span>
                    <span className="text-sm text-muted-foreground">{slot.stage}</span>
                  </div>
                  <Badge variant={recBadge.variant}>{recBadge.text}</Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Est. Crowd</p>
                    <p className="font-bold flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {slot.estimatedCrowd.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Energy Level</p>
                    <Badge className={cn("mt-0.5", getEnergyColor(slot.crowdEnergy))}>
                      <Zap className="h-3 w-3 mr-1" />
                      {slot.crowdEnergy}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Genre Match</p>
                    <div className="flex items-center gap-2">
                      <Progress value={slot.genreMatch} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium">{slot.genreMatch}%</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground italic">
                  💡 {slot.reason}
                </p>
                
                {slot.competition.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Competing with:</span>
                    {slot.competition.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Demographics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Audience Demographics
          </CardTitle>
          <CardDescription>
            Expected audience breakdown • Genre match: {genreMatchScore}%
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {demographics.map((demo, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{demo.ageGroup}</span>
                <span className="text-muted-foreground">{demo.percentage}%</span>
              </div>
              <Progress value={demo.percentage} className="h-2" />
              <div className="flex gap-1 flex-wrap">
                {demo.genrePreference.map((genre, i) => {
                  const isMatch = bandGenre.toLowerCase().includes(genre.toLowerCase()) ||
                    genre.toLowerCase().includes(bandGenre.toLowerCase());
                  return (
                    <Badge
                      key={i}
                      variant={isMatch ? "default" : "outline"}
                      className={cn("text-xs", isMatch && "bg-primary text-primary-foreground")}
                    >
                      {genre}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
