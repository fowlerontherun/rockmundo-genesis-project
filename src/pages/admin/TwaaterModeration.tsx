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
import { AlertTriangle, Shield, Eye, EyeOff, CheckCircle, XCircle, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TwaaterModeration = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [newFilterWord, setNewFilterWord] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<"low" | "medium" | "high">("medium");
  const [filterAction, setFilterAction] = useState<"flag" | "hide" | "reject">("flag");

  // Fetch reports
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ["twaat_reports", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("twaat_reports" as any)
        .select(`
          *,
          twaat:twaats!twaat_reports_twaat_id_fkey(id, body, created_at),
          reporter:twaater_accounts!twaat_reports_reporter_account_id_fkey(handle, display_name)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
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

  // Update report status
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: string }) => {
      const { error } = await supabase
        .from("twaat_reports" as any)
        .update({ 
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaat_reports"] });
      toast({ title: "Report updated" });
    },
  });

  // Hide/show twaat
  const moderateTwaatMutation = useMutation({
    mutationFn: async ({ twaatId, action }: { twaatId: string; action: "hide" | "approve" }) => {
      const { error } = await supabase
        .from("twaats" as any)
        .update({ 
          moderation_status: action === "hide" ? "hidden" : "approved",
          moderated_at: new Date().toISOString(),
          moderated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", twaatId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaat_reports"] });
      toast({ title: "Moderation action applied" });
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="actioned">Actioned</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
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
                      {reports?.map((report: any) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline" className="capitalize">
                                {report.report_reason}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                              </p>
                              {report.report_details && (
                                <p className="text-sm mt-1">{report.report_details}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <p className="text-sm line-clamp-2">{report.twaat?.body}</p>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{report.reporter?.display_name}</div>
                              <div className="text-muted-foreground">@{report.reporter?.handle}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {report.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      moderateTwaatMutation.mutate({ twaatId: report.twaat_id, action: "hide" });
                                      updateReportMutation.mutate({ reportId: report.id, status: "actioned" });
                                    }}
                                  >
                                    <EyeOff className="h-4 w-4 mr-1" />
                                    Hide
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateReportMutation.mutate({ reportId: report.id, status: "dismissed" })}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Dismiss
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
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
