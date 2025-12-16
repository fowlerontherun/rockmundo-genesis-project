import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useStuckReleases, useForceCompleteRelease, useFixNullManufacturingDates, useCompleteAllReadyReleases } from "@/hooks/useAdminReleaseTools";
import { format } from "date-fns";

export const AdminReleaseTools = () => {
  const { data: stuckReleases, isLoading, refetch } = useStuckReleases();
  const forceComplete = useForceCompleteRelease();
  const fixNullDates = useFixNullManufacturingDates();
  const completeAllReady = useCompleteAllReadyReleases();

  const now = new Date();
  const readyReleases = stuckReleases?.filter(r => 
    r.manufacturing_complete_at && new Date(r.manufacturing_complete_at) <= now
  ) || [];
  const pendingReleases = stuckReleases?.filter(r => 
    r.manufacturing_complete_at && new Date(r.manufacturing_complete_at) > now
  ) || [];
  const nullDateReleases = stuckReleases?.filter(r => !r.manufacturing_complete_at) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Release Manufacturing Admin
            </CardTitle>
            <CardDescription>
              Manage stuck releases and fix manufacturing issues
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => completeAllReady.mutate()}
            disabled={completeAllReady.isPending || readyReleases.length === 0}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete {readyReleases.length} Ready Release(s)
          </Button>
          <Button 
            variant="outline"
            onClick={() => fixNullDates.mutate()}
            disabled={fixNullDates.isPending || nullDateReleases.length === 0}
          >
            <Clock className="h-4 w-4 mr-2" />
            Fix {nullDateReleases.length} Missing Dates
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{readyReleases.length}</div>
            <div className="text-xs text-muted-foreground">Ready to Complete</div>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-warning">{pendingReleases.length}</div>
            <div className="text-xs text-muted-foreground">Still Manufacturing</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{nullDateReleases.length}</div>
            <div className="text-xs text-muted-foreground">Missing Date</div>
          </div>
        </div>

        {/* Release List */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : stuckReleases?.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No releases in manufacturing status
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stuckReleases?.map((release) => {
              const isReady = release.manufacturing_complete_at && new Date(release.manufacturing_complete_at) <= now;
              const hasDate = !!release.manufacturing_complete_at;
              
              return (
                <div 
                  key={release.id} 
                  className="flex items-center justify-between p-3 bg-card border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{release.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {release.artist_name} • Created {format(new Date(release.created_at), 'MMM d, yyyy')}
                    </div>
                    {hasDate && (
                      <div className="text-xs text-muted-foreground">
                        Complete: {format(new Date(release.manufacturing_complete_at!), 'MMM d, yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isReady ? (
                      <Badge variant="destructive">Ready</Badge>
                    ) : hasDate ? (
                      <Badge variant="outline">Pending</Badge>
                    ) : (
                      <Badge variant="secondary">No Date</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => forceComplete.mutate(release.id)}
                      disabled={forceComplete.isPending}
                    >
                      Force Complete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
