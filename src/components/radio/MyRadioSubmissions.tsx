import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRadioStations } from "@/hooks/useRadioStations";
import { Clock, CheckCircle, XCircle, Radio } from "lucide-react";

export const MyRadioSubmissions = () => {
  const { mySubmissions, isLoading } = useRadioStations();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case "accepted":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Loading submissions...
        </CardContent>
      </Card>
    );
  }

  if (mySubmissions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          No submissions yet. Submit your songs to radio stations to get airplay!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {mySubmissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Radio className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">
                    {(submission.song as any)?.title || "Unknown Song"}
                  </CardTitle>
                  <CardDescription>
                    {(submission.station as any)?.name || "Unknown Station"}
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant={getStatusVariant(submission.status)}
                className="flex items-center gap-1"
              >
                {getStatusIcon(submission.status)}
                {submission.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Station Type</p>
                <p className="font-medium capitalize">
                  {(submission.station as any)?.station_type || "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Quality Level</p>
                <p className="font-medium">
                  {(submission.station as any)?.quality_level || 0}/10
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium">
                  {new Date(submission.submitted_at).toLocaleDateString()}
                </p>
              </div>
              {submission.reviewed_at && (
                <div>
                  <p className="text-muted-foreground">Reviewed</p>
                  <p className="font-medium">
                    {new Date(submission.reviewed_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {submission.rejection_reason && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {submission.rejection_reason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
