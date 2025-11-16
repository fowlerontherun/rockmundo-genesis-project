import { useState } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useRecordingSessions, type RecordingSession } from "@/hooks/useRecordingData";
import {
  ensureRecordingStage,
  ensureRecordingStatus,
  getRecordingWorkflowState,
  getRecordingStatusTransitions,
  recordingStatusLabels,
  hasRemainingStages,
  getNextStage,
} from "@/lib/workflows/recording";
import type {
  RecordingStage,
  RecordingStatus,
  RecordingWorkflowStageState,
  RecordingWorkflowTaskStatus,
  RecordingWorkflowCollaboratorStatus,
} from "@/lib/workflows/recording";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  Loader2,
  Users,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const statusBadgeStyles: Record<RecordingStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  in_progress: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/30",
};

const stageBadgeStyles: Record<RecordingStage, string> = {
  recording: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  mixing: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
  mastering: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
};

const progressBadgeStyles: Record<RecordingWorkflowStageState["progress"], string> = {
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  active: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  pending: "bg-muted text-muted-foreground border-transparent",
  blocked: "bg-rose-500/10 text-rose-500 border-rose-500/30",
};

const taskStatusIcons: Record<RecordingWorkflowTaskStatus, JSX.Element> = {
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  in_progress: <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />,
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  blocked: <XCircle className="h-4 w-4 text-rose-500" />,
};

const collaboratorStatusBadges: Record<RecordingWorkflowCollaboratorStatus, string> = {
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  active: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  upcoming: "bg-muted text-muted-foreground border-transparent",
  blocked: "bg-rose-500/10 text-rose-500 border-rose-500/30",
};

const collaboratorStatusLabels: Record<RecordingWorkflowCollaboratorStatus, string> = {
  completed: "Completed",
  active: "Active",
  upcoming: "Upcoming",
  blocked: "Blocked",
};

interface StatusMutationInput {
  sessionId: string;
  nextStatus: RecordingStatus;
}

interface StageMutationInput {
  sessionId: string;
}

type PendingAction =
  | { type: "status"; sessionId: string; key: RecordingStatus }
  | { type: "stage"; sessionId: string };

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  try {
    return format(new Date(value), "PPpp");
  } catch (error) {
    return value;
  }
}

function formatRelativeDate(value?: string | null) {
  if (!value) return null;
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch (error) {
    return null;
  }
}

export default function StudioRecordingDashboard() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? "";
  const { data: sessions, isLoading } = useRecordingSessions(userId);
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const statusMutation = useMutation<void, Error, StatusMutationInput>({
    mutationFn: async ({ sessionId, nextStatus }: StatusMutationInput) => {
      const { error } = await supabase.rpc("update_recording_session_status", {
        p_session_id: sessionId,
        p_status: nextStatus,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      if (variables) {
        toast.success(`Session marked as ${recordingStatusLabels[variables.nextStatus]}.`);
      } else {
        toast.success("Session status updated.");
      }
      queryClient.invalidateQueries({ queryKey: ["recording-sessions", userId] });
    },
    onError: (error: Error) => {
      console.error("Failed to update recording session status", error);
      toast.error(error.message ?? "Unable to update session status.");
    },
    onSettled: () => setPendingAction(null),
  });

  const stageMutation = useMutation<void, Error, StageMutationInput>({
    mutationFn: async ({ sessionId }: StageMutationInput) => {
      const { error } = await supabase.rpc("advance_recording_session_stage", {
        p_session_id: sessionId,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Session advanced to the next production stage.");
      queryClient.invalidateQueries({ queryKey: ["recording-sessions", userId] });
    },
    onError: (error: Error) => {
      console.error("Failed to advance recording session stage", error);
      toast.error(error.message ?? "Unable to advance the session stage.");
    },
    onSettled: () => setPendingAction(null),
  });

  const handleStatusChange = (sessionId: string, nextStatus: RecordingStatus) => {
    if (!userId) {
      toast.error("You need to be signed in to update session statuses.");
      return;
    }

    setPendingAction({ type: "status", sessionId, key: nextStatus });
    statusMutation.mutate({ sessionId, nextStatus });
  };

  const handleAdvanceStage = (sessionId: string) => {
    if (!userId) {
      toast.error("You need to be signed in to advance session stages.");
      return;
    }

    setPendingAction({ type: "stage", sessionId });
    stageMutation.mutate({ sessionId });
  };

  const isActionPending = (sessionId: string, type: PendingAction["type"], key?: RecordingStatus) => {
    if (!pendingAction) return false;
    if (pendingAction.sessionId !== sessionId) return false;

    if (pendingAction.type === "status" && type === "status") {
      return pendingAction.key === key;
    }

    if (pendingAction.type === type && type === "stage") {
      return true;
    }

    return false;
  };

  const renderSessionCard = (session: RecordingSession) => {
    const status = ensureRecordingStatus(session.status);
    const stage = ensureRecordingStage(session.stage);
    const workflow = getRecordingWorkflowState(stage, status);
    const stageDefinition = workflow.find(item => item.key === stage);
    const transitions = getRecordingStatusTransitions(status);
    const relativeStart = formatRelativeDate(session.scheduled_start);
    const nextStageKey = getNextStage(stage);
    const nextStageLabel = nextStageKey
      ? workflow.find(item => item.key === nextStageKey)?.label ?? nextStageKey
      : null;

    return (
      <Card key={session.id} className="border-muted shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold">
                {session.songs?.title ?? "Untitled Session"}
              </CardTitle>
              <CardDescription className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {session.recording_producers?.name ?? "Unknown Producer"} · {session.city_studios?.name ?? "Unassigned Studio"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Scheduled for {formatDate(session.scheduled_start)}
                  {relativeStart ? ` (${relativeStart})` : ""}
                </div>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={cn("border", stageBadgeStyles[stage])}>{stageDefinition?.label ?? stage}</Badge>
              <Badge className={cn("border", statusBadgeStyles[status])}>{recordingStatusLabels[status]}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {stageDefinition?.focus ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <strong className="block text-foreground">Current Focus</strong>
              {stageDefinition.focus}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ListChecks className="h-4 w-4" />
                Stage Timeline & Tasks
              </div>
              <div className="space-y-4">
                {workflow.map(stageState => (
                  <StagePanel
                    key={`${session.id}-${stageState.key}`}
                    stageState={stageState}
                    isCurrent={stageState.key === stage}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="h-4 w-4" />
                Collaborators
              </div>
              <div className="space-y-3">
                {workflow.map(stageState => (
                  <CollaboratorPanel
                    key={`${session.id}-${stageState.key}-collaborators`}
                    stageState={stageState}
                  />
                ))}
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="font-semibold text-foreground">Session Details</div>
                <DetailRow label="Duration" value={`${session.duration_hours ?? "?"} hrs`} />
                <DetailRow
                  label="Total Cost"
                  value={session.total_cost ? `$${session.total_cost.toLocaleString()}` : "Not calculated"}
                />
                {session.started_at ? (
                  <DetailRow label="Started" value={formatDate(session.started_at)} />
                ) : null}
                {session.completed_at ? (
                  <DetailRow label="Completed" value={formatDate(session.completed_at)} />
                ) : null}
                {session.notes ? <DetailRow label="Notes" value={session.notes} /> : null}
              </div>

              <div className="space-y-3">
                {transitions.length > 0 && status !== "cancelled" && status !== "completed" ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">Update Status</div>
                    <div className="flex flex-wrap gap-2">
                      {transitions.map(nextStatus => (
                        <Button
                          key={`${session.id}-${nextStatus}`}
                          size="sm"
                          variant="outline"
                          disabled={isActionPending(session.id, "status", nextStatus) || statusMutation.isPending}
                          onClick={() => handleStatusChange(session.id, nextStatus)}
                        >
                          {isActionPending(session.id, "status", nextStatus) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          {recordingStatusLabels[nextStatus]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {hasRemainingStages(stage) && status !== "cancelled" && nextStageLabel ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-2"
                    disabled={isActionPending(session.id, "stage") || stageMutation.isPending}
                    onClick={() => handleAdvanceStage(session.id)}
                  >
                    {isActionPending(session.id, "stage") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Advance to {nextStageLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto space-y-8 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Studio Recording</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Monitor the progress of every recording project, review the tasks in motion, and coordinate collaborators across
          the studio pipeline.
        </p>
      </header>

      {isLoading ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your recording sessions...
          </CardContent>
        </Card>
      ) : !sessions || sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-4 py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No recording sessions scheduled yet</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Launch a new studio booking from the Recording Studio page to start tracking your production workflow.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">{sessions.map(renderSessionCard)}</div>
      )}

      {!userId ? (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 py-6 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-700">Sign in to manage sessions</p>
              <p className="text-amber-700/80">
                Status updates and workflow actions require an authenticated account.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface StagePanelProps {
  stageState: RecordingWorkflowStageState;
  isCurrent: boolean;
}

function StagePanel({ stageState, isCurrent }: StagePanelProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{stageState.label}</span>
            <Badge className={cn("border", progressBadgeStyles[stageState.progress])}>
              {stageState.progress === "completed" && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {stageState.progress === "active" && <Clock className="mr-1 h-3 w-3 animate-pulse" />}
              {stageState.progress === "blocked" && <XCircle className="mr-1 h-3 w-3" />}
              {stageState.progress.charAt(0).toUpperCase() + stageState.progress.slice(1)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{stageState.description}</p>
        </div>
        {isCurrent ? <Badge variant="outline">Current Stage</Badge> : null}
      </div>

      <ul className="mt-4 space-y-3">
        {stageState.tasks.map(task => (
          <li key={task.id} className="flex gap-3 rounded-md border bg-muted/40 p-3 text-sm">
            <span>{taskStatusIcons[task.status]}</span>
            <div>
              <div className="font-medium text-foreground">{task.title}</div>
              <p className="text-xs text-muted-foreground">{task.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CollaboratorPanelProps {
  stageState: RecordingWorkflowStageState;
}

function CollaboratorPanel({ stageState }: CollaboratorPanelProps) {
  return (
    <div className="rounded-lg border bg-card/60 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{stageState.label}</span>
        <Badge className={cn("border", progressBadgeStyles[stageState.progress])}>
          {stageState.progress.charAt(0).toUpperCase() + stageState.progress.slice(1)}
        </Badge>
      </div>
      <ul className="mt-3 space-y-3">
        {stageState.collaborators.map(collaborator => (
          <li key={collaborator.id} className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{collaborator.role}</span>
              <Badge className={cn("border", collaboratorStatusBadges[collaborator.status])}>
                {collaboratorStatusLabels[collaborator.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">{collaborator.summary}</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {collaborator.responsibilities.map((item, index) => (
                <li key={`${collaborator.id}-responsibility-${index}`}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex justify-between text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
