import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  getTotpEpisodePlan,
  saveTotpEpisodePlan,
  totpSegmentKindLabel,
  TOTP_SEGMENT_KINDS,
  type TotpPlannedSegment,
} from "./scheduleApi";
import {
  formatPlannedRuntime,
  plannedRuntimeSeconds,
  TOTP_TARGET_RUNTIME_SECONDS,
} from "./scheduleWeeks";

function newSegmentId(): string {
  return `seg-${Math.random().toString(36).slice(2, 10)}`;
}

export function TotpEpisodePlanEditor({
  episodeId,
  readOnly = false,
}: {
  episodeId: string;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const plan = useQuery({
    queryKey: ["totp", "episode-plan", episodeId],
    queryFn: () => getTotpEpisodePlan(episodeId),
  });

  const [theme, setTheme] = useState("");
  const [openingLink, setOpeningLink] = useState("");
  const [closingLink, setClosingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [segments, setSegments] = useState<TotpPlannedSegment[]>([]);

  useEffect(() => {
    if (!plan.data) return;
    setTheme(plan.data.theme ?? "");
    setOpeningLink(plan.data.opening_link ?? "");
    setClosingLink(plan.data.closing_link ?? "");
    setNotes(plan.data.notes ?? "");
    setSegments(plan.data.segments ?? []);
  }, [plan.data]);

  const save = useMutation({
    mutationFn: () =>
      saveTotpEpisodePlan(episodeId, {
        theme,
        opening_link: openingLink,
        closing_link: closingLink,
        notes,
        segments,
      }),
    onSuccess: () => {
      toast({ title: "Plan saved", description: "The running sheet notes are stored for this episode." });
      void queryClient.invalidateQueries({ queryKey: ["totp", "episode-plan", episodeId] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "schedule"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not save the plan", description: error.message, variant: "destructive" }),
  });

  const runtime = plannedRuntimeSeconds(segments);
  const overrun = runtime > TOTP_TARGET_RUNTIME_SECONDS;

  function updateSegment(id: string, patch: Partial<TotpPlannedSegment>) {
    setSegments((current) => current.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment)));
  }

  return (
    <div className="space-y-4" data-totp-plan-editor={episodeId}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`theme-${episodeId}`}>Show theme</Label>
          <Input
            id={`theme-${episodeId}`}
            value={theme}
            disabled={readOnly}
            onChange={(event) => setTheme(event.target.value)}
            placeholder="Summer chart takeover"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`notes-${episodeId}`}>Production notes</Label>
          <Input
            id={`notes-${episodeId}`}
            value={notes}
            disabled={readOnly}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Extra staging, guest arrivals, anything to remember"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`opening-${episodeId}`}>Opening link</Label>
          <Textarea
            id={`opening-${episodeId}`}
            rows={3}
            value={openingLink}
            disabled={readOnly}
            onChange={(event) => setOpeningLink(event.target.value)}
            placeholder="Good evening and welcome to Top of the Pops…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`closing-${episodeId}`}>Closing link</Label>
          <Textarea
            id={`closing-${episodeId}`}
            rows={3}
            value={closingLink}
            disabled={readOnly}
            onChange={(event) => setClosingLink(event.target.value)}
            placeholder="That's all from us this week…"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Planned segments</Label>
          <div className="flex items-center gap-2">
            <Badge variant={overrun ? "destructive" : "secondary"}>
              {formatPlannedRuntime(runtime)} planned
            </Badge>
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-totp-plan-add-segment
                onClick={() =>
                  setSegments((current) => [
                    ...current,
                    { id: newSegmentId(), kind: "performance", title: "", durationSeconds: 180 },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add segment
              </Button>
            )}
          </div>
        </div>

        {segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No segments planned yet. Add presenter links, performances and chart slots to rough out the show.
          </p>
        ) : (
          <div className="space-y-2">
            {segments.map((segment, index) => (
              <div key={segment.id} className="grid items-end gap-2 rounded-md border p-2 sm:grid-cols-[2rem_1fr_9rem_6rem_2.5rem]">
                <span className="text-xs text-muted-foreground">{index + 1}</span>
                <Input
                  value={segment.title}
                  disabled={readOnly}
                  placeholder="Segment title"
                  onChange={(event) => updateSegment(segment.id, { title: event.target.value })}
                />
                <Select
                  value={segment.kind}
                  disabled={readOnly}
                  onValueChange={(value) => updateSegment(segment.id, { kind: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TOTP_SEGMENT_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>{totpSegmentKindLabel(kind)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  value={segment.durationSeconds}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateSegment(segment.id, { durationSeconds: Number(event.target.value) || 0 })
                  }
                />
                {!readOnly && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove segment"
                    onClick={() => setSegments((current) => current.filter((item) => item.id !== segment.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!readOnly && (
        <Button
          type="button"
          data-totp-plan-save
          disabled={save.isPending || plan.isLoading}
          onClick={() => save.mutate()}
        >
          <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Saving…" : "Save plan"}
        </Button>
      )}
      {readOnly && <p className="text-xs text-muted-foreground">This episode has aired, so the plan is read-only.</p>}
    </div>
  );
}
