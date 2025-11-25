import { Loader2, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { getActiveNationalSelectionYear, triggerNationalSelections } from "@/lib/api/nationalSelections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RunnerStatus = "idle" | "success" | "error";

export type NationalSelectionsRunnerViewProps = {
  activeYear: number;
  canRun: boolean;
  isRunning: boolean;
  status: RunnerStatus;
  errorMessage?: string;
  onRun: () => void;
};

export const NationalSelectionsRunnerView = ({
  activeYear,
  canRun,
  isRunning,
  status,
  errorMessage,
  onRun,
}: NationalSelectionsRunnerViewProps) => {
  if (!canRun) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>National selections</CardTitle>
          </div>
          <CardDescription>
            Randomize the national selection entries for the active contest year. This action re-rolls the draw and
            refreshes entries.
          </CardDescription>
        </div>
        <Badge variant="outline">Year {activeYear}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onRun} disabled={isRunning} className="w-full sm:w-auto">
          {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isRunning ? "Running..." : "Run National Selections"}
        </Button>

        {status === "success" && (
          <p className="text-sm text-primary">Selections randomized for {activeYear}. Recent lists will be refreshed.</p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">Failed to run national selections{errorMessage ? `: ${errorMessage}` : "."}</p>
        )}
      </CardContent>
    </Card>
  );
};

export const NationalSelectionsRunner = () => {
  const { hasRole, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: activeYear, isLoading: activeYearLoading } = useQuery({
    queryKey: ["national-selection-active-year"],
    queryFn: getActiveNationalSelectionYear,
    staleTime: 5 * 60 * 1000,
  });

  const resolvedYear = useMemo(() => activeYear ?? new Date().getFullYear(), [activeYear]);

  const runNationalSelections = useMutation({
    mutationFn: () => triggerNationalSelections(resolvedYear),
    onSuccess: () => {
      toast({
        title: "National selections completed",
        description: `Selections randomized for ${resolvedYear}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["national-selections", resolvedYear] });
      queryClient.invalidateQueries({ queryKey: ["national-selection-entries", resolvedYear] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to run selections",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canRun = hasRole("admin");
  const isRunning = runNationalSelections.isPending || activeYearLoading || roleLoading;
  const status: RunnerStatus = runNationalSelections.isError
    ? "error"
    : runNationalSelections.isSuccess
      ? "success"
      : "idle";

  return (
    <NationalSelectionsRunnerView
      activeYear={resolvedYear}
      canRun={canRun}
      isRunning={isRunning}
      status={status}
      errorMessage={runNationalSelections.error instanceof Error ? runNationalSelections.error.message : undefined}
      onRun={() => runNationalSelections.mutate()}
    />
  );
};
