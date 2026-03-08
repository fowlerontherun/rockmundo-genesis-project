import { useQuery } from "@tanstack/react-query";
import { Skull, Star, DollarSign, Music, Mic2, Calendar, Crown, Medal, Award } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface ImmortalEntry {
  id: string;
  character_name: string;
  avatar_url: string | null;
  cause_of_death: string;
  died_at: string;
  age_at_death: number | null;
  years_active: number | null;
  total_fame: number;
  total_cash_at_death: number;
  total_songs: number;
  total_gigs: number;
  final_skills: Record<string, number>;
  generation_number: number;
  bio: string | null;
}

async function getHallOfImmortals(limit = 100): Promise<ImmortalEntry[]> {
  const { data, error } = await supabase
    .from("hall_of_immortals")
    .select("*")
    .order("total_fame", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching hall of immortals:", error);
    return [];
  }
  return data as ImmortalEntry[];
}

export default function HallOfImmortals() {
  const { data: immortals, isLoading } = useQuery({
    queryKey: ["hall-of-immortals"],
    queryFn: () => getHallOfImmortals(100),
    staleTime: 1000 * 60 * 5,
  });

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-6 w-6 text-destructive" />;
    if (index === 1) return <Medal className="h-6 w-6 text-muted-foreground" />;
    if (index === 2) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
  };

  return (
    <PageLayout>
      <PageHeader
        title="Hall of Immortals"
        subtitle="Characters who fell — but will never be forgotten"
        backTo="/hub/character"
        backLabel="Back to Character"
        icon={Skull}
      />

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !immortals || immortals.length === 0 ? (
        <Card className="p-8 text-center">
          <Skull className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-xl font-semibold mb-2">No Fallen Characters Yet</h2>
          <p className="text-muted-foreground">
            When characters perish from neglect, they&apos;ll be immortalized here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {immortals.map((entry, index) => (
            <Card
              key={entry.id}
              className={`transition-all hover:border-destructive/30 ${
                index === 0
                  ? "border-destructive/50 bg-gradient-to-r from-destructive/10 to-transparent"
                  : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 flex justify-center">{getRankIcon(index)}</div>

                  <Avatar className="h-14 w-14 border-2 border-destructive/20">
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback className="bg-destructive/20 text-destructive font-bold">
                      {entry.character_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg truncate">{entry.character_name}</h3>
                      {entry.generation_number > 1 && (
                        <Badge variant="outline" className="text-xs">
                          Gen {entry.generation_number}
                        </Badge>
                      )}
                      <Badge variant="destructive" className="text-xs">
                        {entry.cause_of_death}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {entry.years_active ?? 0} years active
                      </span>
                      <span>Died at age {entry.age_at_death ?? "?"}</span>
                      <span className="text-xs">
                        {new Date(entry.died_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-warning" />
                      <span className="font-bold">{(entry.total_fame || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="font-bold">
                        ${((entry.total_cash_at_death || 0) / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Music className="h-4 w-4 text-primary" />
                      <span>{entry.total_songs || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Mic2 className="h-4 w-4 text-accent" />
                      <span>{entry.total_gigs || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
