import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ReleaseTypeSelector, ReleaseType } from "./ReleaseTypeSelector";
import { SongSelectionStep, SongSelection } from "./SongSelectionStep";
import { FormatSelectionStep } from "./FormatSelectionStep";
import { StreamingDistributionStep } from "./StreamingDistributionStep";
import { logGameActivity } from "@/hooks/useGameActivityLog";
import { Loader2, AlertTriangle } from "lucide-react";
import { addDays, isBefore } from "date-fns";

interface CreateReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

// Manufacturing days by format type
const MANUFACTURING_DAYS: Record<string, number> = {
  vinyl: 14,
  cd: 7,
  cassette: 5,
  digital: 2,
  streaming: 2,
};

export function CreateReleaseDialog({ open, onOpenChange, userId }: CreateReleaseDialogProps) {
  const [step, setStep] = useState(1);
  const [releaseType, setReleaseType] = useState<ReleaseType>("single");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<SongSelection[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<any[]>([]);
  const [selectedStreamingPlatforms, setSelectedStreamingPlatforms] = useState<string[]>([]);
  const [scheduledReleaseDate, setScheduledReleaseDate] = useState<Date | null>(null);
  const [revenueShareEnabled, setRevenueShareEnabled] = useState(false);

  const queryClient = useQueryClient();

  // Auto-detect user's active band
  const { data: userBand } = useQuery({
    queryKey: ["user-active-band", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(*)")
        .eq("user_id", userId)
        .limit(1)
        .single();
      return data?.bands || null;
    }
  });

  // Check greatest hits eligibility
  const { data: greatestHitsEligibility } = useQuery({
    queryKey: ["greatest-hits-eligibility", userId, userBand?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_greatest_hits_eligibility", {
        p_band_id: userBand?.id || null,
        p_user_id: userBand ? null : userId
      });
      if (error) {
        console.error("Error checking greatest hits eligibility:", error);
        return { eligible: false, reason: "Error checking eligibility" };
      }
      return data as { eligible: boolean; released_song_count: number; reason: string | null };
    },
    enabled: !!userId
  });

  // Auto-set artist name when band is detected
  useEffect(() => {
    if (userBand && !artistName) {
      setArtistName(userBand.name);
    }
  }, [userBand, artistName]);

  // Calculate manufacturing completion date
  const getManufacturingCompleteDate = () => {
    if (selectedFormats.length === 0) return addDays(new Date(), 2);
    const maxDays = Math.max(
      ...selectedFormats.map(f => MANUFACTURING_DAYS[f.format_type] || 2)
    );
    return addDays(new Date(), maxDays);
  };

  const manufacturingCompleteDate = getManufacturingCompleteDate();
  const isScheduledTooEarly = scheduledReleaseDate && isBefore(scheduledReleaseDate, manufacturingCompleteDate);

  const createRelease = useMutation({
    mutationFn: async () => {
      // Calculate total cost and manufacturing time (2-14 days based on format complexity)
      const totalCost = selectedFormats.reduce((sum, format) => sum + format.manufacturing_cost, 0);
      
      const manufacturingDays = selectedFormats.reduce((max, format) => {
        const days = MANUFACTURING_DAYS[format.format_type] || 2;
        return Math.max(max, days);
      }, 2);
      
      const manufacturingCompleteAt = new Date();
      manufacturingCompleteAt.setDate(manufacturingCompleteAt.getDate() + manufacturingDays);

      // Check band balance if band release
      if (userBand) {
        const { data: band } = await supabase
          .from("bands")
          .select("band_balance")
          .eq("id", userBand.id)
          .single();

        if (!band || (band.band_balance || 0) < totalCost) {
          throw new Error("Insufficient band balance for this release");
        }

        // Deduct from band balance
        const newBalance = (band.band_balance || 0) - totalCost;
        await supabase
          .from("bands")
          .update({ band_balance: newBalance })
          .eq("id", userBand.id);

        // Record expense
        await supabase.from("band_earnings").insert({
          band_id: userBand.id,
          amount: -totalCost,
          source: "release",
          description: `Release manufacturing: ${title}`,
          earned_by_user_id: userId,
          metadata: { release_type: releaseType, formats: selectedFormats.map(f => f.format_type) }
        });
      }

      // Create release with manufacturing timeline and streaming platforms
      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .insert({
          user_id: userBand ? null : userId,
          band_id: userBand?.id || null,
          release_type: releaseType === "greatest_hits" ? "album" : releaseType,
          title,
          artist_name: artistName,
          release_status: "manufacturing",
          total_cost: totalCost,
          manufacturing_complete_at: manufacturingCompleteAt.toISOString(),
          scheduled_release_date: scheduledReleaseDate?.toISOString().split('T')[0] || null,
          streaming_platforms: selectedStreamingPlatforms.length > 0 ? selectedStreamingPlatforms : null,
          is_greatest_hits: releaseType === "greatest_hits",
          revenue_share_enabled: revenueShareEnabled,
          revenue_share_percentage: revenueShareEnabled ? 10 : null,
          manufacturing_discount_percentage: revenueShareEnabled ? 50 : null,
        })
        .select()
        .single();

      if (releaseError) throw releaseError;

      // Update last_greatest_hits_date if this is a greatest hits album
      if (releaseType === "greatest_hits" && userBand?.id) {
        await supabase
          .from("releases")
          .update({ last_greatest_hits_date: new Date().toISOString() })
          .eq("id", release.id);
      }

      // Add songs with their recording versions - use actual song UUIDs
      const songInserts = selectedSongs.map((song, index) => ({
        release_id: release.id,
        song_id: song.songId,
        track_number: index + 1,
        is_b_side: releaseType === "single" && index === 1,
        recording_version: song.version,
        // Track album exclusivity - only for regular albums, not greatest hits
        album_release_id: releaseType === "album" ? release.id : null
      }));

      const { error: songsError } = await supabase
        .from("release_songs")
        .insert(songInserts);

      if (songsError) throw songsError;

      // Add formats
      const formatInserts = selectedFormats.map(format => ({
        release_id: release.id,
        ...format
      }));

      const { error: formatsError } = await supabase
        .from("release_formats")
        .insert(formatInserts);

      if (formatsError) throw formatsError;

      // Log release creation activity
      logGameActivity({
        userId,
        bandId: userBand?.id,
        activityType: 'release_created',
        activityCategory: 'release',
        description: `Created ${releaseType === "greatest_hits" ? "Greatest Hits" : releaseType} release "${title}" - Manufacturing in progress`,
        amount: -totalCost,
        metadata: {
          releaseId: release.id,
          releaseType,
          title,
          artistName,
          formats: selectedFormats.map(f => f.format_type),
          songCount: selectedSongs.length,
          manufacturingDays,
          streamingPlatforms: selectedStreamingPlatforms,
          revenueShareEnabled
        }
      });

      return release;
    },
    onSuccess: (release) => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      if (userBand) {
        queryClient.invalidateQueries({ queryKey: ["band", userBand.id] });
        queryClient.invalidateQueries({ queryKey: ["band-earnings"] });
      }
      
      const manufacturingDays = Math.ceil(
        (new Date(release.manufacturing_complete_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      toast({ 
        title: "Release Created!", 
        description: `Manufacturing will complete in ${manufacturingDays} days. ${
          release.scheduled_release_date 
            ? `Release scheduled for ${new Date(release.scheduled_release_date).toLocaleDateString()}.` 
            : ''
        }`
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setStep(1);
    setReleaseType("single");
    setTitle("");
    setArtistName("");
    setSelectedSongs([]);
    setSelectedFormats([]);
    setSelectedStreamingPlatforms([]);
    setScheduledReleaseDate(null);
    setRevenueShareEnabled(false);
  };

  const handleNext = () => {
    if (step === 1 && (!title || !artistName)) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (step === 2 && selectedSongs.length === 0) {
      toast({ title: "Error", description: "Please select songs", variant: "destructive" });
      return;
    }
    if (step === 3 && selectedFormats.length === 0) {
      toast({ title: "Error", description: "Please select at least one format", variant: "destructive" });
      return;
    }
    if (step < 4) {
      setStep(step + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Release - Step {step} of 4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <ReleaseTypeSelector 
              value={releaseType} 
              onChange={setReleaseType}
              greatestHitsEligible={greatestHitsEligibility?.eligible || false}
              greatestHitsReason={greatestHitsEligibility?.reason}
            />
            
            <div className="space-y-2">
              <Label>Release Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter release title"
              />
            </div>

            <div className="space-y-2">
              <Label>Artist Name</Label>
              <Input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder={userBand ? userBand.name : "Enter artist name"}
                disabled={!!userBand}
              />
              {userBand && (
                <p className="text-xs text-muted-foreground">
                  Releasing as {userBand.name}
                </p>
              )}
            </div>

            <Button onClick={handleNext} className="w-full">Next: Select Songs</Button>
          </div>
        )}

        {step === 2 && (
          <SongSelectionStep
            userId={userId}
            releaseType={releaseType}
            selectedSongs={selectedSongs}
            onSongsChange={setSelectedSongs}
            bandId={userBand?.id || null}
            onBack={() => setStep(1)}
            onNext={handleNext}
          />
        )}

        {step === 3 && (
          <FormatSelectionStep
            selectedFormats={selectedFormats}
            onFormatsChange={setSelectedFormats}
            onBack={() => setStep(2)}
            onSubmit={handleNext}
            isLoading={false}
            revenueShareEnabled={revenueShareEnabled}
            onRevenueShareChange={setRevenueShareEnabled}
            scheduledReleaseDate={scheduledReleaseDate}
            bandId={userBand?.id}
            songCount={selectedSongs.length}
          />
        )}

        {step === 4 && (
          <div className="space-y-4">
            {isScheduledTooEarly && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Warning: Your release may be delayed because manufacturing won't complete until the scheduled date.
                </AlertDescription>
              </Alert>
            )}
            
            <StreamingDistributionStep
              selectedPlatforms={selectedStreamingPlatforms}
              onPlatformsChange={setSelectedStreamingPlatforms}
              onBack={() => setStep(3)}
              onSubmit={() => createRelease.mutate()}
              isLoading={createRelease.isPending}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
