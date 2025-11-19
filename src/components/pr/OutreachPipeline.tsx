import { Activity, ArrowUpRight, Compass } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { OutreachStage } from "./types";

interface OutreachPipelineProps {
  stages: OutreachStage[];
  isLoading?: boolean;
}

export function OutreachPipeline({ stages, isLoading }: OutreachPipelineProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5" />
          <CardTitle>Outreach Pipeline</CardTitle>
        </div>
        <Badge variant="outline">Momentum</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="rounded-lg border p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        ) : stages.length === 0 ? (
          <EmptyState
            title="No outreach plans"
            description="Track pitches from prospecting through booking to keep momentum."
            icon={Activity}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {stages.map((stage) => (
              <div key={stage.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stage.label}</p>
                    <p className="text-2xl font-bold">{stage.prospects}</p>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    {stage.conversionRate}%
                  </Badge>
                </div>
                <Progress value={stage.conversionRate} className="mt-3" />
                {stage.nextStep ? (
                  <p className="mt-2 text-sm text-muted-foreground">Next: {stage.nextStep}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
