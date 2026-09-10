import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, Rotate3D } from "lucide-react";
import { toast } from "sonner";

interface Props {
  collectionId: string;
  items: any[];
  onChanged?: () => void;
}

const statusClass = (status?: string) => status === "ready"
  ? "border-emerald-500/30 text-emerald-600"
  : status === "failed"
    ? "border-destructive/30 text-destructive"
    : status === "pending"
      ? "border-amber-500/30 text-amber-600"
      : "";

export function ClothingPreviewManager({ collectionId, items, onChanged }: Props) {
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["admin-clothing-preview-jobs", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_item_preview_jobs" as any)
        .select("id, clothing_item_id, job_type, status, attempt_count, error_message, created_at, started_at, completed_at")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 15000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-clothing-preview-jobs", collectionId] });
    queryClient.invalidateQueries({ queryKey: ["admin-collection-items", collectionId] });
    onChanged?.();
  };

  const queueAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("queue_skin_collection_previews" as any, { p_collection_id: collectionId, p_job_type: "full_set" } as any);
      if (error) throw error;
      return Number(data || 0);
    },
    onSuccess: count => { invalidate(); toast.success(`${count} clothing preview job${count === 1 ? "" : "s"} queued`); },
    onError: (error: Error) => toast.error(error.message),
  });

  const queueItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc("queue_clothing_preview_job" as any, { p_clothing_item_id: itemId, p_job_type: "full_set" } as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Preview generation queued"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const latestByItem = new Map<string, any>();
  for (const job of jobs) if (!latestByItem.has(job.clothing_item_id)) latestByItem.set(job.clothing_item_id, job);

  const ready = items.filter(item => item.preview_status === "ready").length;
  const failed = items.filter(item => item.preview_status === "failed").length;
  const pending = items.length - ready - failed;

  return <Card>
    <CardHeader className="flex flex-row items-start justify-between gap-4">
      <div>
        <CardTitle className="flex items-center gap-2"><Rotate3D className="h-5 w-5" />Preview generation</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Generated assets provide fast catalogue thumbnails and an 8-angle turntable fallback when live 3D is unavailable.</p>
      </div>
      <Button onClick={() => queueAll.mutate()} disabled={queueAll.isPending || !items.length}>
        {queueAll.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        Generate collection previews
      </Button>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{ready} ready</Badge>
        <Badge variant="outline" className="gap-1"><Clock3 className="h-3.5 w-3.5" />{pending} pending</Badge>
        <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" />{failed} failed</Badge>
      </div>
      <div className="divide-y rounded-lg border">
        {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No clothing in this collection.</p> : items.map(item => {
          const latest = latestByItem.get(item.id);
          const effective = latest?.status === "queued" || latest?.status === "processing" ? latest.status : item.preview_status || "pending";
          return <div key={item.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{item.name}</div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span className="capitalize">{item.category}</span>
                {item.preview_generated_at && <span>Generated {new Date(item.preview_generated_at).toLocaleString()}</span>}
                {latest?.attempt_count ? <span>Attempt {latest.attempt_count}</span> : null}
              </div>
              {(item.last_preview_error || latest?.error_message) && <p className="text-xs text-destructive mt-1">{item.last_preview_error || latest.error_message}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={`capitalize ${statusClass(effective)}`}>{effective}</Badge>
              <Button size="sm" variant="outline" disabled={queueItem.isPending || effective === "queued" || effective === "processing"} onClick={() => queueItem.mutate(item.id)}>
                {effective === "ready" ? "Regenerate" : "Generate"}
              </Button>
            </div>
          </div>;
        })}
      </div>
      {isLoading && <p className="text-xs text-muted-foreground">Loading preview jobs…</p>}
    </CardContent>
  </Card>;
}
