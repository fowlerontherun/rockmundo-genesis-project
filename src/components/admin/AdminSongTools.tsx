import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Music, AlertTriangle, CheckCircle } from "lucide-react";
import { useSongStatusAudit, useFixSongStatus, useFixAllDraftWithRecordings } from "@/hooks/useAdminSongTools";
import { format } from "date-fns";

export const AdminSongTools = () => {
  const { data: audit, isLoading, refetch } = useSongStatusAudit();
  const fixSongStatus = useFixSongStatus();
  const fixAllDraft = useFixAllDraftWithRecordings();

  const draftWithRecording = audit?.issues.filter(i => i.issue_type === 'draft_with_recording') || [];
  const recordedWithoutRecording = audit?.issues.filter(i => i.issue_type === 'recorded_without_recording') || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Song Status Audit
            </CardTitle>
            <CardDescription>
              Find and fix songs with incorrect status
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{audit?.totalSongs || 0}</div>
            <div className="text-xs text-muted-foreground">Total Songs</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{audit?.draftCount || 0}</div>
            <div className="text-xs text-muted-foreground">Draft</div>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-warning">{audit?.recordedCount || 0}</div>
            <div className="text-xs text-muted-foreground">Recorded</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{audit?.releasedCount || 0}</div>
            <div className="text-xs text-muted-foreground">Released</div>
          </div>
        </div>

        {/* Issues Summary */}
        {(draftWithRecording.length > 0 || recordedWithoutRecording.length > 0) && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-medium">Issues Found</span>
            </div>
            <ul className="text-sm space-y-1">
              {draftWithRecording.length > 0 && (
                <li>{draftWithRecording.length} draft song(s) have completed recordings</li>
              )}
              {recordedWithoutRecording.length > 0 && (
                <li>{recordedWithoutRecording.length} "recorded" song(s) have no recordings</li>
              )}
            </ul>
          </div>
        )}

        {/* Quick Fix Actions */}
        {draftWithRecording.length > 0 && (
          <Button 
            onClick={() => fixAllDraft.mutate()}
            disabled={fixAllDraft.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Fix All {draftWithRecording.length} Draft Songs with Recordings
          </Button>
        )}

        {/* Issues List */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : audit?.issues.length === 0 ? (
          <div className="text-center py-4 text-green-600 flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5" />
            All song statuses are correct!
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {audit?.issues.map((issue) => (
              <div 
                key={issue.id} 
                className="flex items-center justify-between p-3 bg-card border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{issue.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Status: {issue.status} • Recordings: {issue.recording_count}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {format(new Date(issue.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {issue.issue_type === 'draft_with_recording' && (
                    <>
                      <Badge variant="destructive">Should be Recorded</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fixSongStatus.mutate({ songId: issue.id, newStatus: 'recorded' })}
                        disabled={fixSongStatus.isPending}
                      >
                        Fix
                      </Button>
                    </>
                  )}
                  {issue.issue_type === 'recorded_without_recording' && (
                    <>
                      <Badge variant="secondary">No Recording</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fixSongStatus.mutate({ songId: issue.id, newStatus: 'draft' })}
                        disabled={fixSongStatus.isPending}
                      >
                        Reset to Draft
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
