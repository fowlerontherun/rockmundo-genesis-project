import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Guitar, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";

interface LuthieryInstrumentOption {
  player_equipment_id: string;
  instrument_name: string;
  instrument_kind: "electric_guitar" | "electric_bass";
  maker_name: string;
  shape_name: string;
  colour: string;
  final_quality: number;
  condition: number;
  is_equipped: boolean;
  material_snapshot: Array<{ materialName?: string }>;
}

interface GigLuthieryLoadout {
  id: string;
  player_equipment_id: string | null;
  equipment_role: string;
  quality_score: number | null;
  condition_score: number | null;
  reliability_score: number | null;
  luthiery_snapshot: {
    instrumentName?: string;
    instrumentKind?: string;
    makerName?: string;
    shapeName?: string;
    colour?: string;
    finalQuality?: number;
    materialSnapshot?: Array<{ materialName?: string }>;
  } | null;
}

const friendlyError = (error: unknown) => {
  const message = String((error as any)?.message ?? error ?? "");
  if (message.includes("gig_luthiery_instrument_not_equipped")) {
    return "Equip this crafted instrument in Personal Gear before assigning it to the show.";
  }
  if (message.includes("gig_luthiery_instrument_schedule_conflict")) {
    return "This instrument is already committed to another gig within four hours of this show.";
  }
  if (message.includes("gig_luthiery_band_membership_required")) {
    return "Only the active character performing with this band can assign their instrument.";
  }
  if (message.includes("gig_luthiery_gig_locked")) {
    return "This show's equipment is already locked.";
  }
  return message || "Could not update the crafted instrument for this gig.";
};

export function LuthieryGigLoadoutCard({ gigId, locked }: { gigId: string; locked: boolean }) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");

  const instrumentsQuery = useQuery({
    queryKey: ["gig-luthiery-options", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_owned_luthiery_equipment_details", {
        p_profile_id: profileId,
      });
      if (error) throw error;
      return (data ?? []) as LuthieryInstrumentOption[];
    },
  });

  const loadoutQuery = useQuery({
    queryKey: ["gig-luthiery-loadout", gigId, profileId],
    enabled: !!gigId && !!profileId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gig_equipment_loadouts")
        .select("id,player_equipment_id,equipment_role,quality_score,condition_score,reliability_score,luthiery_snapshot")
        .eq("gig_id", gigId)
        .eq("assigned_profile_id", profileId)
        .eq("source_type", "member_owned")
        .not("luthiery_snapshot", "is", null)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as GigLuthieryLoadout | null;
    },
  });

  useEffect(() => {
    setSelectedId(loadoutQuery.data?.player_equipment_id ?? "");
  }, [loadoutQuery.data?.player_equipment_id]);

  const equippedOptions = useMemo(
    () => (instrumentsQuery.data ?? []).filter((item) => item.is_equipped),
    [instrumentsQuery.data],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["gig-luthiery-loadout", gigId, profileId] }),
      queryClient.invalidateQueries({ queryKey: ["gig-live-setup", gigId] }),
      queryClient.invalidateQueries({ queryKey: ["gig-experience", gigId] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (playerEquipmentId: string) => {
      const { data, error } = await (supabase as any).rpc("save_gig_member_luthiery_loadout", {
        p_gig_id: gigId,
        p_player_equipment_id: playerEquipmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Crafted instrument assigned", description: "Its current quality and condition are snapshotted for this gig." });
    },
    onError: (error) => toast({ title: "Could not assign instrument", description: friendlyError(error), variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("remove_gig_member_luthiery_loadout", { p_gig_id: gigId });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSelectedId("");
      await invalidate();
      toast({ title: "Crafted instrument removed from gig" });
    },
    onError: (error) => toast({ title: "Could not remove instrument", description: friendlyError(error), variant: "destructive" }),
  });

  const snapshot = loadoutQuery.data?.luthiery_snapshot;
  const materials = Array.isArray(snapshot?.materialSnapshot)
    ? snapshot!.materialSnapshot!.map((entry) => entry.materialName).filter(Boolean)
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Guitar className="h-4 w-4" />Player-crafted instrument</CardTitle>
        <CardDescription>
          Choose the equipped guitar or bass this character will take on stage. Craft stats affect the musician-role bonus once; readiness separately uses the snapshotted quality and condition.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {instrumentsQuery.isLoading || loadoutQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading crafted instruments…</p>
        ) : equippedOptions.length === 0 && !snapshot ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No equipped player-crafted guitar or bass is available. Equip one from Personal Gear first.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedId} onValueChange={setSelectedId} disabled={locked || saveMutation.isPending}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Choose an equipped crafted instrument" /></SelectTrigger>
                <SelectContent>
                  {equippedOptions.map((item) => (
                    <SelectItem key={item.player_equipment_id} value={item.player_equipment_id}>
                      {item.instrument_name} · {item.instrument_kind === "electric_bass" ? "Bass" : "Guitar"} · Q{item.final_quality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={locked || !selectedId || selectedId === loadoutQuery.data?.player_equipment_id || saveMutation.isPending}
                onClick={() => saveMutation.mutate(selectedId)}
              >
                {saveMutation.isPending ? "Assigning…" : "Use for gig"}
              </Button>
              {snapshot && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={locked || removeMutation.isPending}
                  onClick={() => removeMutation.mutate()}
                  aria-label="Remove crafted instrument from gig"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {snapshot && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    {snapshot.instrumentName}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Quality {loadoutQuery.data?.quality_score ?? snapshot.finalQuality ?? 0}</Badge>
                    <Badge variant="secondary">Condition {loadoutQuery.data?.condition_score ?? 100}%</Badge>
                  </div>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Maker: <strong className="text-foreground">{snapshot.makerName ?? "Unknown"}</strong></span>
                  <span>Shape: <strong className="text-foreground">{snapshot.shapeName ?? "Custom"}</strong></span>
                  <span className="flex items-center gap-1.5">
                    Colour:
                    <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: snapshot.colour ?? "#8b5a2b" }} />
                    <strong className="text-foreground">{snapshot.colour ?? "Custom"}</strong>
                  </span>
                  <span>Reliability: <strong className="text-foreground">{loadoutQuery.data?.reliability_score ?? 0}/100</strong></span>
                </div>
                {materials.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Materials: {materials.join(" · ")}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
