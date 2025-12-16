import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Radio, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Submission {
  id: string;
  song_title: string;
  station_name: string;
  status: "pending" | "accepted" | "rejected";
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface RadioSubmissionTrackerProps {
  submissions: Submission[];
  isLoading?: boolean;
}

export const RadioSubmissionTracker = ({ submissions, isLoading }: RadioSubmissionTrackerProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const pending = submissions.filter((s) => s.status === "pending").length;
  const accepted = submissions.filter((s) => s.status === "accepted").length;
  const rejected = submissions.filter((s) => s.status === "rejected").length;
  const total = submissions.length;
  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">Pending</Badge>;
      case "accepted":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600">Accepted</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600">Rejected</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-sm text-muted-foreground">Total Submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{pending}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{accepted}</div>
            <p className="text-sm text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{acceptanceRate}%</div>
            <p className="text-sm text-muted-foreground">Acceptance Rate</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Submission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No submissions yet</p>
              <p className="text-sm mt-2">Submit your songs to radio stations to get airplay!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(submission.status)}
                    <div>
                      <p className="font-medium">{submission.song_title}</p>
                      <p className="text-sm text-muted-foreground">{submission.station_name}</p>
                      {submission.rejection_reason && (
                        <p className="text-sm text-red-500 mt-1">{submission.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{format(new Date(submission.submitted_at), "MMM d, yyyy")}</p>
                      {submission.reviewed_at && (
                        <p className="text-xs">Reviewed: {format(new Date(submission.reviewed_at), "MMM d")}</p>
                      )}
                    </div>
                    {getStatusBadge(submission.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
