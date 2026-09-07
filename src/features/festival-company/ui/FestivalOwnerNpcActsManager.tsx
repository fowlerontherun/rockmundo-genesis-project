import { useEffect, useState } from "react";
import { Bot, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  type FestivalOwnerNpcAct,
  useCancelFestivalOwnerNpcAct,
  useFestivalOwnerNpcActs,
  useUpsertFestivalOwnerNpcAct,
} from "../application/useFestivalOwnerNpcActs";

type Stage = { id: string; name: string };
type Draft = {
  id: string | null;
  displayName: string;
  genre: string;
  fame: string;
  setMinutes: string;
  festivalDate: string;
  stageId: string;
  billingPosition: FestivalOwnerNpcAct["billingPosition"];
};

const emptyDraft = (festivalDates: string[]): Draft => ({
  id: null,
  displayName: "",
  genre: "",
  fame: "25",
  setMinutes: "45",
  festivalDate: festivalDates[0] ?? "",
  stageId: "auto",
  billingPosition: "support",
});

export function FestivalOwnerNpcActsManager({
  festivalCompanyId,
  festivalEditionId,
  festivalDates,
  stages,
}: {
  festivalCompanyId: string;
  festivalEditionId: string;
  festivalDates: string[];
  stages: Stage[];
}) {
  const query = useFestivalOwnerNpcActs(festivalCompanyId, festivalEditionId);
  const save = useUpsertFestivalOwnerNpcAct();
  const cancel = useCancelFestivalOwnerNpcAct();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(festivalDates));

  useEffect(() => {
    if (!draft.festivalDate && festivalDates[0]) {
      setDraft((current) => ({ ...current, festivalDate: festivalDates[0] }));
    }
  }, [draft.festivalDate, festivalDates]);

  const editing = Boolean(draft.id);
  const reset = () => setDraft(emptyDraft(festivalDates));

  const edit = (act: FestivalOwnerNpcAct) => setDraft({
    id: act.id,
    displayName: act.displayName,
    genre: act.genre ?? "",
    fame: String(act.fame),
    setMinutes: String(act.setMinutes),
    festivalDate: act.festivalDate,
    stageId: act.stageId ?? "auto",
    billingPosition: act.billingPosition,
  });

  const submit = () => {
    const fame = Number(draft.fame);
    const setMinutes = Number(draft.setMinutes);
    if (!draft.displayName.trim() || !draft.festivalDate || !Number.isInteger(fame) || !Number.isInteger(setMinutes)) {
      toast.error("Give the NPC act a name, Festival date, fame and set length.");
      return;
    }

    save.mutate({
      festivalCompanyId,
      festivalEditionId,
      npcActId: draft.id,
      displayName: draft.displayName.trim(),
      genre: draft.genre.trim() || null,
      fame,
      setMinutes,
      festivalDate: draft.festivalDate,
      stageId: draft.stageId === "auto" ? null : draft.stageId,
      billingPosition: draft.billingPosition,
    }, {
      onSuccess: () => {
        toast.success(editing ? "NPC act updated." : "NPC act added to the line-up.");
        reset();
      },
      onError: (error) => toast.error(
        error instanceof Error && error.message.includes("festival_npc_lineup_locked")
          ? "This Festival has finished, so its NPC line-up is locked."
          : "The NPC act could not be saved.",
      ),
    });
  };

  const activeActs = (query.data ?? []).filter((act) => act.status === "confirmed");

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> NPC acts</CardTitle>
        <CardDescription>
          Add or update game-controlled acts at any point after approval or launch. Player artist contracts are not changed by these edits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="festival-npc-name">Act name</Label>
            <Input id="festival-npc-name" value={draft.displayName} onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} placeholder="The Midnight Static" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="festival-npc-genre">Genre</Label>
            <Input id="festival-npc-genre" value={draft.genre} onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))} placeholder="Indie rock" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="festival-npc-fame">Fame</Label>
            <Input id="festival-npc-fame" type="number" min={0} value={draft.fame} onChange={(e) => setDraft((d) => ({ ...d, fame: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Festival date</Label>
            <Select value={draft.festivalDate} onValueChange={(value) => setDraft((d) => ({ ...d, festivalDate: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{festivalDates.map((date) => <SelectItem key={date} value={date}>{date}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={draft.stageId} onValueChange={(value) => setDraft((d) => ({ ...d, stageId: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatic stage</SelectItem>
                {stages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Billing</Label>
            <Select value={draft.billingPosition} onValueChange={(value: FestivalOwnerNpcAct["billingPosition"]) => setDraft((d) => ({ ...d, billingPosition: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="headliner">Headliner</SelectItem>
                <SelectItem value="sub_headliner">Sub-headliner</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="special_guest">Special guest</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="emerging">Emerging</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="festival-npc-set">Set minutes</Label>
            <Input id="festival-npc-set" type="number" min={10} max={240} value={draft.setMinutes} onChange={(e) => setDraft((d) => ({ ...d, setMinutes: e.target.value }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={save.isPending}>
            {editing ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {save.isPending ? "Saving…" : editing ? "Update NPC act" : "Add NPC act"}
          </Button>
          {editing ? <Button variant="outline" onClick={reset}>Cancel edit</Button> : null}
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading NPC acts…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">NPC acts could not be loaded.</p> : null}
        {activeActs.length ? (
          <div className="space-y-2">
            {activeActs.map((act) => (
              <div key={act.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{act.displayName}</strong>
                    <Badge variant="secondary">NPC</Badge>
                    <Badge variant="outline" className="capitalize">{act.billingPosition.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {act.festivalDate} · {act.setMinutes} min · Fame {act.fame}{act.genre ? ` · ${act.genre}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => edit(act)} disabled={save.isPending || cancel.isPending}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={save.isPending || cancel.isPending}
                    onClick={() => cancel.mutate({ festivalCompanyId, festivalEditionId, npcActId: act.id }, {
                      onSuccess: () => toast.success("NPC act removed from the line-up."),
                      onError: () => toast.error("The NPC act could not be removed."),
                    })}
                  >
                    <X className="mr-1 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : !query.isLoading ? (
          <p className="text-sm text-muted-foreground">No owner-selected NPC acts yet. Automatic NPC fallback can still fill remaining spaces.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
