import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ReleaseTypeSelector } from "./ReleaseTypeSelector";
import { SongSelectionStep } from "./SongSelectionStep";
import { FormatSelectionStep } from "./FormatSelectionStep";

interface CreateReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function CreateReleaseDialog({ open, onOpenChange, userId }: CreateReleaseDialogProps) {
  const [step, setStep] = useState(1);
  const [releaseType, setReleaseType] = useState<"single" | "ep" | "album">("single");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<any[]>([]);
  const [scheduledReleaseDate, setScheduledReleaseDate] = useState<Date | null>(null);

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

  // Auto-set artist name when band is detected
  useEffect(() => {
    if (userBand && !artistName) {
      setArtistName(userBand.name);
    }
  }, [userBand, artistName]);

  const createRelease = useMutation({
    mutationFn: async () => {
      // Calculate total cost and manufacturing time (2-14 days based on format complexity)
      const totalCost = selectedFormats.reduce((sum, format) => sum + format.manufacturing_cost, 0);
      
      const manufacturingDays = selectedFormats.reduce((max, format) => {
        const days = format.format_type === 'vinyl' ? 14 : 
                     format.format_type === 'cd' ? 7 : 
                     format.format_type === 'cassette' ? 5 : 2;
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

      // Create release with manufacturing timeline
      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .insert({
          user_id: userBand ? null : userId,
          band_id: userBand?.id || null,
          release_type: releaseType,
          title,
          artist_name: artistName,
          release_status: "manufacturing",
          total_cost: totalCost,
          manufacturing_complete_at: manufacturingCompleteAt.toISOString(),
          scheduled_release_date: scheduledReleaseDate?.toISOString().split('T')[0] || null
        })
        .select()
        .single();

      if (releaseError) throw releaseError;

      // Add songs
      const songInserts = selectedSongs.map((songId, index) => ({
        release_id: release.id,
        song_id: songId,
        track_number: index + 1,
        is_b_side: releaseType === "single" && index === 1
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
    setStep(step + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Release - Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <ReleaseTypeSelector value={releaseType} onChange={setReleaseType} />
            
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
            onSubmit={() => createRelease.mutate()}
            isLoading={createRelease.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
