import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Baby,
  Crown,
  Eye,
  EyeOff,
  Heart,
  History,
  LockKeyhole,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface FamilyMemberFallback {
  id: string;
  name: string;
  relationship: string;
  fame: number;
  level: number;
  traits: string[];
  isActive: boolean;
  emotionalStability: number;
}

interface FamilyLegacyProps {
  familyMembers?: FamilyMemberFallback[];
  legacyPressure?: number;
  fameInheritance?: number;
  className?: string;
}

type LegacyNode = {
  id: string;
  nodeType: "profile" | "child";
  profileId?: string | null;
  name: string;
  relationship: "self" | "parent" | "child" | "ancestor" | string;
  generation: number;
  fame: number;
  level: number;
  socialCapital: number;
  active: boolean;
  parentAId?: string;
  parentBId?: string;
};

type LegacyEvent = {
  id: string;
  type: "wedding" | "birth" | "coming_of_age" | "dynasty_milestone" | string;
  title: string;
  details?: Record<string, unknown>;
  occurredAt: string;
};

type LegacyMilestone = {
  key: "first_child" | "second_generation" | "three_generations" | "family_of_four" | string;
  unlockedAt: string;
  evidence?: Record<string, unknown>;
};

type LegacySettings = {
  treeVisibility: "private" | "public";
  announcementVisibility: "private" | "public";
  announceWeddings: boolean;
  announceBirths: boolean;
  announceComingOfAge: boolean;
};

type FamilyLegacyResponse = {
  profileId: string;
  socialCapital: number;
  generation: number;
  settings: LegacySettings;
  tree: LegacyNode[];
  history: LegacyEvent[];
  milestones: LegacyMilestone[];
};

const db = supabase as any;

const MILESTONE_LABELS: Record<string, { title: string; description: string }> = {
  first_child: { title: "First Branch", description: "Welcomed the first child into this family line." },
  second_generation: { title: "Second Generation", description: "Established a playable second generation." },
  three_generations: { title: "Three Generations", description: "Built a family line spanning three generations." },
  family_of_four: { title: "Growing Dynasty", description: "Built a family line with four recorded descendants." },
};

function iconForRelationship(relationship: string) {
  if (relationship === "self") return <Crown className="h-4 w-4 text-primary" />;
  if (relationship === "parent" || relationship === "ancestor") return <Users className="h-4 w-4 text-social-warm" />;
  return <Baby className="h-4 w-4 text-social-chemistry" />;
}

function iconForEvent(type: string) {
  if (type === "wedding") return <Heart className="h-4 w-4 text-social-love" />;
  if (type === "birth") return <Baby className="h-4 w-4 text-social-loyalty" />;
  if (type === "coming_of_age") return <Crown className="h-4 w-4 text-social-chemistry" />;
  return <Sparkles className="h-4 w-4 text-social-warm" />;
}

function TreeNode({ node }: { node: LegacyNode }) {
  return (
    <div className={cn("rounded-lg border p-3", !node.active && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {iconForRelationship(node.relationship)}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{node.name}</p>
            <p className="text-[11px] capitalize text-muted-foreground">{node.relationship} · generation {node.generation}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">Lv.{node.level}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{Number(node.fame ?? 0).toLocaleString()} fame</span>
        {node.socialCapital > 0 && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{node.socialCapital}/25 legacy capital</span>}
      </div>
    </div>
  );
}

export function FamilyLegacyPanel({ familyMembers = [], legacyPressure = 0, fameInheritance = 0, className }: FamilyLegacyProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsDraft, setSettingsDraft] = useState<LegacySettings | null>(null);

  const legacyQuery = useQuery({
    queryKey: ["family-legacy-authoritative"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_family_legacy");
      if (error) throw error;
      return data as FamilyLegacyResponse;
    },
  });

  const announcementsQuery = useQuery({
    queryKey: ["public-family-announcements"],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_public_family_announcements", { p_limit: 12 });
      if (error) throw error;
      return (data ?? []) as LegacyEvent[];
    },
  });

  useEffect(() => {
    if (legacyQuery.data?.settings) setSettingsDraft(legacyQuery.data.settings);
  }, [legacyQuery.data?.settings]);

  const savePrivacy = useMutation({
    mutationFn: async () => {
      if (!settingsDraft) return;
      const { error } = await db.rpc("set_family_legacy_privacy", {
        p_tree_visibility: settingsDraft.treeVisibility,
        p_announcement_visibility: settingsDraft.announcementVisibility,
        p_announce_weddings: settingsDraft.announceWeddings,
        p_announce_births: settingsDraft.announceBirths,
        p_announce_coming_of_age: settingsDraft.announceComingOfAge,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["family-legacy-authoritative"] }),
        queryClient.invalidateQueries({ queryKey: ["public-family-announcements"] }),
      ]);
      toast({ title: "Family privacy saved", description: "Legacy visibility now follows the server-side settings." });
    },
    onError: (error: Error) => toast({ title: "Could not save family privacy", description: error.message, variant: "destructive" }),
  });

  const data = legacyQuery.data;
  const tree = data?.tree ?? [];
  const parents = tree.filter((node) => node.relationship === "parent" || node.relationship === "ancestor");
  const self = tree.filter((node) => node.relationship === "self");
  const children = tree.filter((node) => node.relationship === "child");
  const familySize = tree.length || familyMembers.length;
  const visibleHistory = useMemo(() => (data?.history ?? []).slice(0, 12), [data?.history]);

  if (legacyQuery.isLoading) {
    return <Card className={className}><CardContent className="py-8 text-sm text-muted-foreground">Loading family legacy…</CardContent></Card>;
  }

  if (legacyQuery.isError) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>Family & Legacy</CardTitle><CardDescription>The authoritative family record could not be loaded.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">{legacyQuery.error instanceof Error ? legacyQuery.error.message : "Unknown error"}</p>
          <Button variant="outline" onClick={() => legacyQuery.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-social-warm" />Dynasty & Family Legacy</CardTitle>
              <CardDescription>Persistent lineage, intergenerational history and privacy-controlled family announcements.</CardDescription>
            </div>
            <Badge variant="secondary">Generation {data?.generation ?? 1}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3 text-center"><ShieldCheck className="mx-auto h-5 w-5 text-social-trust" /><p className="mt-1 text-xl font-bold">{data?.socialCapital ?? 0}/25</p><p className="text-[11px] text-muted-foreground">Inherited social capital</p></div>
            <div className="rounded-lg border p-3 text-center"><Users className="mx-auto h-5 w-5 text-social-chemistry" /><p className="mt-1 text-xl font-bold">{familySize}</p><p className="text-[11px] text-muted-foreground">Recorded family nodes</p></div>
            <div className="rounded-lg border p-3 text-center"><Crown className="mx-auto h-5 w-5 text-social-warm" /><p className="mt-1 text-xl font-bold">{data?.milestones?.length ?? 0}</p><p className="text-[11px] text-muted-foreground">Dynasty milestones</p></div>
          </div>

          {(legacyPressure > 0 || fameInheritance > 0) && <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Older client legacy estimates ({fameInheritance}% fame / {Math.round(legacyPressure)} pressure) are no longer used as authority. Dynasty progression now comes from the server record above.</p>}

          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Family tree</h3><Badge variant="outline">Persistent</Badge></div>
            {tree.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No lineage has been recorded yet.</p> : (
              <div className="space-y-3">
                {parents.length > 0 && <div><p className="mb-2 text-xs font-medium text-muted-foreground">Parents & ancestors</p><div className="grid gap-2 sm:grid-cols-2">{parents.map((node) => <TreeNode key={`${node.id}-${node.relationship}`} node={node} />)}</div></div>}
                {self.length > 0 && <div><p className="mb-2 text-xs font-medium text-muted-foreground">Current generation</p><div className="grid gap-2 sm:grid-cols-2">{self.map((node) => <TreeNode key={node.id} node={node} />)}</div></div>}
                {children.length > 0 && <div><p className="mb-2 text-xs font-medium text-muted-foreground">Next generation</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children.map((node) => <TreeNode key={node.id} node={node} />)}</div></div>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Hall of records</CardTitle><CardDescription>Server-recorded milestones across weddings, births and coming of age.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {visibleHistory.length === 0 ? <p className="text-sm text-muted-foreground">No family history yet.</p> : visibleHistory.map((event) => <div key={event.id} className="flex items-start gap-3 rounded-lg border p-3"><div className="mt-0.5">{iconForEvent(event.type)}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}</p></div><Badge variant="outline" className="capitalize">{event.type.replaceAll("_", " ")}</Badge></div>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />Dynasty milestones</CardTitle><CardDescription>Recognition only—legacy milestones do not create uncapped economic power.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(data?.milestones ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Your first dynasty milestone has not been reached yet.</p> : data?.milestones.map((milestone) => {
              const copy = MILESTONE_LABELS[milestone.key] ?? { title: milestone.key.replaceAll("_", " "), description: "Recorded family milestone." };
              return <div key={milestone.key} className="rounded-lg border p-3"><div className="flex items-center gap-2"><Crown className="h-4 w-4 text-social-warm" /><p className="text-sm font-semibold">{copy.title}</p></div><p className="mt-1 text-xs text-muted-foreground">{copy.description}</p></div>;
            })}
          </CardContent>
        </Card>
      </div>

      {settingsDraft && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4" />Family privacy</CardTitle><CardDescription>Everything stays private unless you explicitly make it public. For shared events, every recorded owner must opt in before the announcement appears publicly.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Family tree visibility</Label><Select value={settingsDraft.treeVisibility} onValueChange={(value: "private" | "public") => setSettingsDraft({ ...settingsDraft, treeVisibility: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="public">Public</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Announcement visibility</Label><Select value={settingsDraft.announcementVisibility} onValueChange={(value: "private" | "public") => setSettingsDraft({ ...settingsDraft, announcementVisibility: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="public">Public</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-2"><Heart className="h-4 w-4" /><Label htmlFor="family-weddings">Weddings</Label></div><Switch id="family-weddings" checked={settingsDraft.announceWeddings} onCheckedChange={(checked) => setSettingsDraft({ ...settingsDraft, announceWeddings: checked })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-2"><Baby className="h-4 w-4" /><Label htmlFor="family-births">Births</Label></div><Switch id="family-births" checked={settingsDraft.announceBirths} onCheckedChange={(checked) => setSettingsDraft({ ...settingsDraft, announceBirths: checked })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-2"><Crown className="h-4 w-4" /><Label htmlFor="family-coming-age">Coming of age</Label></div><Switch id="family-coming-age" checked={settingsDraft.announceComingOfAge} onCheckedChange={(checked) => setSettingsDraft({ ...settingsDraft, announceComingOfAge: checked })} /></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground"><span className="flex items-center gap-1">{settingsDraft.announcementVisibility === "public" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Shared family events require matching public opt-in from every participant.</span><Button size="sm" onClick={() => savePrivacy.mutate()} disabled={savePrivacy.isPending}>{savePrivacy.isPending ? "Saving…" : "Save privacy"}</Button></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" />Public family announcements</CardTitle><CardDescription>Only events whose participants explicitly opted into public announcements appear here.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {announcementsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading public announcements…</p> : announcementsQuery.isError ? <div className="flex items-center justify-between gap-3"><p className="text-sm text-destructive">Public announcements could not be loaded.</p><Button size="sm" variant="outline" onClick={() => announcementsQuery.refetch()}>Retry</Button></div> : (announcementsQuery.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No families have opted into public announcements yet.</p> : announcementsQuery.data?.map((event) => <div key={event.id} className="flex items-center gap-3 rounded-lg border p-3"><div>{iconForEvent(event.type)}</div><div className="flex-1"><p className="text-sm font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}</p></div></div>)}
        </CardContent>
      </Card>
    </div>
  );
}
