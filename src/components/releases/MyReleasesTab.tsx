import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, Calendar, DollarSign } from "lucide-react";
import { ReleasePredictions } from "./ReleasePredictions";

interface MyReleasesTabProps {
  userId: string;
}

export function MyReleasesTab({ userId }: MyReleasesTabProps) {
  const { data: releases, isLoading } = useQuery({
    queryKey: ["releases", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("releases")
        .select(`
          *,
          release_songs(song:songs(title, quality_score)),
          release_formats(*),
          bands(fame, popularity, chemistry_level),
          profiles!releases_user_id_fkey(fame, popularity)
        `)
        .or(`user_id.eq.${userId},band_id.in.(${await getBandIds(userId)})`)
        .order("created_at", { ascending: false });
      return data || [];
    }
  });

  async function getBandIds(userId: string) {
    const { data } = await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", userId);
    return data?.map(d => d.band_id).join(",") || "null";
  }

  if (isLoading) {
    return <div>Loading releases...</div>;
  }

  if (!releases || releases.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Releases Yet</h3>
          <p className="text-muted-foreground">
            Create your first release to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {releases.map((release: any) => (
        <Card key={release.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{release.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{release.artist_name}</p>
              </div>
              <Badge variant={
                release.release_status === "released" ? "default" :
                release.release_status === "manufacturing" ? "secondary" :
                "outline"
              }>
                {release.release_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                <span className="capitalize">{release.release_type}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span>Cost: ${release.total_cost}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span>Revenue: ${release.total_revenue || 0}</span>
              </div>
              {release.manufacturing_complete_at && release.release_status === 'manufacturing' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">
                    Ready: {new Date(release.manufacturing_complete_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              {release.scheduled_release_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">
                    Release: {new Date(release.scheduled_release_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Tracks</h4>
              <div className="space-y-1">
                {release.release_songs?.map((rs: any, index: number) => (
                  <div key={index} className="text-sm flex items-center gap-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span>{rs.song?.title}</span>
                    {rs.is_b_side && <Badge variant="outline" className="text-xs">B-side</Badge>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Formats</h4>
              <div className="flex flex-wrap gap-2">
                {release.release_formats?.map((format: any) => (
                  <Badge key={format.id} variant="secondary">
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{format.format_type}</span>
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs">
                        {new Date(format.release_date).toLocaleDateString()}
                      </span>
                    </div>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Show predictions for planned/manufacturing releases */}
            {(release.release_status === "planned" || release.release_status === "manufacturing") && (
              <ReleasePredictions
                artistFame={release.bands?.[0]?.fame || release.profiles?.fame || 0}
                artistPopularity={release.bands?.[0]?.popularity || release.profiles?.popularity || 0}
                songQuality={
                  release.release_songs?.reduce((sum: number, rs: any) => 
                    sum + (rs.song?.quality_score || 0), 0
                  ) / (release.release_songs?.length || 1)
                }
                bandChemistry={release.bands?.[0]?.chemistry_level}
                releaseType={release.release_type}
                formatTypes={release.release_formats?.map((f: any) => f.format_type) || []}
                trackCount={release.release_songs?.length || 1}
              />
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm">View Details</Button>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
