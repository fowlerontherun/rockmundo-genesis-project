import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Radio, TrendingUp, Music, Calendar, Clock } from "lucide-react";

interface AirplayStats {
  totalPlays: number;
  weeklyPlays: number;
  activeStations: number;
  topSong: { title: string; plays: number } | null;
  recentPlays: Array<{
    id: string;
    songTitle: string;
    stationName: string;
    playedAt: string;
  }>;
}

interface AirplayDashboardProps {
  stats: AirplayStats;
  submissions: any[];
}

export function AirplayDashboard({ stats, submissions }: AirplayDashboardProps) {
  const acceptedSubmissions = submissions.filter((s) => s.status === "accepted");
  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const rejectedSubmissions = submissions.filter((s) => s.status === "rejected");

  const acceptanceRate =
    submissions.length > 0
      ? Math.round((acceptedSubmissions.length / submissions.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Airplays</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlays.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.weeklyPlays} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeStations}</div>
            <p className="text-xs text-muted-foreground">
              Playing your music
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acceptanceRate}%</div>
            <Progress value={acceptanceRate} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSubmissions.length}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting decision
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Submission Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Status</CardTitle>
          <CardDescription>Overview of your radio submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500">Accepted</Badge>
                <span className="text-sm text-muted-foreground">
                  Songs on rotation
                </span>
              </div>
              <span className="font-medium">{acceptedSubmissions.length}</span>
            </div>
            <Progress
              value={
                submissions.length > 0
                  ? (acceptedSubmissions.length / submissions.length) * 100
                  : 0
              }
              className="h-2 bg-green-100"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Pending</Badge>
                <span className="text-sm text-muted-foreground">
                  Under review
                </span>
              </div>
              <span className="font-medium">{pendingSubmissions.length}</span>
            </div>
            <Progress
              value={
                submissions.length > 0
                  ? (pendingSubmissions.length / submissions.length) * 100
                  : 0
              }
              className="h-2"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Rejected</Badge>
                <span className="text-sm text-muted-foreground">
                  Not accepted
                </span>
              </div>
              <span className="font-medium">{rejectedSubmissions.length}</span>
            </div>
            <Progress
              value={
                submissions.length > 0
                  ? (rejectedSubmissions.length / submissions.length) * 100
                  : 0
              }
              className="h-2 bg-destructive/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Top Song */}
      {stats.topSong && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Most Played Song
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{stats.topSong.title}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.topSong.plays} plays across all stations
                </p>
              </div>
              <Badge variant="outline" className="text-lg">
                #{1}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Plays */}
      {stats.recentPlays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Airplays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentPlays.slice(0, 5).map((play) => (
                <div
                  key={play.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{play.songTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {play.stationName}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(play.playedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
