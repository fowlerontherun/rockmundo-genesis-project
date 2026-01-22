import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, Search, AlertCircle, CheckCircle, Clock, ChevronDown, Database, Activity, Users, Bug } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface CronJobRun {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  result_summary: any;
  processed_count: number | null;
  error_count: number | null;
  triggered_by: string | null;
}

interface PlayerProfile {
  id: string;
  user_id: string;
  username: string;
  cash: number;
  current_city_id: string | null;
  is_traveling: boolean;
  travel_arrives_at: string | null;
  level: number;
  fame: number;
  created_at: string;
  current_city?: { name: string } | null;
}

export default function DebugPanel() {
  const { toast } = useToast();
  const [searchUsername, setSearchUsername] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("edge-functions");

  // Fetch recent edge function runs
  const { data: recentRuns = [], isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ["admin-debug-cron-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cron_job_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as CronJobRun[];
    },
    refetchInterval: 30000,
  });

  // Fetch error runs specifically
  const { data: errorRuns = [] } = useQuery({
    queryKey: ["admin-debug-error-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cron_job_runs")
        .select("*")
        .eq("status", "failed")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as CronJobRun[];
    },
    refetchInterval: 30000,
  });

  // Search for player
  const { data: searchResults = [], isLoading: searchLoading, refetch: searchPlayers } = useQuery({
    queryKey: ["admin-debug-player-search", searchUsername],
    queryFn: async () => {
      if (!searchUsername || searchUsername.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, username, cash, current_city_id, is_traveling, travel_arrives_at, level, fame, created_at")
        .ilike("username", `%${searchUsername}%`)
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as PlayerProfile[];
    },
    enabled: searchUsername.length >= 2,
  });

  // Fetch selected player's detailed state
  const { data: playerState, isLoading: playerStateLoading } = useQuery({
    queryKey: ["admin-debug-player-state", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      
      // First get band IDs for this user
      const { data: userBands } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", selectedUserId);
      
      const bandIds = userBands?.map(b => b.band_id) || [];
      
      // Fetch multiple related tables in parallel
      const [
        profileRes,
        bandsRes,
        rehearsalsRes,
        travelsRes,
        familiarityRes
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", selectedUserId).single(),
        supabase.from("band_members").select("*, band:bands(id, name, chemistry_level, fame)").eq("user_id", selectedUserId).eq("member_status", "active"),
        bandIds.length > 0 
          ? supabase.from("band_rehearsals").select("*, band:bands(name)").in("band_id", bandIds).order("scheduled_start", { ascending: false }).limit(10)
          : Promise.resolve({ data: [] }),
        supabase.from("player_travel_history").select("*").eq("user_id", selectedUserId).order("departure_time", { ascending: false }).limit(10),
        bandIds.length > 0
          ? supabase.from("band_song_familiarity").select("*, song:songs(title), band:bands(name)").in("band_id", bandIds).order("updated_at", { ascending: false }).limit(20)
          : Promise.resolve({ data: [] })
      ]);

      return {
        profile: profileRes.data,
        bands: bandsRes.data || [],
        rehearsals: (rehearsalsRes as any).data || [],
        travels: travelsRes.data || [],
        familiarity: (familiarityRes as any).data || [],
      };
    },
    enabled: !!selectedUserId,
  });

  // Group runs by function name for summary
  const functionSummary = recentRuns.reduce((acc, run) => {
    if (!acc[run.job_name]) {
      acc[run.job_name] = { total: 0, success: 0, failed: 0, lastRun: run.started_at };
    }
    acc[run.job_name].total++;
    if (run.status === "success") acc[run.job_name].success++;
    if (run.status === "failed") acc[run.job_name].failed++;
    return acc;
  }, {} as Record<string, { total: number; success: number; failed: number; lastRun: string }>);

  const handleSearch = () => {
    if (searchUsername.length >= 2) {
      searchPlayers();
    }
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return "—";
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bug className="h-8 w-8" />
            Debug Panel
          </h1>
          <p className="text-muted-foreground">Troubleshoot player issues and monitor edge functions</p>
        </div>
        <Button onClick={() => refetchRuns()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="edge-functions" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Edge Functions
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Errors ({errorRuns.length})
          </TabsTrigger>
          <TabsTrigger value="player-lookup" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Player Lookup
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database State
          </TabsTrigger>
        </TabsList>

        {/* Edge Functions Tab */}
        <TabsContent value="edge-functions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(functionSummary).slice(0, 12).map(([name, stats]) => (
              <Card key={name} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono">{name}</CardTitle>
                  <CardDescription className="text-xs">
                    Last run: {formatTimestamp(stats.lastRun)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-success/10 text-success">
                      {stats.success} success
                    </Badge>
                    {stats.failed > 0 && (
                      <Badge variant="destructive">
                        {stats.failed} failed
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>Last 100 edge function runs</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Function</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRuns.map((run) => (
                      <Collapsible key={run.id} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="font-mono text-xs">{run.job_name}</TableCell>
                              <TableCell>
                                {run.status === "success" ? (
                                  <Badge variant="outline" className="bg-success/10 text-success">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Success
                                  </Badge>
                                ) : run.status === "failed" ? (
                                  <Badge variant="destructive">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Failed
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {run.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{formatTimestamp(run.started_at)}</TableCell>
                              <TableCell className="text-xs">{run.duration_ms ? `${run.duration_ms}ms` : "—"}</TableCell>
                              <TableCell>{run.processed_count ?? "—"}</TableCell>
                              <TableCell className={run.error_count && run.error_count > 0 ? "text-destructive" : ""}>
                                {run.error_count ?? 0}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30 p-4">
                                <div className="space-y-2">
                                  {run.error_message && (
                                    <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                                      <strong>Error:</strong> {run.error_message}
                                    </div>
                                  )}
                                  {run.result_summary && (
                                    <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-32">
                                      {JSON.stringify(run.result_summary, null, 2)}
                                    </pre>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    Triggered by: {run.triggered_by || "cron"}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Recent Errors
              </CardTitle>
              <CardDescription>Failed edge function executions</CardDescription>
            </CardHeader>
            <CardContent>
              {errorRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                  <p>No recent errors! All systems operational.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {errorRuns.map((run) => (
                      <Card key={run.id} className="border-destructive/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-mono">{run.job_name}</CardTitle>
                            <Badge variant="destructive">Failed</Badge>
                          </div>
                          <CardDescription>
                            {format(new Date(run.started_at), "PPpp")}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                            {run.error_message || "No error message available"}
                          </div>
                          {run.result_summary && (
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-24">
                              {JSON.stringify(run.result_summary, null, 2)}
                            </pre>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Player Lookup Tab */}
        <TabsContent value="player-lookup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Player</CardTitle>
              <CardDescription>Look up a player's current game state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter username..."
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={searchLoading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4">
                  <Label className="text-sm text-muted-foreground">Select a player:</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {searchResults.map((player) => (
                      <Button
                        key={player.id}
                        variant={selectedUserId === player.user_id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedUserId(player.user_id)}
                        className="justify-start"
                      >
                        {player.username}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedUserId && playerState && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Profile State */}
              <Card>
                <CardHeader>
                  <CardTitle>Profile State</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Username:</span>
                      <span className="font-medium">{playerState.profile?.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Level:</span>
                      <span>{playerState.profile?.level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash:</span>
                      <span>${playerState.profile?.cash?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fame:</span>
                      <span>{playerState.profile?.fame}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current City ID:</span>
                      <span className="text-xs font-mono">{playerState.profile?.current_city_id || "None"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Is Traveling:</span>
                      <Badge variant={playerState.profile?.is_traveling ? "default" : "outline"}>
                        {playerState.profile?.is_traveling ? "Yes" : "No"}
                      </Badge>
                    </div>
                    {playerState.profile?.travel_arrives_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Arrives:</span>
                        <span>{formatTimestamp(playerState.profile.travel_arrives_at)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Bands */}
              <Card>
                <CardHeader>
                  <CardTitle>Bands ({playerState.bands.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {playerState.bands.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No active bands</p>
                  ) : (
                    <div className="space-y-2">
                      {playerState.bands.map((membership: any) => (
                        <div key={membership.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                          <span className="font-medium">{membership.band?.name}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline">Fame: {membership.band?.fame}</Badge>
                            <Badge variant="secondary">Chem: {membership.band?.chemistry_level}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Rehearsals */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Rehearsals</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {playerState.rehearsals.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No recent rehearsals</p>
                    ) : (
                      <div className="space-y-2">
                        {playerState.rehearsals.map((rehearsal: any) => (
                          <div key={rehearsal.id} className="p-2 border rounded text-sm">
                            <div className="flex justify-between">
                              <span>{rehearsal.band?.name}</span>
                              <Badge variant={rehearsal.status === "completed" ? "default" : "secondary"}>
                                {rehearsal.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatTimestamp(rehearsal.scheduled_start)} • {rehearsal.duration_hours}h
                            </div>
                            {rehearsal.familiarity_gained && (
                              <div className="text-xs text-success">+{rehearsal.familiarity_gained} familiarity</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Song Familiarity */}
              <Card>
                <CardHeader>
                  <CardTitle>Song Familiarity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {playerState.familiarity.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No song familiarity data</p>
                    ) : (
                      <div className="space-y-2">
                        {playerState.familiarity.map((fam: any) => (
                          <div key={fam.id} className="p-2 border rounded text-sm">
                            <div className="flex justify-between">
                              <span>{fam.song?.title || "Unknown Song"}</span>
                              <Badge variant="outline">{fam.familiarity_minutes} min</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fam.band?.name} • Stage: {fam.rehearsal_stage || "learning"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Last rehearsed: {formatTimestamp(fam.last_rehearsed_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Travel History */}
              <Card>
                <CardHeader>
                  <CardTitle>Travel History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {playerState.travels.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No travel history</p>
                    ) : (
                      <div className="space-y-2">
                        {playerState.travels.map((travel: any) => (
                          <div key={travel.id} className="p-2 border rounded text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-mono">
                                {travel.from_city_id?.slice(0, 8)}... → {travel.to_city_id?.slice(0, 8)}...
                              </span>
                              <Badge variant={travel.status === "completed" ? "default" : travel.status === "in_progress" ? "secondary" : "outline"}>
                                {travel.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {travel.transport_type} • {formatTimestamp(travel.departure_time)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

            </div>
          )}
        </TabsContent>

        {/* Database State Tab */}
        <TabsContent value="database" className="space-y-4">
          <DatabaseStatePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Database State Panel Component
function DatabaseStatePanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-debug-db-stats"],
    queryFn: async () => {
      const [
        profilesRes,
        bandsRes,
        rehearsalsRes,
        gigsRes,
        songsRes,
        travelsRes
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("bands").select("id", { count: "exact", head: true }),
        supabase.from("band_rehearsals").select("id, status", { count: "exact" }).eq("status", "scheduled"),
        supabase.from("gigs").select("id, status", { count: "exact" }).eq("status", "scheduled"),
        supabase.from("songs").select("id, status", { count: "exact" }).eq("status", "recorded"),
        supabase.from("player_travel_history").select("id, status", { count: "exact" }).eq("status", "in_progress"),
      ]);

      return {
        totalProfiles: profilesRes.count || 0,
        totalBands: bandsRes.count || 0,
        scheduledRehearsals: rehearsalsRes.count || 0,
        scheduledGigs: gigsRes.count || 0,
        recordedSongs: songsRes.count || 0,
        inProgressTravels: travelsRes.count || 0,
      };
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading database stats...</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Players</CardDescription>
          <CardTitle className="text-2xl">{stats?.totalProfiles.toLocaleString()}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Bands</CardDescription>
          <CardTitle className="text-2xl">{stats?.totalBands.toLocaleString()}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Scheduled Rehearsals</CardDescription>
          <CardTitle className="text-2xl">{stats?.scheduledRehearsals.toLocaleString()}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Scheduled Gigs</CardDescription>
          <CardTitle className="text-2xl">{stats?.scheduledGigs.toLocaleString()}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Recorded Songs</CardDescription>
          <CardTitle className="text-2xl">{stats?.recordedSongs.toLocaleString()}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>In-Progress Travels</CardDescription>
          <CardTitle className="text-2xl">{stats?.inProgressTravels.toLocaleString()}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
