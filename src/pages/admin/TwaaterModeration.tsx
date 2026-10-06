import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Shield, EyeOff, CheckCircle, XCircle, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const REPORT_STATUSES = ["submitted", "triage", "under_review", "awaiting_information", "action_taken", "no_action", "duplicate", "closed"] as const;
const REPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const TwaaterModeration = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("submitted");
  const [newFilterWord, setNewFilterWord] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<"low" | "medium" | "high">("medium");
  const [filterAction, setFilterAction] = useState<"flag" | "hide" | "reject">("flag");

  // Twaater reports use the unified, audited moderation queue.
  const { data: reports, isLoading: reportsLoading, error: reportsError, refetch: refetchReports } = useQuery({
    queryKey: ["twaater-unified-reports", filterStatus],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_moderation_report_queue", {
        p_status: filterStatus === "all" ? null : filterStatus,
        p_limit: 100,
      });

      if (error) throw error;
      const queue = Array.isArray(data) ? data : [];
      return queue.filter((report: any) => report.target_type === "twaater_post");
    },
  });

  // Fetch filter words
  const { data: filterWords } = useQuery({
    queryKey: ["twaater_filter_words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaater_filter_words" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: async ({
      report,
      action,
      priority,
      assignToSelf,
    }: {
      report: any;
      action?: "hide" | "dismiss" | "review";
      priority?: string;
      assignToSelf?: boolean;
    }) => {
      if (action === "hide") {
        const { error: hideError } = await supabase
          .from("twaats")
          .update({
            moderation_status: "hidden",
            moderated_at: new Date().toISOString(),
            moderated_by: (await supabase.auth.getUser()).data.user?.id,
          } as any)
          .eq("id", report.target_id);

        if (hideError) throw hideError;
      }

      const status =
        action === "hide" ? "action_taken" :
        action === "dismiss" ? "no_action" :
        action === "review" ? "under_review" :
        null;

      const { error } = await (supabase as any).rpc("moderate_player_report", {
        p_report_id: report.id,
        p_status: status,
        p_priority: priority ?? null,
        p_resolution_summary:
          action === "hide" ? "Reported Twaater post hidden." :
          action === "dismiss" ? "No moderation action required." :
          null,
        p_note: null,
        p_assign_to_self: assignToSelf ?? false,
        p_duplicate_of_report_id: null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-unified-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-player-reports"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      toast({ title: "Moderation action applied" });
    },
    onError: (error: any) => {
      toast({
        title: "Moderation action failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add filter word
  const addFilterWordMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("twaater_filter_words" as any).insert({
        word: newFilterWord.toLowerCase().trim(),
        severity: filterSeverity,
        auto_action: filterAction,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater_filter_words"] });
      setNewFilterWord("");
      toast({ title: "Filter word added" });
    },
  });

  // Delete filter word
  const deleteFilterWordMutation = useMutation({
    mutationFn: async (wordId: string) => {
      const { error } = await supabase
        .from("twaater_filter_words" as any)
        .delete()
        .eq("id", wordId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater_filter_words"] });
      toast({ title: "Filter word removed" });
    },
  });

  return (
    <AdminRoute>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Twaater Moderation
          </h1>
          <p className="text-muted-foreground">Manage content reports and filter words</p>
        </div>

        <Tabs defaultValue="reports" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reports">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="filters">
              <Filter className="h-4 w-4 mr-2" />
              Filter Words
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Reports</CardTitle>
                    <CardDescription>Review and action reported content</CardDescription>
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reports</SelectItem>
                      {REPORT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
                ) : reportsError ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-destructive">Twaater moderation queue unavailable.</p>
                    <Button variant="outline" size="sm" onClick={() => refetchReports()}>Retry</Button>
                  </div>
                ) : reports?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No reports found</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports?.map((report: any) => {
                      const snapshot = report.evidence
                        ?.find((item: any) => item.evidence_type === "twaater_post")
                        ?.snapshot?.twaater_post;

                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline" className="capitalize">
                                {String(report.category || "other").replace(/_/g, " ")}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {report.submitted_at
                                  ? formatDistanceToNow(new Date(report.submitted_at), { addSuffix: true })
                                  : "Unknown time"}
                              </p>
                              <p className="text-sm mt-1">{report.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <p className="text-sm line-clamp-3">{snapshot?.body || "Post snapshot unavailable"}</p>
                            {snapshot?.account?.handle && (
                              <p className="text-xs text-muted-foreground mt-1">@{snapshot.account.handle}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{report.reporter?.display_name || report.reporter?.username || "Unknown"}</div>
                              {report.reported?.display_name && (
                                <div className="text-xs text-muted-foreground">Reported: {report.reported.display_name}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Badge variant={report.status === "submitted" ? "destructive" : "secondary"}>
                                {String(report.status || "submitted").replace(/_/g, " ")}
                              </Badge>
                              <Select
                                value={report.priority || "normal"}
                                onValueChange={(priority) => resolveReportMutation.mutate({ report, priority })}
                                disabled={resolveReportMutation.isPending}
                              >
                                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {REPORT_PRIORITIES.map((priority) => (
                                    <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resolveReportMutation.isPending}
                                onClick={() => resolveReportMutation.mutate({ report, action: "review", assignToSelf: true })}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={resolveReportMutation.isPending || !report.target_id}
                                onClick={() => resolveReportMutation.mutate({ report, action: "hide", assignToSelf: true })}
                              >
                                <EyeOff className="h-4 w-4 mr-1" />
                                Hide
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resolveReportMutation.isPending}
                                onClick={() => resolveReportMutation.mutate({ report, action: "dismiss" })}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Dismiss
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}                 </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="filters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add Filter Word</CardTitle>
                <CardDescription>Automatically flag, hide, or reject posts containing specific words</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="word">Word/Phrase</Label>
                    <Input
                      id="word"
                      value={newFilterWord}
                      onChange={(e) => setNewFilterWord(e.target.value)}
                      placeholder="Enter word to filter..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="severity">Severity</Label>
                    <Select value={filterSeverity} onValueChange={(v: any) => setFilterSeverity(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="action">Action</Label>
                    <Select value={filterAction} onValueChange={(v: any) => setFilterAction(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flag">Flag for Review</SelectItem>
                        <SelectItem value="hide">Auto-Hide</SelectItem>
                        <SelectItem value="reject">Auto-Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={() => addFilterWordMutation.mutate()}
                  disabled={!newFilterWord.trim() || addFilterWordMutation.isPending}
                >
                  Add Filter Word
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Filter Words</CardTitle>
                <CardDescription>{filterWords?.length || 0} words currently filtered</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Word</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterWords?.map((word: any) => (
                      <TableRow key={word.id}>
                        <TableCell className="font-mono">{word.word}</TableCell>
                        <TableCell>
                          <Badge variant={
                            word.severity === "high" ? "destructive" :
                            word.severity === "medium" ? "default" : "secondary"
                          }>
                            {word.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{word.auto_action}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteFilterWordMutation.mutate(word.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default TwaaterModeration;
