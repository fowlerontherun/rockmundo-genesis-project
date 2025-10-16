import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RecordingWizard } from "@/components/recording/RecordingWizard";
import { useRecordingSessions } from "@/hooks/useRecordingData";
import { useAuth } from "@/hooks/useAuth";
import { Music, Plus, Clock, CheckCircle2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function RecordingStudio() {
  const { session } = useAuth();
  const [wizardOpen, setWizardOpen] = useState(false);
  
  // TODO: Get current city from player profile
  const currentCityId = "placeholder-city-id";
  
  const { data: sessions, isLoading } = useRecordingSessions(session?.user?.id || "");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Scheduled</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Music className="h-8 w-8 text-primary" />
            Recording Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Record your songs with professional producers and studios
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Recording
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recording Sessions</CardTitle>
            <CardDescription>
              Track your current and past recording sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading sessions...
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="text-center py-12">
                <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recording sessions yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start your first recording to see it here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session: any) => (
                  <Card key={session.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(session.status)}
                            <h3 className="font-semibold truncate">
                              {session.songs?.title || 'Unknown Song'}
                            </h3>
                            {getStatusBadge(session.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div>Studio: {session.city_studios?.name || 'N/A'}</div>
                            <div>Producer: {session.recording_producers?.name || 'N/A'}</div>
                            <div>Duration: {session.duration_hours} hours</div>
                            <div>Cost: ${session.total_cost.toLocaleString()}</div>
                          </div>

                          {session.status === 'completed' && (
                            <div className="mt-2 text-sm">
                              <span className="text-muted-foreground">Quality: </span>
                              <span className="font-semibold">{session.quality_before}</span>
                              <span className="mx-2">→</span>
                              <span className="font-semibold text-primary">{session.quality_after}</span>
                              <span className="ml-2 text-green-600">
                                +{session.quality_improvement} (+{Math.round((session.quality_improvement / session.quality_before) * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="text-right text-sm text-muted-foreground">
                          {session.completed_at ? (
                            <div>Completed {formatDistanceToNow(new Date(session.completed_at))} ago</div>
                          ) : session.status === 'in_progress' ? (
                            <div>Ends {formatDistanceToNow(new Date(session.scheduled_end))}</div>
                          ) : (
                            <div>Created {formatDistanceToNow(new Date(session.created_at))} ago</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecordingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        userId={session?.user?.id || ""}
        currentCityId={currentCityId}
      />
    </div>
  );
}
