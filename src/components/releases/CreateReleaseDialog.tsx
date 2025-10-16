import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const [ownerType, setOwnerType] = useState<"solo" | "band">("solo");
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<any[]>([]);

  const queryClient = useQueryClient();

  const createRelease = useMutation({
    mutationFn: async () => {
      // Calculate total cost
      const totalCost = selectedFormats.reduce((sum, format) => sum + format.manufacturing_cost, 0);

      // Check band balance if band release
      if (ownerType === "band" && selectedBandId) {
        const { data: band } = await supabase
          .from("bands")
          .select("band_balance")
          .eq("id", selectedBandId)
          .single();

        if (!band || (band.band_balance || 0) < totalCost) {
          throw new Error("Insufficient band balance for this release");
        }

        // Deduct from band balance
        const newBalance = (band.band_balance || 0) - totalCost;
        await supabase
          .from("bands")
          .update({ band_balance: newBalance })
          .eq("id", selectedBandId);

        // Record expense
        await supabase.from("band_earnings").insert({
          band_id: selectedBandId,
          amount: -totalCost,
          source: "release",
          description: `Release manufacturing: ${title}`,
          earned_by_user_id: userId,
          metadata: { release_type: releaseType, formats: selectedFormats.map(f => f.format_type) }
        });
      }

      // Create release
      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .insert({
          user_id: ownerType === "solo" ? userId : null,
          band_id: ownerType === "band" ? selectedBandId : null,
          release_type: releaseType,
          title,
          artist_name: artistName,
          release_status: "manufacturing",
          total_cost: totalCost
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      if (ownerType === "band" && selectedBandId) {
        queryClient.invalidateQueries({ queryKey: ["band", selectedBandId] });
        queryClient.invalidateQueries({ queryKey: ["band-earnings"] });
      }
      toast({ title: "Success", description: "Release created successfully!" });
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
    setOwnerType("solo");
    setSelectedBandId(null);
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
                placeholder="Enter artist name"
              />
            </div>

            <div className="space-y-2">
              <Label>Release As</Label>
              <RadioGroup value={ownerType} onValueChange={(v: any) => setOwnerType(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="solo" id="solo" />
                  <Label htmlFor="solo">Solo Artist</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="band" id="band" />
                  <Label htmlFor="band">Band</Label>
                </div>
              </RadioGroup>
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
            ownerType={ownerType}
            selectedBandId={selectedBandId}
            onBandChange={setSelectedBandId}
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
