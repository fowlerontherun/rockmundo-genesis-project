import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListMusic, TrendingUp, Users, DollarSign, Send, Music, CheckCircle, Clock, XCircle, Search, X } from "lucide-react";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PlaylistsTabProps {
  userId: string;     // account user_id
  profileId: string;  // character profile id
}

export const PlaylistsTab = ({ userId, profileId }: PlaylistsTabProps) => {
  const { playlists, userSubmissions, isLoadingPlaylists, isLoadingSubmissions, submitToPlaylist, isSubmitting, processPending, isProcessingPending } = usePlaylists(profileId ?? undefined);
  const [selectedRelease, setSelectedRelease] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [curatorFilter, setCuratorFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all"); // all | free | paid
  const [sizeFilter, setSizeFilter] = useState("all"); // all | small | medium | large
  const [sortBy, setSortBy] = useState("followers_desc");

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    playlists.forEach((p: any) => p.platform?.platform_name && set.add(p.platform.platform_name));
    return Array.from(set).sort();
  }, [playlists]);

  const curatorOptions = useMemo(() => {
    const set = new Set<string>();
    playlists.forEach((p: any) => p.curator_type && set.add(p.curator_type));
    return Array.from(set).sort();
  }, [playlists]);

  const filteredPlaylists = useMemo(() => {
    let list = [...playlists];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) => (p.playlist_name || "").toLowerCase().includes(q));
    }
    if (platformFilter !== "all") {
      list = list.filter((p: any) => p.platform?.platform_name === platformFilter);
    }
    if (curatorFilter !== "all") {
      list = list.filter((p: any) => p.curator_type === curatorFilter);
    }
    if (feeFilter === "free") {
      list = list.filter((p: any) => (p.submission_cost || 0) === 0);
    } else if (feeFilter === "paid") {
      list = list.filter((p: any) => (p.submission_cost || 0) > 0);
    }
    if (sizeFilter === "small") {
      list = list.filter((p: any) => (p.follower_count || 0) < 10000);
    } else if (sizeFilter === "medium") {
      list = list.filter((p: any) => (p.follower_count || 0) >= 10000 && (p.follower_count || 0) < 100000);
    } else if (sizeFilter === "large") {
      list = list.filter((p: any) => (p.follower_count || 0) >= 100000);
    }
    switch (sortBy) {
      case "followers_desc":
        list.sort((a: any, b: any) => (b.follower_count || 0) - (a.follower_count || 0));
        break;
      case "followers_asc":
        list.sort((a: any, b: any) => (a.follower_count || 0) - (b.follower_count || 0));
        break;
      case "fee_asc":
        list.sort((a: any, b: any) => (a.submission_cost || 0) - (b.submission_cost || 0));
        break;
      case "fee_desc":
        list.sort((a: any, b: any) => (b.submission_cost || 0) - (a.submission_cost || 0));
        break;
      case "name_asc":
        list.sort((a: any, b: any) => (a.playlist_name || "").localeCompare(b.playlist_name || ""));
        break;
    }
    return list;
  }, [playlists, searchQuery, platformFilter, curatorFilter, feeFilter, sizeFilter, sortBy]);

  const hasActiveFilters =
    searchQuery !== "" ||
    platformFilter !== "all" ||
    curatorFilter !== "all" ||
    feeFilter !== "all" ||
    sizeFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setPlatformFilter("all");
    setCuratorFilter("all");
    setFeeFilter("all");
    setSizeFilter("all");
  };

  // Fetch user's active streaming releases (solo + band)
  const { data: userReleases = [], isLoading: isLoadingReleases } = useQuery({
    queryKey: ["user-streaming-releases", userId, profileId],
    queryFn: async () => {
      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId);

      const bandIds = bandMembers?.map(b => b.band_id) || [];

      let query = supabase
        .from("song_releases")
        .select(`
          id,
          song:songs(id, title, genre),
          platform:streaming_platforms(platform_name)
        `)
        .eq("release_type", "streaming")
        .eq("is_active", true);

      if (bandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data } = await query;
      return (data || []).filter((r: any) => r.song?.id);
    },
    enabled: !!userId,
  });

  const handleSubmit = (playlistId: string) => {
    if (!selectedRelease) return;
    submitToPlaylist({ playlistId, releaseId: selectedRelease });
  };

  const getAcceptanceRate = (criteria: Record<string, any>): number => {
    // Estimate acceptance rate from criteria
    const minQuality = criteria?.min_quality || 50;
    // Higher quality requirement = lower acceptance rate
    return Math.max(5, Math.min(50, 100 - minQuality));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'accepted':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (isLoadingPlaylists) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No Playlists Available</h3>
          <p className="text-muted-foreground mt-2">
            Playlists will appear here once they are created by curators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListMusic className="h-5 w-5" />
            Playlist Submissions
          </CardTitle>
          <CardDescription>
            Submit your streaming releases to curated playlists for increased exposure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Select a release to submit:</label>
            <Select value={selectedRelease} onValueChange={setSelectedRelease}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a streaming release..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingReleases ? (
                  <SelectItem value="loading" disabled>Loading releases...</SelectItem>
                ) : userReleases.length === 0 ? (
                  <SelectItem value="none" disabled>No streaming releases available</SelectItem>
                ) : (
                  userReleases.map((release: any) => (
                    <SelectItem key={release.id} value={release.id}>
                      {release.song?.title} ({release.song?.genre}) - {release.platform?.platform_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {userReleases.length === 0 && !isLoadingReleases && (
              <p className="text-xs text-muted-foreground mt-2">
                You need to release songs to streaming platforms first before submitting to playlists.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoadingSubmissions ? (
        <Skeleton className="h-32 w-full" />
      ) : userSubmissions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Your Submissions</CardTitle>
            {userSubmissions.some(s => s.submission_status === 'pending') && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => processPending()}
                disabled={isProcessingPending}
              >
                {isProcessingPending ? "Processing..." : "Check Status"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userSubmissions.map((submission) => (
                <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(submission.submission_status)}
                    <div>
                      <p className="font-medium">{submission.playlist?.playlist_name || "Unknown Playlist"}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(submission.submission_status)}>
                    {submission.submission_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">
          Available Playlists ({filteredPlaylists.length}
          {filteredPlaylists.length !== playlists.length ? ` of ${playlists.length}` : ""})
        </h3>
        <p className="text-sm text-muted-foreground">
          Submit your songs to these curated playlists. Higher follower counts mean more exposure!
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playlists by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="followers_desc">Most Followers</SelectItem>
                <SelectItem value="followers_asc">Fewest Followers</SelectItem>
                <SelectItem value="fee_asc">Lowest Fee</SelectItem>
                <SelectItem value="fee_desc">Highest Fee</SelectItem>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platformOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={curatorFilter} onValueChange={setCuratorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Curator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Curators</SelectItem>
                {curatorOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={feeFilter} onValueChange={setFeeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Fee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Fee</SelectItem>
                <SelectItem value="free">Free Only</SelectItem>
                <SelectItem value="paid">Paid Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Size</SelectItem>
                <SelectItem value="small">Small (&lt;10K)</SelectItem>
                <SelectItem value="medium">Medium (10K–100K)</SelectItem>
                <SelectItem value="large">Large (100K+)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {filteredPlaylists.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No playlists match your filters.
          </CardContent>
        </Card>
      ) : (() => {
        // Group filtered playlists by streaming platform
        const groups = new Map<string, typeof filteredPlaylists>();
        filteredPlaylists.forEach((pl) => {
          const key = pl.platform?.platform_name || "Other";
          if (!groups.has(key)) groups.set(key, [] as typeof filteredPlaylists);
          groups.get(key)!.push(pl);
        });
        const groupEntries = Array.from(groups.entries()).sort((a, b) =>
          a[0].localeCompare(b[0])
        );

        return (
          <div className="space-y-8">
            {groupEntries.map(([platformName, platformPlaylists]) => (
              <div key={platformName} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-base font-semibold flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    {platformName}
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    {platformPlaylists.length} playlist{platformPlaylists.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {platformPlaylists.map((playlist) => {
                    const acceptanceRate = getAcceptanceRate(playlist.acceptance_criteria || {});
                    const submissionCost = playlist.submission_cost || 0;

                    return (
                      <Card key={playlist.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{playlist.playlist_name}</CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{playlist.curator_type}</Badge>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>
                                {playlist.follower_count >= 1000000
                                  ? `${(playlist.follower_count / 1000000).toFixed(1)}M`
                                  : playlist.follower_count >= 1000
                                  ? `${(playlist.follower_count / 1000).toFixed(0)}K`
                                  : playlist.follower_count} followers
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <TrendingUp className="h-4 w-4" />
                              <span>~{acceptanceRate}% acceptance</span>
                            </div>
                          </div>

                          {playlist.boost_multiplier > 1 && (
                            <div className="text-xs text-primary">
                              ⚡ {playlist.boost_multiplier}x stream boost on acceptance
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <DollarSign className="h-4 w-4" />
                              <span>${(submissionCost / 100).toFixed(2)} fee</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSubmit(playlist.id)}
                              disabled={!selectedRelease || isSubmitting}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {isSubmitting ? "Submitting..." : "Submit"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};
