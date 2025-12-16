import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, Calendar, DollarSign, Image } from "lucide-react";
import { ReleasePredictions } from "./ReleasePredictions";
import { ManufacturingProgress } from "./ManufacturingProgress";
import { EditReleaseDialog } from "./EditReleaseDialog";
import { ReleaseTracklistWithAudio } from "./ReleaseTracklistWithAudio";

interface MyReleasesTabProps {
  userId: string;
}

export function MyReleasesTab({ userId }: MyReleasesTabProps) {
  const navigate = useNavigate();
  const [editingRelease, setEditingRelease] = useState<any>(null);

  const { data: releases, isLoading } = useQuery({
    queryKey: ["releases", userId],
    queryFn: async () => {
      // First get user's band IDs
      const { data: bandMemberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      
      const bandIds = bandMemberships?.map(d => d.band_id) || [];
      
      // Build the query
      let query = supabase
        .from("releases")
        .select(`
          *,
          release_songs(song:songs(id, title, quality_score, audio_url, audio_generation_status, genre), is_b_side),
          release_formats(*),
          bands(fame, popularity, chemistry_level),
          profiles!releases_user_id_fkey(fame, popularity)
        `)
        .order("created_at", { ascending: false });
      
      // Filter by user_id OR band membership
      if (bandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        query = query.eq("user_id", userId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

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
    <>
      <div className="grid gap-4">
        {releases.map((release: any) => (
          <Card key={release.id}>
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-4">
                  {release.artwork_url ? (
                    <img
                      src={release.artwork_url}
                      alt={release.title}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <CardTitle>{release.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{release.artist_name}</p>
                  </div>
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
              {/* Manufacturing Progress */}
              {release.release_status === "manufacturing" && (
                <ManufacturingProgress
                  createdAt={release.created_at}
                  manufacturingCompleteAt={release.manufacturing_complete_at}
                  status={release.release_status}
                />
              )}

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
                <ReleaseTracklistWithAudio 
                  tracks={release.release_songs || []}
                  showAudio={release.release_status === "released"}
                />
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Formats</h4>
                <div className="flex flex-wrap gap-2">
                  {release.release_formats?.map((format: any) => (
                    <Badge key={format.id} variant="secondary">
                      <div className="flex items-center gap-2">
                        <span className="capitalize">{format.format_type}</span>
                        {format.release_date && (
                          <>
                            <Calendar className="h-3 w-3" />
                            <span className="text-xs">
                              {new Date(format.release_date).toLocaleDateString()}
                            </span>
                          </>
                        )}
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/release/${release.id}`)}
                >
                  View Details
                </Button>
                {release.release_status !== "released" && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingRelease(release)}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditReleaseDialog
        open={!!editingRelease}
        onOpenChange={(open) => !open && setEditingRelease(null)}
        release={editingRelease}
      />
    </>
  );
}
