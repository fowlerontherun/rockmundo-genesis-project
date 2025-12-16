import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Building2, Star, Globe, Music, Search, Loader2 } from "lucide-react";

interface LabelBrowserProps {
  onSelectLabel?: (labelId: string) => void;
}

export const LabelBrowser = ({ onSelectLabel }: LabelBrowserProps) => {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const { data: labels, isLoading } = useQuery({
    queryKey: ["labels-browse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select("*")
        .order("reputation_score", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getTierBadge = (reputation: number) => {
    if (reputation >= 70) return { label: "Elite", color: "bg-purple-500" };
    if (reputation >= 40) return { label: "Established", color: "bg-blue-500" };
    return { label: "Indie", color: "bg-green-500" };
  };

  const filteredLabels = labels?.filter((label) => {
    const matchesSearch = label.name.toLowerCase().includes(search.toLowerCase()) ||
      label.genre_focus?.some(g => g.toLowerCase().includes(search.toLowerCase()));
    
    if (tierFilter === "all") return matchesSearch;
    
    const tier = getTierBadge(label.reputation_score || 0);
    return matchesSearch && tier.label.toLowerCase() === tierFilter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search labels or genres..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="elite">Elite</SelectItem>
            <SelectItem value="established">Established</SelectItem>
            <SelectItem value="indie">Indie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Labels Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredLabels?.map((label) => {
          const tier = getTierBadge(label.reputation_score || 0);
          
          return (
            <Card key={label.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`h-1 ${tier.color}`} />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{label.name}</CardTitle>
                  </div>
                  <Badge className={tier.color}>{tier.label}</Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {label.description || "No description available"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Reputation */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-3 w-3" /> Reputation
                    </span>
                    <span className="font-medium">{label.reputation_score || 0}/100</span>
                  </div>
                  <Progress value={label.reputation_score || 0} className="h-1.5" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span>{label.roster_slot_capacity || 10} slots</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{label.headquarters_city || "Global"}</span>
                  </div>
                </div>

                {/* Genres */}
                {label.genre_focus && label.genre_focus.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {label.genre_focus.slice(0, 3).map((genre, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <Music className="h-2 w-2 mr-1" />
                        {genre}
                      </Badge>
                    ))}
                    {label.genre_focus.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{label.genre_focus.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {onSelectLabel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectLabel(label.id)}
                    className="w-full"
                  >
                    View Details
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLabels?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No labels found matching your criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
