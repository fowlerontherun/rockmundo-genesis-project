import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Heart, Star, Crown, MapPin, TrendingUp } from "lucide-react";
import type { FanConversionResult } from "@/utils/fanConversionCalculator";

interface FanGrowthCardProps {
  fanConversion: FanConversionResult | null;
}

export function FanGrowthCard({ fanConversion }: FanGrowthCardProps) {
  if (!fanConversion || fanConversion.newFansGained === 0) {
    return null;
  }

  const { newFansGained, casualFans, dedicatedFans, superfans, repeatAttendees, conversionRate, cityName } = fanConversion;

  const totalFanTypes = casualFans + dedicatedFans + superfans;
  const casualPercent = totalFanTypes > 0 ? (casualFans / totalFanTypes) * 100 : 0;
  const dedicatedPercent = totalFanTypes > 0 ? (dedicatedFans / totalFanTypes) * 100 : 0;
  const superfanPercent = totalFanTypes > 0 ? (superfans / totalFanTypes) * 100 : 0;

  return (
    <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-pink-500" />
          New Fans Gained
          <Badge variant="outline" className="ml-auto bg-pink-500/10 text-pink-400 border-pink-500/30">
            +{newFansGained} fans
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{cityName}</span>
          {repeatAttendees > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {repeatAttendees} returning fans
            </Badge>
          )}
        </div>

        {/* Conversion Rate */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Conversion Rate
            </span>
            <span className="text-lg font-bold text-green-500">{conversionRate.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(100, conversionRate * 3)} className="h-2" />
        </div>

        {/* Fan Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Fan Types</h4>
          
          {/* Casual Fans */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Casual Fans</span>
                <span className="text-sm text-muted-foreground">+{casualFans}</span>
              </div>
              <Progress value={casualPercent} className="h-1.5 mt-1" />
            </div>
          </div>

          {/* Dedicated Fans */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Star className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Dedicated Fans</span>
                <span className="text-sm text-muted-foreground">+{dedicatedFans}</span>
              </div>
              <Progress value={dedicatedPercent} className="h-1.5 mt-1" />
            </div>
          </div>

          {/* Superfans */}
          {superfans > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Superfans</span>
                  <span className="text-sm text-yellow-500 font-semibold">+{superfans}</span>
                </div>
                <Progress value={superfanPercent} className="h-1.5 mt-1" />
              </div>
            </div>
          )}
        </div>

        {/* Info Text */}
        <p className="text-xs text-muted-foreground">
          {superfans > 0 
            ? "Amazing show! You've gained superfans who'll follow you anywhere."
            : dedicatedFans > 0
            ? "Great performance! Some fans are becoming dedicated followers."
            : "Good show! You've attracted some new casual fans."}
        </p>
      </CardContent>
    </Card>
  );
}
