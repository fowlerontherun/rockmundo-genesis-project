import { Calendar, Cake, Sun, Snowflake, Leaf, Flower2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import type { Season } from "@/utils/gameCalendar";
import { getDeclinePercentage, RETIREMENT_AGES } from "@/utils/skillDecline";

interface EnhancedGameDateWidgetProps {
  profileCreatedAt?: Date;
  playerAge?: number;
  characterBirthDate?: Date | null;
}

const SEASON_CONFIG: Record<Season, { icon: React.ElementType; color: string; bgGradient: string; label: string }> = {
  spring: {
    icon: Flower2,
    color: "text-pink-400",
    bgGradient: "from-pink-500/20 via-green-500/10 to-transparent",
    label: "Spring",
  },
  summer: {
    icon: Sun,
    color: "text-amber-400",
    bgGradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    label: "Summer",
  },
  autumn: {
    icon: Leaf,
    color: "text-orange-500",
    bgGradient: "from-orange-600/20 via-red-500/10 to-transparent",
    label: "Autumn",
  },
  winter: {
    icon: Snowflake,
    color: "text-blue-300",
    bgGradient: "from-blue-400/20 via-cyan-500/10 to-transparent",
    label: "Winter",
  },
};

export function EnhancedGameDateWidget({
  profileCreatedAt,
  playerAge = 16,
  characterBirthDate,
}: EnhancedGameDateWidgetProps) {
  const { data: calendar, isLoading } = useGameCalendar();

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!calendar) return null;

  const seasonConfig = SEASON_CONFIG[calendar.season];
  const SeasonIcon = seasonConfig.icon;

  // Calculate season progress
  const daysInSeason = 90;
  const dayInSeason = ((calendar.gameMonth - 1) % 3) * 30 + calendar.gameDay;
  const seasonProgress = (dayInSeason / daysInSeason) * 100;

  // Calculate days until birthday
  let daysUntilBirthday: number | null = null;
  if (characterBirthDate) {
    const birthMonth = characterBirthDate.getMonth() + 1;
    const birthDay = characterBirthDate.getDate();

    // Calculate days until next birthday in game calendar
    const currentGameDay = (calendar.gameMonth - 1) * 30 + calendar.gameDay;
    const birthdayGameDay = (birthMonth - 1) * 30 + birthDay;

    if (birthdayGameDay > currentGameDay) {
      daysUntilBirthday = birthdayGameDay - currentGameDay;
    } else if (birthdayGameDay < currentGameDay) {
      daysUntilBirthday = 360 - currentGameDay + birthdayGameDay;
    } else {
      daysUntilBirthday = 0; // It's their birthday!
    }
  }

  const isBirthday = daysUntilBirthday === 0;
  const skillDecline = getDeclinePercentage(playerAge);
  const isApproachingRetirement = playerAge >= RETIREMENT_AGES.FIRST_PROMPT;

  return (
    <TooltipProvider>
      <Card className={`relative overflow-hidden border-primary/20 bg-gradient-to-br ${seasonConfig.bgGradient}`}>
        <CardContent className="p-4 space-y-4">
          {/* Main Date Display */}
          <div className="flex items-start gap-4">
            {/* Season Icon */}
            <div
              className={`flex-shrink-0 p-3 rounded-xl bg-background/50 backdrop-blur ${seasonConfig.color}`}
            >
              <SeasonIcon className="h-8 w-8" />
            </div>

            {/* Date Info */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-bold">
                  {calendar.monthName} {calendar.gameDay}
                </span>
              </div>
              <div className="text-2xl font-bold text-primary">Year {calendar.gameYear}</div>
              <div className={`text-sm font-medium ${seasonConfig.color}`}>
                {seasonConfig.label} • Day {dayInSeason} of {daysInSeason}
              </div>
            </div>

            {/* Season Emoji */}
            <div className="text-4xl">{calendar.seasonEmoji}</div>
          </div>

          {/* Season Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Season Progress</span>
              <span>{Math.round(seasonProgress)}%</span>
            </div>
            <Progress value={seasonProgress} className="h-2" />
          </div>

          {/* Player Age Section */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
            {/* Age */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-background/30">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Age</div>
                    <div className={`font-bold ${isApproachingRetirement ? "text-warning" : ""}`}>
                      {playerAge} years
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {skillDecline > 0 ? (
                  <p className="text-warning">Skills declining by {skillDecline}%</p>
                ) : playerAge >= 55 ? (
                  <p>Skills will start declining at age 60</p>
                ) : (
                  <p>Your character's current age</p>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Birthday */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    isBirthday ? "bg-primary/20 animate-pulse" : "bg-background/30"
                  }`}
                >
                  <Cake className={`h-4 w-4 ${isBirthday ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <div className="text-xs text-muted-foreground">Birthday</div>
                    <div className={`font-bold ${isBirthday ? "text-primary" : ""}`}>
                      {isBirthday
                        ? "🎉 Today!"
                        : daysUntilBirthday !== null
                        ? `${daysUntilBirthday} days`
                        : "Not set"}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {isBirthday ? (
                  <p>Happy Birthday! Claim your reward!</p>
                ) : daysUntilBirthday !== null ? (
                  <p>{daysUntilBirthday} game days until your birthday</p>
                ) : (
                  <p>Set your birth date in settings</p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Retirement Warning */}
          {isApproachingRetirement && (
            <div className="p-2 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning">
              {playerAge >= 80 ? (
                <span>⚠️ Mandatory retirement at 80. Consider retiring now!</span>
              ) : playerAge >= 60 ? (
                <span>📉 Skills declining. Consider retiring to pass on your legacy.</span>
              ) : (
                <span>🎸 A legendary career! Retirement available at 65.</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
