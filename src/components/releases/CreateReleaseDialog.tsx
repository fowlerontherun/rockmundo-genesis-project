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
import { TerritorySelectionStep, TerritorySelection } from "./TerritorySelectionStep";
import { StreamingDistributionStep } from "./StreamingDistributionStep";
import { logGameActivity } from "@/hooks/useGameActivityLog";
import { Loader2, AlertTriangle, Building2, BadgeCheck } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { addDays, isBefore } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { minorToMajor } from "@/lib/releaseMoney";

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
  const [selectedTerritories, setSelectedTerritories] = useState<TerritorySelection[]>([]);
  const [selectedStreamingPlatforms, setSelectedStreamingPlatforms] = useState<string[]>([]);
  const [scheduledReleaseDate, setScheduledReleaseDate] = useState<Date | null>(null);
  const [revenueShareEnabled, setRevenueShareEnabled] = useState(false);

  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  // Auto-detect user's active band
  const { data: userBand } = useQuery({
    queryKey: ["user-active-band", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(*)")
        .eq("profile_id", profileId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.bands || null;
    },
    enabled: !!profileId,
  });

  // Get band's home country & region from home city
  const { data: bandHomeInfo } = useQuery({
    queryKey: ["band-home-info", userBand?.id],
    queryFn: async () => {
      if (!userBand?.home_city_id) return null;
      const { data, error } = await supabase
        .from("cities")
        .select("country, region")
        .eq("id", userBand.home_city_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userBand?.home_city_id,
  });

  // ── Fetch active label contract for this band/artist ──
  const { data: activeContract } = useQuery({
    queryKey: ["active-label-contract", userBand?.id, userId],
    queryFn: async () => {
      const filters: string[] = [];
      
      if (userBand?.id) {
        filters.push(`band_id.eq.${userBand.id}`);
      }
      
      if (profileId) {
        filters.push(`artist_profile_id.eq.${profileId}`);
      }

      if (filters.length === 0) return null;

      const { data, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          id,
          label_id,
          royalty_artist_pct,
          royalty_label_pct,
          advance_amount,
          recouped_amount,
          manufacturing_covered,
          marketing_support,
          labels(id, name, reputation_score)
        `)
        .eq("status", "active")
        .or(filters.join(","))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Auto-select home country as territory when bandHomeInfo loads
  useEffect(() => {
    if (bandHomeInfo && selectedTerritories.length === 0) {
      setSelectedTerritories([{
        country: bandHomeInfo.country,
        region: bandHomeInfo.region,
        distanceTier: "domestic",
        costMultiplier: 1.0,
        distributionCost: hasPhysicalFormats ? 1500 : 300,
      }]);
    }
  }, [bandHomeInfo]);

  // Check greatest hits eligibility
  const { data: greatestHitsEligibility } = useQuery({
    queryKey: ["greatest-hits-eligibility", userId, userBand?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_greatest_hits_eligibility", {
        p_band_id: userBand?.id || null,
        p_user_id: userBand ? null : userId
      });
      if (error) throw error;
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

  const hasPhysicalFormats = selectedFormats.some(f => 
    f.format_type === "vinyl" || f.format_type === "cd" || f.format_type === "cassette"
  );

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

  const territoryCostMinor = selectedTerritories.reduce((sum, t) => sum + t.distributionCost, 0);

  const labelCoversManufacturing = activeContract?.manufacturing_covered === true;
  const labelName = (activeContract?.labels as any)?.name;
  const labelCutPct = activeContract ? (activeContract.royalty_label_pct ?? (100 - activeContract.royalty_artist_pct)) : 0;

  const createRelease = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Release title is required");
      if (!artistName.trim()) throw new Error("Artist name is required");
      if (selectedSongs.length === 0) throw new Error("Select at least one recorded song before creating a release");
      if (selectedFormats.length === 0) throw new Error("Select at least one release format");
      if (selectedTerritories.length === 0) throw new Error("Select at least one release territory");

      const manufacturingCostMinor = selectedFormats.reduce((sum, format) => sum + format.manufacturing_cost, 0);
      const totalCostMinor = manufacturingCostMinor + territoryCostMinor;
      const manufacturingDays = selectedFormats.reduce((max, format) => Math.max(max, MANUFACTURING_DAYS[format.format_type] || 2), 2);
      const manufacturingCompleteAt = new Date();
      manufacturingCompleteAt.setDate(manufacturingCompleteAt.getDate() + manufacturingDays);
      const bandPaysMinor = labelCoversManufacturing ? territoryCostMinor : totalCostMinor;
      const labelPaysMinor = labelCoversManufacturing ? manufacturingCostMinor : 0;
      const marketingHypeBonus = activeContract?.marketing_support
        ? Math.min(200, Math.floor((activeContract.marketing_support as number) / 50)) : 0;

      // One PostgreSQL transaction creates every child row, records payer evidence,
      // and moves treasury funds. Any validation/insert failure rolls everything back.
      const { data: releaseId, error: createError } = await (supabase as any).rpc("create_release_with_financing", {
        p_payload: {
          band_id: userBand?.id,
          release_type: releaseType === "greatest_hits" ? "album" : releaseType,
          title: title.trim(), artist_name: artistName.trim(),
          manufacturing_cost_minor: manufacturingCostMinor, territory_cost_minor: territoryCostMinor,
          manufacturing_complete_at: manufacturingCompleteAt.toISOString(),
          scheduled_release_date: scheduledReleaseDate?.toISOString().split("T")[0] || null,
          streaming_platforms: selectedStreamingPlatforms,
          is_greatest_hits: releaseType === "greatest_hits", revenue_share_enabled: revenueShareEnabled,
          revenue_share_percentage: revenueShareEnabled ? 10 : null,
          manufacturing_discount_percentage: revenueShareEnabled ? 50 : null,
          home_country: bandHomeInfo?.country || null, label_contract_id: activeContract?.id || null,
          label_revenue_share_pct: activeContract ? labelCutPct : null, hype_score: marketingHypeBonus || null,
          territories: selectedTerritories.map(t => ({ country: t.country, distance_tier: t.distanceTier, cost_multiplier: t.costMultiplier, distribution_cost: t.distributionCost })),
          songs: selectedSongs.map((song, index) => ({ song_id: song.songId, track_number: index + 1, is_b_side: releaseType === "single" && index === 1, recording_version: song.version })),
          formats: selectedFormats.map(format => ({ ...format, retail_price: Math.round((format.retail_price || 0) * 100), release_date: format.release_date || manufacturingCompleteAt.toISOString() })),
        },
      });
      if (createError) throw createError;
      const { data: release, error: fetchError } = await supabase.from("releases").select("*").eq("id", releaseId).single();
      if (fetchError) throw fetchError;

      logGameActivity({ userId, bandId: userBand?.id, activityType: "release_created", activityCategory: "release",
        description: `Created ${releaseType} release "${title}" - Manufacturing in progress`, amount: -minorToMajor(bandPaysMinor),
        metadata: { releaseId, manufacturingDays, territoryCostMinor, labelCoveredCostMinor: labelPaysMinor } });
      return release;
    },
    onSuccess: (release) => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      if (userBand) {
        queryClient.invalidateQueries({ queryKey: ["band", userBand.id] });
        queryClient.invalidateQueries({ queryKey: ["band-earnings"] });
      }
      if (activeContract) {
        queryClient.invalidateQueries({ queryKey: ["label-contracts"] });
        queryClient.invalidateQueries({ queryKey: ["my-labels"] });
      }
      
      const manufacturingDays = Math.ceil(
        (new Date(release.manufacturing_complete_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      toast({ 
        title: "Release Created!", 
        description: `Manufacturing will complete in ${manufacturingDays} days. Distributing to ${selectedTerritories.length} territories.${
          activeContract ? ` Released under ${labelName}.` : ''
        }${
          release.scheduled_release_date 
            ? ` Release scheduled for ${new Date(release.scheduled_release_date).toLocaleDateString()}.` 
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
    setSelectedTerritories([]);
    setSelectedStreamingPlatforms([]);
    setScheduledReleaseDate(null);
    setRevenueShareEnabled(false);
  };

  const handleNext = () => {
    if (step === 1 && (!title.trim() || !artistName.trim())) {
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
    if (step === 4 && selectedTerritories.length === 0) {
      toast({ title: "Error", description: "Please select at least one territory", variant: "destructive" });
      return;
    }
    if (step < 5) {
      setStep(step + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Release - Step {step} of 5</DialogTitle>
        </DialogHeader>

        {/* Label Contract Banner */}
        {activeContract && (
          <Alert className="border-primary/30 bg-primary/5">
            <Building2 className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <span className="font-medium">Releasing under {labelName}</span>
                <span className="text-muted-foreground ml-2">
                  — {activeContract.royalty_artist_pct}% artist / {labelCutPct}% label royalty split
                </span>
              </div>
              <div className="flex gap-2">
                {labelCoversManufacturing && (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    <BadgeCheck className="h-3 w-3 mr-1" />
                    Label Pays Manufacturing
                  </Badge>
                )}
                {(activeContract.marketing_support as number) > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                    +{Math.min(200, Math.floor((activeContract.marketing_support as number) / 50))} Hype Bonus
                  </Badge>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

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

            <Button onClick={handleNext} disabled={createRelease.isPending} className="w-full">Next: Select Songs</Button>
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
          <TerritorySelectionStep
            selectedTerritories={selectedTerritories}
            onTerritoriesChange={setSelectedTerritories}
            homeCountry={bandHomeInfo?.country || null}
            homeRegion={bandHomeInfo?.region || null}
            isPhysical={hasPhysicalFormats}
            onBack={() => setStep(3)}
            onNext={handleNext}
          />
        )}

        {step === 5 && (
          <div className="space-y-4">
            {isScheduledTooEarly && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Warning: Your release may be delayed because manufacturing won't complete until the scheduled date.
                </AlertDescription>
              </Alert>
            )}

            {/* Cost summary with label benefits */}
            {labelCoversManufacturing && (
              <Alert className="border-emerald-500/30 bg-emerald-500/5">
                <BadgeCheck className="h-4 w-4 text-emerald-500" />
                <AlertDescription>
                  <strong>{labelName}</strong> is covering manufacturing costs (${minorToMajor(selectedFormats.reduce((sum: number, f: any) => sum + f.manufacturing_cost, 0)).toFixed(2)}).
                  You only pay territory distribution setup costs (${minorToMajor(territoryCostMinor).toFixed(2)}).
                </AlertDescription>
              </Alert>
            )}
            
            <StreamingDistributionStep
              selectedPlatforms={selectedStreamingPlatforms}
              onPlatformsChange={setSelectedStreamingPlatforms}
              onBack={() => setStep(4)}
              onSubmit={() => createRelease.mutate()}
              isLoading={createRelease.isPending}
              selectedTerritories={selectedTerritories}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
