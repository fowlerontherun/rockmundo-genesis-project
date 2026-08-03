import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, HeartPulse, Loader2, Search, Skull, Trash2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface AdminCharacterRow {
  profile_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  slot_number: number | null;
  level: number | null;
  fame: number | null;
  cash: number | null;
  health: number | null;
  energy: number | null;
  is_active: boolean | null;
  died_at: string | null;
  death_cause: string | null;
  deleted_at: string | null;
  resurrection_lives: number | null;
  last_login_at: string | null;
  created_at: string | null;
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

const CharacterRecoveryAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [onlyDead, setOnlyDead] = useState(true);

  const [target, setTarget] = useState<AdminCharacterRow | null>(null);
  const [health, setHealth] = useState(75);
  const [energy, setEnergy] = useState(75);
  const [grantLives, setGrantLives] = useState(1);
  const [makeActive, setMakeActive] = useState(true);
  const [reason, setReason] = useState("");

  const { data: characters, isLoading } = useQuery({
    queryKey: ["admin-character-search", search, onlyDead],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_search_characters", {
        p_search: search.trim() === "" ? null : search.trim(),
        p_only_dead: onlyDead,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as AdminCharacterRow[];
    },
  });

  const reviveMutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("No character selected.");
      const { data, error } = await (supabase as any).rpc("admin_revive_character", {
        p_profile_id: target.profile_id,
        p_health: health,
        p_energy: energy,
        p_grant_lives: grantLives,
        p_make_active: makeActive,
        p_reason: reason.trim() === "" ? null : reason.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result: any) => {
      toast({
        title: "Character revived",
        description: `${result?.display_name || result?.username} is back with ${result?.health} health.`,
      });
      setTarget(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-character-search"] });
      queryClient.invalidateQueries({ queryKey: ["death-stats"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
    },
    onError: (err: any) => {
      toast({
        title: "Revival failed",
        description: err?.message === "ADMIN_REQUIRED" ? "Admin access required." : err?.message,
        variant: "destructive",
      });
    },
  });

  const openRevive = (row: AdminCharacterRow) => {
    setTarget(row);
    setHealth(Math.max(row.health ?? 0, 75));
    setEnergy(Math.max(row.energy ?? 0, 75));
    setGrantLives(1);
    setMakeActive(true);
    setReason("");
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Character Recovery</h1>
            <p className="text-sm text-muted-foreground">
              Find and revive any character in the game — including comatose and deleted ones
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Find a character</CardTitle>
            <CardDescription>Search by stage name, username, character ID or account ID</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(searchInput);
              }}
            >
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="e.g. Big Fowler"
              />
              <Button type="submit" className="shrink-0">
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </form>
            <div className="flex items-center gap-2">
              <Switch id="only-dead" checked={onlyDead} onCheckedChange={setOnlyDead} />
              <Label htmlFor="only-dead" className="text-sm">
                Only show comatose / deleted characters
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Results {characters ? <span className="text-muted-foreground">({characters.length})</span> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading characters…
              </div>
            ) : !characters || characters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No characters matched that search.</p>
            ) : (
              characters.map((row) => {
                const isDead = Boolean(row.died_at);
                const isDeleted = Boolean(row.deleted_at);
                return (
                  <div
                    key={row.profile_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{row.display_name || row.username}</span>
                        <span className="text-xs text-muted-foreground">@{row.username}</span>
                        {isDead ? (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <Skull className="h-3 w-3" /> Coma
                          </Badge>
                        ) : null}
                        {isDeleted ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Trash2 className="h-3 w-3" /> Deleted
                          </Badge>
                        ) : null}
                        {!isDead && !isDeleted ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <User className="h-3 w-3" /> Alive
                          </Badge>
                        ) : null}
                        {row.is_active ? (
                          <Badge className="text-[10px]">Active slot</Badge>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Slot {row.slot_number ?? "—"} · Lv {row.level ?? 0} · Fame {row.fame ?? 0} · HP {row.health ?? 0} ·
                        Lives {row.resurrection_lives ?? 0} · Last login {formatDate(row.last_login_at)}
                        {row.death_cause ? ` · Cause: ${row.death_cause}` : ""}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/70">{row.profile_id}</p>
                    </div>
                    <Button size="sm" onClick={() => openRevive(row)}>
                      <HeartPulse className="mr-2 h-4 w-4" /> Revive
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(target)} onOpenChange={(open) => (open ? null : setTarget(null))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revive {target?.display_name || target?.username}</DialogTitle>
              <DialogDescription>
                This clears the coma and deletion state, restores vitals and wellness, and logs the action to the admin
                audit log.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Health: {health}</Label>
                <Slider value={[health]} onValueChange={([v]) => setHealth(v)} min={10} max={100} step={5} />
              </div>
              <div className="space-y-2">
                <Label>Energy: {energy}</Label>
                <Slider value={[energy]} onValueChange={([v]) => setEnergy(v)} min={10} max={100} step={5} />
              </div>
              <div className="space-y-2">
                <Label>Extra resurrection lives: {grantLives}</Label>
                <Slider value={[grantLives]} onValueChange={([v]) => setGrantLives(v)} min={0} max={5} step={1} />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="make-active" checked={makeActive} onCheckedChange={setMakeActive} />
                <Label htmlFor="make-active" className="text-sm">
                  Make this the owner's active character
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Recovered after accidental health decay"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTarget(null)} disabled={reviveMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={() => reviveMutation.mutate()} disabled={reviveMutation.isPending}>
                {reviveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reviving…
                  </>
                ) : (
                  <>
                    <HeartPulse className="mr-2 h-4 w-4" /> Revive character
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
};

export default CharacterRecoveryAdmin;
