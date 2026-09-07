import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Disc3, Image as ImageIcon, Music, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FestivalScheduleWorkspace } from "@/features/festivals/scheduling/components/FestivalScheduleWorkspace";
import { fetchFestivalArtistScheduleQueue } from "@/features/festivals/admin/lifecycleB5";

type Workspace = {
  festivalEditionId: string;
  canonicalEditionId: string | null;
  posterUrl: string | null;
  posterStatus: string | null;
  posterVersion: number | null;
  canSchedule: boolean;
};

const rpc = supabase.rpc.bind(supabase) as any;

export function FestivalOwnerLineupControls({
  festivalCompanyId,
  festivalEditionId,
}: {
  festivalCompanyId: string;
  festivalEditionId: string;
}) {
  const qc = useQueryClient();
  const [slotId, setSlotId] = useState("");
  const [actType, setActType] = useState("npc_band");
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [quality, setQuality] = useState("55");

  const workspace = useQuery({
    queryKey: ["festival-owner-lineup-workspace", festivalCompanyId, festivalEditionId],
    queryFn: async () => {
      const { data, error } = await rpc("get_festival_owner_lineup_workspace", {
        p_festival_company_id: festivalCompanyId,
        p_festival_edition_id: festivalEditionId,
      });
      if (error) throw error;
      return data as Workspace;
    },
  });

  const canonicalEditionId = workspace.data?.canonicalEditionId ?? null;
  const schedule = useQuery({
    queryKey: ["festivals", "artist-schedule-queue", canonicalEditionId],
    queryFn: () => fetchFestivalArtistScheduleQueue(canonicalEditionId ?? ""),
    enabled: Boolean(canonicalEditionId),
  });

  const systemAct = useMutation({
    mutationFn: async (input: { stageSlotId: string; enabled: boolean; actType?: string }) => {
      const { data, error } = await rpc("set_festival_owner_system_act", {
        p_festival_company_id: festivalCompanyId,
        p_festival_edition_id: festivalEditionId,
        p_stage_slot_id: input.stageSlotId,
        p_enabled: input.enabled,
        p_act_type: input.actType ?? actType,
        p_name: input.enabled ? name || null : null,
        p_genre: input.enabled ? genre || null : null,
        p_quality: Number(quality) || 55,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, variables) => {
      await qc.invalidateQueries({ queryKey: ["festivals", "artist-schedule-queue", canonicalEditionId] });
      await qc.invalidateQueries({ queryKey: ["festival-schedule", canonicalEditionId] });
      setSlotId("");
      if (variables.enabled) {
        setName("");
        setGenre("");
        setQuality("55");
        toast.success(variables.actType === "dj" ? "NPC DJ added to the lineup" : "NPC band added to the lineup");
      } else {
        toast.success("NPC act removed from the lineup");
      }
    },
    onError: () => toast.error("The NPC act could not be changed. Refresh the running order and retry."),
  });

  if (workspace.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading stage controls…</CardContent></Card>;
  }

  if (workspace.isError || !workspace.data) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Festival stage controls could not be loaded.</CardContent></Card>;
  }

  if (!canonicalEditionId || !workspace.data.canSchedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stage timetable not connected</CardTitle>
          <CardDescription>
            This annual Festival has no canonical timetable bridge yet. Complete the annual plan/stage generation before setting running order times.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const emptySlots = schedule.data?.slots ?? [];
  const npcActs = (schedule.data?.lineup ?? []).filter((item) => item.isNpcDj);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Line-up poster</CardTitle>
          <CardDescription>
            The latest edition-scoped poster is shown here so the artwork is visible from the Festival owner workflow rather than being hidden in legacy Festival data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspace.data.posterUrl ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_1fr] md:items-start">
              <img src={workspace.data.posterUrl} alt="Festival lineup poster" className="w-full rounded-lg border object-cover shadow-sm" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="capitalize">{workspace.data.posterStatus ?? "generated"}</Badge>
                <p>Poster version {workspace.data.posterVersion ?? "—"}. This is the canonical edition poster.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No edition poster has been generated yet. The live bill above remains visible, and any generated canonical poster will appear here automatically.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> NPC bands & DJs</CardTitle>
          <CardDescription>
            Fill empty stage slots with NPC bands, guest acts or DJs. These are persisted as audited Festival system acts and appear in the running order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_1fr_1fr_7rem_auto] lg:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium">Empty stage slot</label>
              <Select value={slotId} onValueChange={setSlotId} disabled={systemAct.isPending}>
                <SelectTrigger><SelectValue placeholder="Choose stage and time" /></SelectTrigger>
                <SelectContent>
                  {emptySlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      Day {slot.dayNumber} · {slot.stageName} · {new Date(slot.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Act type</label>
              <Select value={actType} onValueChange={setActType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="npc_band">NPC band</SelectItem>
                  <SelectItem value="guest_act">Guest act</SelectItem>
                  <SelectItem value="dj">DJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={actType === "dj" ? "DJ name" : "Band / act name"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Genre</label>
              <Input value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="Rock, indie, house…" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Quality</label>
              <Input type="number" min={0} max={100} value={quality} onChange={(event) => setQuality(event.target.value)} />
            </div>
            <Button disabled={!slotId || systemAct.isPending} onClick={() => systemAct.mutate({ stageSlotId: slotId, enabled: true, actType })}>
              {actType === "dj" ? <Disc3 className="mr-2 h-4 w-4" /> : <Music className="mr-2 h-4 w-4" />}
              Add act
            </Button>
          </div>

          {npcActs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">NPC/system acts already scheduled</p>
              {npcActs.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <strong>{item.npcDjName ?? "Festival act"}</strong>
                    <p className="text-xs text-muted-foreground">Day {item.dayNumber} · {item.stageName} · {new Date(item.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {item.npcDjGenre ?? "Open format"}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={systemAct.isPending} onClick={() => systemAct.mutate({ stageSlotId: item.id, enabled: false, actType: "npc_band" })}>Remove</Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-label="Festival stage times and running order">
        <div>
          <h2 className="text-2xl font-bold">Stage times & running order</h2>
          <p className="text-sm text-muted-foreground">
            Set stage operating hours, create or edit performance slots, allocate accepted bands, move acts into order, resolve conflicts and publish the timetable.
          </p>
        </div>
        <FestivalScheduleWorkspace editionId={canonicalEditionId} />
      </section>
    </div>
  );
}
