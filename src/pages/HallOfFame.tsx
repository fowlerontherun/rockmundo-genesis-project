import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Star, DollarSign, Music, Mic2, Calendar, Medal, Crown, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getHallOfFame } from "@/utils/retirement";
import { useTranslation } from "@/hooks/useTranslation";

type SortType = "fame" | "wealth" | "songs" | "gigs";

export default function HallOfFame() {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<SortType>("fame");

  const { data: legends, isLoading } = useQuery({
    queryKey: ["hall-of-fame"],
    queryFn: () => getHallOfFame(100),
    staleTime: 1000 * 60 * 5,
  });

  const sortedLegends = [...(legends || [])].sort((a, b) => {
    switch (sortBy) {
      case "fame":
        return (b.total_fame || 0) - (a.total_fame || 0);
      case "wealth":
        return (b.total_cash_earned || 0) - (a.total_cash_earned || 0);
      case "songs":
        return (b.total_songs || 0) - (a.total_songs || 0);
      case "gigs":
        return (b.total_gigs || 0) - (a.total_gigs || 0);
      default:
        return 0;
    }
  });

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-6 w-6 text-yellow-400" />;
    if (index === 1) return <Medal className="h-6 w-6 text-gray-300" />;
    if (index === 2) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Trophy className="h-10 w-10 text-warning" />
          <h1 className="text-4xl font-bold">Hall of Fame</h1>
          <Trophy className="h-10 w-10 text-warning" />
        </div>
        <p className="text-muted-foreground">
          Legendary musicians who've left their mark on Rockmundo
        </p>
      </div>

      {/* Sort Tabs */}
      <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as SortType)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-md mx-auto">
          <TabsTrigger value="fame" className="gap-1">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Fame</span>
          </TabsTrigger>
          <TabsTrigger value="wealth" className="gap-1">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Wealth</span>
          </TabsTrigger>
          <TabsTrigger value="songs" className="gap-1">
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline">Songs</span>
          </TabsTrigger>
          <TabsTrigger value="gigs" className="gap-1">
            <Mic2 className="h-4 w-4" />
            <span className="hidden sm:inline">Gigs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={sortBy} className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : sortedLegends.length === 0 ? (
            <Card className="p-8 text-center">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-xl font-semibold mb-2">No Legends Yet</h2>
              <p className="text-muted-foreground">
                Be the first to retire and enter the Hall of Fame!
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedLegends.map((legend, index) => (
                <Card
                  key={legend.id}
                  className={`transition-all hover:border-primary/30 ${
                    index === 0 ? "border-yellow-400/50 bg-gradient-to-r from-yellow-400/10 to-transparent" : ""
                  } ${index === 1 ? "border-gray-300/50 bg-gradient-to-r from-gray-300/10 to-transparent" : ""}
                  ${index === 2 ? "border-amber-600/50 bg-gradient-to-r from-amber-600/10 to-transparent" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="w-10 flex justify-center">{getRankIcon(index)}</div>

                      {/* Avatar */}
                      <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarImage src={legend.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {getInitials(legend.character_name)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg truncate">{legend.character_name}</h3>
                          {legend.generation_number > 1 && (
                            <Badge variant="outline" className="text-xs">
                              Gen {legend.generation_number}
                            </Badge>
                          )}
                          <Badge
                            variant={legend.retirement_type === "mandatory" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {legend.retirement_type === "mandatory" ? "Forced" : "Voluntary"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {legend.years_active} years
                          </span>
                          <span>Retired at {legend.final_age}</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-warning" />
                          <span className="font-bold">{(legend.total_fame || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-success" />
                          <span className="font-bold">${((legend.total_cash_earned || 0) / 1000).toFixed(0)}K</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Music className="h-4 w-4 text-primary" />
                          <span>{legend.total_songs || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mic2 className="h-4 w-4 text-accent" />
                          <span>{legend.total_gigs || 0}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
