import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useVipStatus } from "@/hooks/useVipStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Radio, Music, Send, CheckCircle2, XCircle, 
  AlertCircle, ChevronRight, Users, Star, MapPin, Crown, Lock
} from "lucide-react";

interface RadioSubmissionWizardProps {
  bandId: string;
  onComplete?: () => void;
}

interface EligibleStation {
  id: string;
  name: string;
  station_type: string;
  country: string;
  listener_base: number;
  accepted_genres: string[];
  min_fans_required: number;
  min_fame_required: number;
  requires_local_presence: boolean;
  auto_accept_threshold: number;
  isEligible: boolean;
  eligibilityReason?: string;
}

interface Song {
  id: string;
  title: string;
  genre: string;
  quality_score: number;
}

export function RadioSubmissionWizard({ bandId, onComplete }: RadioSubmissionWizardProps) {
  const { user } = useAuth();
  const { data: vipStatus } = useVipStatus();
  const isVip = vipStatus?.isVip ?? false;
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedStations, setSelectedStations] = useState<Set<string>>(new Set());
  const [submissionResults, setSubmissionResults] = useState<{
    accepted: string[];
    pending: string[];
    failed: string[];
  }>({ accepted: [], pending: [], failed: [] });

  // Fetch band data
  const { data: band } = useQuery({
    queryKey: ["band-for-radio", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, genre, fame, total_fans")
        .eq("id", bandId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  // Fetch band's city fans for local presence check
  const { data: cityFans = [] } = useQuery({
    queryKey: ["band-city-fans-radio", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_city_fans")
        .select("city_id, city_name, total_fans")
        .eq("band_id", bandId);
      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  // Fetch recorded songs
  const { data: songs = [], isLoading: songsLoading } = useQuery({
    queryKey: ["band-recorded-songs", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score")
        .eq("band_id", bandId)
        .eq("status", "recorded")
        .order("quality_score", { ascending: false });
      if (error) throw error;
      return data as Song[];
    },
    enabled: !!bandId,
  });

  // Fetch visited countries
  const { data: visitedCountries = [] } = useQuery({
    queryKey: ["visited-countries-wizard", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_country_fans")
        .select("country")
        .eq("band_id", bandId)
        .eq("has_performed", true);
      if (error) throw error;
      return data.map(d => d.country);
    },
    enabled: !!bandId,
  });

  // Fetch radio stations — only from visited countries
  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["radio-stations-wizard", visitedCountries],
    queryFn: async () => {
      if (visitedCountries.length === 0) return [];
      const { data, error } = await supabase
        .from("radio_stations")
        .select("*")
        .eq("is_active", true)
        .in("country", visitedCountries)
        .order("listener_base", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: visitedCountries.length > 0,
  });

  // Fetch existing submissions
  const { data: existingSubmissions = [] } = useQuery({
    queryKey: ["existing-submissions", selectedSong?.id],
    queryFn: async () => {
      if (!selectedSong || !user) return [];
      const { data, error } = await supabase
        .from("radio_submissions")
        .select("station_id")
        .eq("song_id", selectedSong.id)
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map(s => s.station_id);
    },
    enabled: !!selectedSong && !!user,
  });

  // Calculate eligible stations
  const eligibleStations = useMemo((): EligibleStation[] => {
    if (!selectedSong || !band) return [];
    
    const cityFanMap = new Set(cityFans.map(cf => cf.city_id));
    
    return stations.map(station => {
      const reasons: string[] = [];
      let isEligible = true;

      // Check if already submitted
      if (existingSubmissions.includes(station.id)) {
        isEligible = false;
        reasons.push("Already submitted");
      }

      // Check genre match
      const genreMatch = station.accepted_genres?.some(
        (g: string) => g.toLowerCase() === selectedSong.genre?.toLowerCase()
      );
      if (!genreMatch) {
        isEligible = false;
        reasons.push("Genre mismatch");
      }

      // Check fan requirement
      if ((station.min_fans_required || 0) > (band.total_fans || 0)) {
        isEligible = false;
        reasons.push(`Need ${station.min_fans_required} fans`);
      }

      // Check fame requirement
      if ((station.min_fame_required || 0) > (band.fame || 0)) {
        isEligible = false;
        reasons.push(`Need ${station.min_fame_required} fame`);
      }

      // Check local presence for local stations
      if (station.requires_local_presence && !cityFanMap.has(station.city_id)) {
        isEligible = false;
        reasons.push("No local presence");
      }

      return {
        id: station.id,
        name: station.name,
        station_type: station.station_type,
        country: station.country,
        listener_base: station.listener_base,
        accepted_genres: station.accepted_genres || [],
        min_fans_required: station.min_fans_required || 0,
        min_fame_required: station.min_fame_required || 0,
        requires_local_presence: station.requires_local_presence || false,
        auto_accept_threshold: station.auto_accept_threshold || 80,
        isEligible,
        eligibilityReason: reasons.join(", "),
      };
    });
  }, [selectedSong, band, stations, cityFans, existingSubmissions]);

  const eligibleCount = eligibleStations.filter(s => s.isEligible).length;

  // Batch submission mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedSong || selectedStations.size === 0) {
        throw new Error("Missing required data");
      }

      const results = { accepted: [] as string[], pending: [] as string[], failed: [] as string[] };
      
      for (const stationId of selectedStations) {
        const station = eligibleStations.find(s => s.id === stationId);
        if (!station) continue;

        try {
          // Determine if auto-accept (song quality >= threshold)
          const shouldAutoAccept = (selectedSong.quality_score || 0) >= station.auto_accept_threshold;
          
          const { error } = await supabase
            .from("radio_submissions")
            .insert({
              station_id: stationId,
              song_id: selectedSong.id,
              user_id: user.id,
              band_id: bandId,
              status: shouldAutoAccept ? "accepted" : "pending",
              reviewed_at: shouldAutoAccept ? new Date().toISOString() : null,
            });

          if (error) throw error;
          
          if (shouldAutoAccept) {
            results.accepted.push(station.name);
          } else {
            results.pending.push(station.name);
          }
        } catch (err) {
          results.failed.push(station.name);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setSubmissionResults(results);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ["my-radio-submissions"] });
      
      if (results.accepted.length > 0) {
        toast.success(`${results.accepted.length} stations auto-accepted your song!`);
      }
      if (results.pending.length > 0) {
        toast.info(`${results.pending.length} submissions pending review`);
      }
    },
    onError: (error: any) => {
      toast.error("Submission failed", { description: error.message });
    },
  });

  const handleSelectAllEligible = () => {
    const eligibleIds = eligibleStations.filter(s => s.isEligible).map(s => s.id);
    setSelectedStations(new Set(eligibleIds));
  };

  const toggleStation = (stationId: string) => {
    const newSet = new Set(selectedStations);
    if (newSet.has(stationId)) {
      newSet.delete(stationId);
    } else {
      newSet.add(stationId);
    }
    setSelectedStations(newSet);
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          Submit to Radio Stations
        </CardTitle>
        <CardDescription>
          Submit your song to multiple eligible radio stations at once
        </CardDescription>
        
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {s}
              </div>
              {s < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Step 1: Select Song */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Step 1: Select a Song</h3>
            {songsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : songs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No recorded songs available. Record a song first!
              </p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {songs.map((song) => (
                    <div
                      key={song.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSong?.id === song.id 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedSong(song)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Music className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{song.title}</p>
                            <p className="text-sm text-muted-foreground">{song.genre}</p>
                          </div>
                        </div>
                        <Badge variant="outline">Quality: {song.quality_score || 0}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button 
              onClick={() => setStep(2)} 
              disabled={!selectedSong}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Select Stations */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Step 2: Select Stations</h3>
              {isVip ? (
                <Button variant="default" size="sm" onClick={handleSelectAllEligible} className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600">
                  <Crown className="mr-2 h-4 w-4" />
                  Select All Eligible ({eligibleCount})
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled className="opacity-60">
                    <Lock className="mr-2 h-3 w-3" />
                    Select All (VIP)
                  </Button>
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                    <Crown className="mr-1 h-3 w-3" /> VIP Feature
                  </Badge>
                </div>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Submitting: <span className="font-medium">{selectedSong?.title}</span> ({selectedSong?.genre})
            </div>

            {stationsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {eligibleStations.map((station) => (
                    <div
                      key={station.id}
                      className={`p-3 rounded-lg border ${
                        station.isEligible 
                          ? 'border-border' 
                          : 'border-border/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedStations.has(station.id)}
                          onCheckedChange={() => station.isEligible && toggleStation(station.id)}
                          disabled={!station.isEligible}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{station.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {station.station_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {station.country}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {formatNumber(station.listener_base)}
                            </span>
                            {station.min_fans_required > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" /> {station.min_fans_required}+ fans
                              </span>
                            )}
                          </div>
                          {!station.isEligible && (
                            <p className="text-xs text-destructive mt-1">
                              <XCircle className="h-3 w-3 inline mr-1" />
                              {station.eligibilityReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button 
                onClick={() => setStep(3)} 
                disabled={selectedStations.size === 0}
                className="flex-1"
              >
                Review ({selectedStations.size} stations)
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Step 3: Review & Submit</h3>
            
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p><strong>Song:</strong> {selectedSong?.title}</p>
              <p><strong>Genre:</strong> {selectedSong?.genre}</p>
              <p><strong>Quality:</strong> {selectedSong?.quality_score || 0}</p>
              <p><strong>Stations:</strong> {selectedStations.size}</p>
            </div>

            <div className="p-3 bg-primary/10 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Songs meeting quality thresholds will be auto-accepted. Others will be reviewed.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button 
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? "Submitting..." : `Submit to ${selectedStations.size} Stations`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Submission Complete!
            </h3>

            <div className="space-y-3">
              {submissionResults.accepted.length > 0 && (
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <p className="font-medium text-green-700 dark:text-green-400">
                    ✓ Auto-Accepted ({submissionResults.accepted.length})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {submissionResults.accepted.join(", ")}
                  </p>
                </div>
              )}

              {submissionResults.pending.length > 0 && (
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">
                    ⏳ Pending Review ({submissionResults.pending.length})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {submissionResults.pending.join(", ")}
                  </p>
                </div>
              )}

              {submissionResults.failed.length > 0 && (
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <p className="font-medium text-red-700 dark:text-red-400">
                    ✗ Failed ({submissionResults.failed.length})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {submissionResults.failed.join(", ")}
                  </p>
                </div>
              )}
            </div>

            <Button onClick={onComplete || (() => setStep(1))} className="w-full">
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
