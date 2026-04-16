import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Music, Award } from "lucide-react";

interface LabelGenreExpertiseProps {
  labelId: string;
}

export function LabelGenreExpertise({ labelId }: LabelGenreExpertiseProps) {
  const { data: expertise = [], isLoading } = useQuery({
    queryKey: ['label-genre-expertise', labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_genre_expertise')
        .select('*')
        .eq('label_id', labelId)
        .order('expertise_level', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded" />;
  }

  if (expertise.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Music className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No genre expertise yet. Release music to build specialization.</p>
        </CardContent>
      </Card>
    );
  }

  const getExpertiseLabel = (level: number) => {
    if (level >= 8) return { label: "Master", color: "text-amber-400" };
    if (level >= 5) return { label: "Expert", color: "text-purple-400" };
    if (level >= 3) return { label: "Skilled", color: "text-blue-400" };
    return { label: "Novice", color: "text-muted-foreground" };
  };

  return (
    <div className="space-y-2">
      {expertise.map((entry) => {
        const tier = getExpertiseLabel(entry.expertise_level);
        return (
          <Card key={entry.id} className="bg-card/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Music className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{entry.genre}</span>
                  <Badge variant="outline" className={`text-[10px] ${tier.color}`}>
                    <Award className="h-3 w-3 mr-0.5" />
                    {tier.label}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{entry.releases_in_genre} releases</span>
              </div>
              <Progress value={(entry.expertise_level / 10) * 100} className="h-1.5" />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>Level {entry.expertise_level}/10</span>
                <span>${Number(entry.total_revenue_in_genre).toLocaleString()} revenue</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
