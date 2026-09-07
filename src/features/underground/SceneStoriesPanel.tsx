import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Flame, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CityScenePanel } from "./CityScenePanel";

export type SceneStorySurface = "nightclub" | "underworld";
type StoryChoice = { key: string; label: string; description?: string; successChance?: number };
type StoryStep = { key: string; title: string; body: string; choices: StoryChoice[] };
type StoryRun = { id: string; slug: string; name: string; description: string; surface: SceneStorySurface; riskTier: number; status: string; currentStepKey: string; step: StoryStep | null; expiresAt: string };
type StoryOpportunity = { id: string; slug: string; name: string; description: string; riskTier: number; minimumAge: number; minCred: number };
type OpportunityResponse = { ok: boolean; reason?: string; activeRun?: StoryRun | null; opportunities?: StoryOpportunity[] };
type ResolutionResponse = { ok: boolean; reason?: string; outcome?: "success" | "failure"; completed?: boolean; run?: StoryRun | null };

const riskLabel = (risk: number) => risk <= 1 ? "Low risk" : risk === 2 ? "Scene risk" : risk === 3 ? "Messy" : risk === 4 ? "High risk" : "Extreme";
const invalidateSceneQueries = (queryClient: ReturnType<typeof useQueryClient>, profileId: string) => {
  [["scene-stories", profileId], ["city-underground-scene", profileId], ["underground-state", profileId], ["scene-contacts", profileId], ["player-scandals", profileId], ["recovery"], ["game-data"]].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
};

export const SceneStoriesPanel = ({ profileId, surface }: { profileId: string | null; surface: SceneStorySurface }) => {
  const queryClient = useQueryClient();
  const title = surface === "nightclub" ? "Tonight's Scene" : "Underworld Opportunities";
  const description = surface === "nightclub"
    ? "Your local reputation, contacts, Heat and current scandals shape what happens after dark."
    : "The city's underground culture, your local standing and wider Underground Cred shape which off-grid doors open.";

  const query = useQuery({
    queryKey: ["scene-stories", profileId, surface],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_scene_story_opportunities", { p_profile_id: profileId, p_surface: surface });
      if (error) throw error;
      return data as OpportunityResponse;
    },
  });

  const start = useMutation({
    mutationFn: async (slug: string) => {
      const { data, error } = await (supabase as any).rpc("start_scene_story", { p_profile_id: profileId, p_story_slug: slug, p_surface: surface });
      if (error) throw error;
      return data as { ok: boolean; reason?: string; run?: StoryRun };
    },
    onSuccess: (result) => {
      result.ok ? toast.success("The night just took a turn...") : toast.error(result.reason === "not_eligible" ? "That opportunity is no longer available." : "Could not start this scene story.");
      if (profileId) invalidateSceneQueries(queryClient, profileId);
    },
    onError: () => toast.error("Could not start this scene story."),
  });

  const resolve = useMutation({
    mutationFn: async ({ runId, choiceKey }: { runId: string; choiceKey: string }) => {
      const { data, error } = await (supabase as any).rpc("resolve_scene_story_choice", { p_profile_id: profileId, p_run_id: runId, p_choice_key: choiceKey });
      if (error) throw error;
      return data as ResolutionResponse;
    },
    onSuccess: (result) => {
      if (!result.ok) toast.error(result.reason === "expired" ? "That opportunity expired." : "That choice could not be resolved.");
      else if (result.outcome === "success") toast.success(result.completed ? "Scene story completed. Your local name is growing." : "That went your way. The night continues...");
      else toast.warning(result.completed ? "The story ended messily, but the local scene will remember it." : "That did not go to plan. You still have a choice to make.");
      if (profileId) invalidateSceneQueries(queryClient, profileId);
    },
    onError: () => toast.error("Could not resolve that choice."),
  });

  if (!profileId) return null;
  const activeRun = query.data?.activeRun ?? null;
  const opportunities = query.data?.opportunities ?? [];

  return (
    <div className="space-y-3">
      <CityScenePanel profileId={profileId} />
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div>
            {activeRun && <Badge variant="outline">Active story</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading ? (
            <div className="flex items-center justify-center py-5 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking the local scene...</div>
          ) : activeRun?.step ? (
            <div className="rounded-xl border bg-background/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{activeRun.step.title}</h3><Badge variant="secondary" className="text-[10px]"><Flame className="mr-1 h-3 w-3" /> {riskLabel(activeRun.riskTier)}</Badge></div>
              <p className="text-sm text-muted-foreground">{activeRun.step.body}</p>
              <div className="grid gap-2 md:grid-cols-2">
                {(activeRun.step.choices ?? []).map((choice) => (
                  <Button key={choice.key} variant="outline" className="h-auto min-h-16 justify-between gap-3 whitespace-normal px-3 py-2 text-left" disabled={resolve.isPending} onClick={() => resolve.mutate({ runId: activeRun.id, choiceKey: choice.key })}>
                    <span><span className="block font-medium">{choice.label}</span>{choice.description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{choice.description}</span>}</span>
                    {resolve.isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ArrowRight className="h-4 w-4 shrink-0" />}
                  </Button>
                ))}
              </div>
            </div>
          ) : opportunities.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-3">
              {opportunities.map((story) => (
                <button key={story.id} type="button" onClick={() => start.mutate(story.slug)} disabled={start.isPending} className="rounded-xl border bg-background/60 p-3 text-left transition-colors hover:border-primary/50 disabled:opacity-60">
                  <div className="flex items-start justify-between gap-2"><span className="font-medium text-sm">{story.name}</span><Badge variant="outline" className="shrink-0 text-[10px]">Risk {story.riskTier}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{story.description}</p>
                  {story.minCred > 0 && <p className="mt-2 text-[10px] text-primary">Requires {story.minCred} Underground Cred</p>}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>No special opportunities are circulating here right now. Local reputation, travel, contacts, Heat, scandals, recovery and Underground Cred can all change what appears.</span></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
