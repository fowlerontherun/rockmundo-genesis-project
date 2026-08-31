import { useEffect, useMemo, useState } from "react";
import { Eye, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type StageZone = "LEFT" | "CENTRE" | "RIGHT" | "FRONT";
type ActiveGigPerformanceDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; gigId: string; bandName?: string; onSaved?: () => void };
type BeginResult = { challenge: StageZone[][]; started: boolean; resumed?: boolean };
type PerformanceResult = { awarded: boolean; score: number; cue_scores: number[]; rating_multiplier: number; band_best_multiplier: number };
type RpcError = { message?: string };
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError | null }> };
const rpcClient = supabase as unknown as RpcClient;
const ZONES: StageZone[] = ["LEFT", "CENTRE", "RIGHT", "FRONT"];

export function ActiveGigPerformanceDialog({ open, onOpenChange, gigId, bandName, onSaved }: ActiveGigPerformanceDialogProps) {
  const { profileId } = useActiveProfile();
  const [patterns, setPatterns] = useState<StageZone[][] | null>(null);
  const [round, setRound] = useState(0);
  const [showPattern, setShowPattern] = useState(true);
  const [responses, setResponses] = useState<StageZone[][]>([]);
  const [currentResponse, setCurrentResponse] = useState<StageZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverResult, setServerResult] = useState<PerformanceResult | null>(null);

  const finished = !!patterns && responses.length === patterns.length;
  const pattern = patterns?.[Math.min(round, Math.max(0, patterns.length - 1))] || [];
  const previewScores = useMemo(() => {
    if (!patterns) return [];
    return responses.map((response, index) => {
      const expected = patterns[index];
      const correct = response.filter((zone, step) => zone === expected[step]).length;
      return Math.max(20, Math.round((correct / expected.length) * 100));
    });
  }, [patterns, responses]);
  const previewAverage = previewScores.length ? Math.round(previewScores.reduce((sum, value) => sum + value, 0) / previewScores.length) : 0;

  useEffect(() => {
    if (!open || !profileId || patterns || startError) return;
    let cancelled = false;
    setLoading(true);
    void rpcClient.rpc("begin_active_gig_performance", { p_profile_id: profileId, p_gig_id: gigId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setStartError(error.message || "Could not start Active Performance"); return; }
      const result = data as BeginResult;
      if (!Array.isArray(result.challenge) || result.challenge.length !== 5) { setStartError("The performance challenge could not be loaded."); return; }
      setPatterns(result.challenge);
      setRound(0); setResponses([]); setCurrentResponse([]); setShowPattern(true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, profileId, gigId, patterns, startError]);

  useEffect(() => {
    if (!open || !patterns || finished || !pattern.length) return;
    setShowPattern(true);
    setCurrentResponse([]);
    const timeout = window.setTimeout(() => setShowPattern(false), 1400 + pattern.length * 250);
    return () => window.clearTimeout(timeout);
  }, [open, patterns, round, finished, pattern.length]);

  const resetLocal = () => {
    setPatterns(null); setRound(0); setShowPattern(true); setResponses([]); setCurrentResponse([]); setLoading(false); setStartError(null); setSaving(false); setServerResult(null);
  };

  const pressZone = (zone: StageZone) => {
    if (showPattern || finished || !pattern.length) return;
    const next = [...currentResponse, zone];
    if (next.length < pattern.length) { setCurrentResponse(next); return; }
    setResponses((current) => [...current, next]);
    setCurrentResponse([]);
    if (round < (patterns?.length || 1) - 1) setRound((value) => value + 1);
  };

  const save = async () => {
    if (!profileId || !patterns || responses.length !== patterns.length) return;
    setSaving(true);
    try {
      const { data, error } = await rpcClient.rpc("submit_active_gig_performance_v2", { p_profile_id: profileId, p_gig_id: gigId, p_responses: responses });
      if (error) throw new Error(error.message || "Could not save Active Performance result");
      const result = data as PerformanceResult;
      setServerResult(result);
      const percent = (Number(result.rating_multiplier || 0) * 100).toFixed(1);
      toast.success(result.rating_multiplier > 0 ? `Active Performance: score ${result.score}, ${percent}% live rating boost earned if this is the band's best result.` : `Active Performance: score ${result.score}. No live rating boost this time.`);
      onSaved?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save Active Performance result"); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) resetLocal(); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Active Performance</DialogTitle><DialogDescription>Read the crowd, remember the stage pattern, then reproduce it. Starting consumes your one attempt for this gig; reopening resumes the same server-issued challenge. Only {bandName || "the band's"} best member result counts.</DialogDescription></DialogHeader><div className="space-y-5">
    {loading && <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Preparing your crowd challenge…</div>}
    {startError && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{startError}</div>}
    {patterns && !serverResult && <><div className="flex items-center justify-between text-sm"><span>{finished ? "Challenge complete" : `Crowd cue ${round + 1} of 5`}</span><span>{responses.length}/5 locked</span></div><Progress value={(responses.length / 5) * 100} />
      {!finished && (showPattern ? <div className="rounded-lg border bg-primary/5 p-5 text-center space-y-4"><div className="flex items-center justify-center gap-2 text-sm font-medium"><Eye className="h-4 w-4" /> Watch the crowd pattern</div><div className="flex flex-wrap justify-center gap-2">{pattern.map((zone, index) => <Badge key={`${zone}-${index}`} variant="secondary" className="px-3 py-1.5 text-sm">{index + 1}. {zone}</Badge>)}</div></div> : <div className="space-y-3"><div className="rounded-lg border bg-muted/30 p-4 text-center"><p className="text-sm text-muted-foreground">Repeat the pattern from memory</p><p className="mt-1 text-lg font-semibold">Step {currentResponse.length + 1} of {pattern.length}</p><p className="text-xs text-muted-foreground mt-1">Every choice consumes this step — there are no free retries.</p></div><div className="grid grid-cols-2 gap-2">{ZONES.map((zone) => <Button key={zone} size="lg" variant="outline" className="h-14" onClick={() => pressZone(zone)}>{zone}</Button>)}</div></div>)}
      {finished && <div className="space-y-4"><div className="text-center space-y-1"><p className="text-sm text-muted-foreground">Provisional stage-presence score</p><p className="text-5xl font-black">{previewAverage}</p><p className="text-sm text-muted-foreground">The game server verifies every cue before applying any bonus.</p></div><div className="grid grid-cols-5 gap-1">{previewScores.map((score, index) => <div key={`cue-${index}`} className="rounded border p-2 text-center"><p className="text-[10px] text-muted-foreground">Cue {index + 1}</p><p className="font-semibold text-sm">{score}</p></div>)}</div><Button className="w-full" onClick={save} disabled={saving}>{saving ? "Verifying…" : "Lock In Performance"}</Button></div>}
    </>}
    {serverResult && <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-center space-y-2"><Sparkles className="h-7 w-7 mx-auto text-primary" /><p className="text-sm text-muted-foreground">Verified performance</p><p className="text-5xl font-black">{serverResult.score}</p><p className="text-sm">Your boost: {(serverResult.rating_multiplier * 100).toFixed(1)}% · Band best: {(serverResult.band_best_multiplier * 100).toFixed(1)}%</p><Button className="w-full mt-2" onClick={() => onOpenChange(false)}>Done</Button></div>}
  </div></DialogContent></Dialog>;
}
