import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth-context";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Music, Mic2, DollarSign } from "lucide-react";
import { CardSkeleton } from "@/components/ui/loading-skeletons";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface GigStat {
  date: string;
  rating: number;
}

interface SongStat {
  name: string;
  value: number;
}

interface EarningStat {
  date: string;
  amount: number;
}

export const PlayerAnalytics = () => {
  const { user } = useAuth();

  const { data: gigStats, isLoading: loadingGigs } = useQuery<GigStat[]>({
    queryKey: ["analytics", "gigs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: bands } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      if (!bands?.length) return [];

      const results: GigStat[] = [];
      
      for (const band of bands) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("gig_outcomes")
          .select("created_at, overall_rating")
          .eq("band_id", band.band_id)
          .order("created_at", { ascending: true })
          .limit(5);
        
        if (data) {
          for (const g of data) {
            results.push({
              date: new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              rating: g.overall_rating || 0,
            });
          }
        }
      }
      return results;
    },
    enabled: !!user?.id,
  });

  const { data: songStats, isLoading: loadingSongs } = useQuery<SongStat[]>({
    queryKey: ["analytics", "songs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data } = await supabase
        .from("songs")
        .select("genre, quality_score")
        .eq("user_id", user.id);

      const genreCounts: Record<string, number> = {};
      data?.forEach(song => {
        const genre = song.genre || 'Unknown';
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });

      return Object.entries(genreCounts).map(([name, value]) => ({ name, value }));
    },
    enabled: !!user?.id,
  });

  const { data: earningsData, isLoading: loadingEarnings } = useQuery<EarningStat[]>({
    queryKey: ["analytics", "earnings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: bands } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      if (!bands?.length) return [];

      const grouped: Record<string, number> = {};
      
      for (const band of bands) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("band_earnings")
          .select("created_at, amount")
          .eq("band_id", band.band_id)
          .order("created_at", { ascending: true })
          .limit(10);
        
        if (data) {
          for (const e of data) {
            const date = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            grouped[date] = (grouped[date] || 0) + (e.amount || 0);
          }
        }
      }

      return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
    },
    enabled: !!user?.id,
  });

  if (loadingGigs || loadingSongs || loadingEarnings) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mic2 className="h-4 w-4" />
            Gig Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gigStats && gigStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={gigStats}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No gig data yet
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Music className="h-4 w-4" />
            Songs by Genre
          </CardTitle>
        </CardHeader>
        <CardContent>
          {songStats && songStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={songStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name }) => name}
                >
                  {songStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No songs yet
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Earnings Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earningsData && earningsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={earningsData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`$${value}`, 'Earnings']} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No earnings data yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
