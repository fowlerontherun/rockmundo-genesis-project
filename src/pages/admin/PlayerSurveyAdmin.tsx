import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminRoute } from "@/components/AdminRoute";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { ClipboardList, BarChart3, Users, MessageSquare } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  gameplay: "Gameplay",
  music: "Music & Production",
  social: "Social & Community",
  economy: "Economy & Balance",
  ui: "UI & Experience",
  content: "Content",
  performance: "Performance",
  progression: "Progression",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

export default function PlayerSurveyAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Config
  const { data: config } = useQuery({
    queryKey: ["admin-survey-config"],
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_config")
        .select("config_value")
        .eq("config_key", "player_survey_enabled")
        .maybeSingle();
      if (error) {
        console.error("Failed to load survey config:", error);
        throw error;
      }
      if (!data?.config_value) return { enabled: false, round: "2026-03", questions_per_session: 10 };
      const val = typeof data.config_value === "string"
        ? JSON.parse(data.config_value)
        : data.config_value;
      return val;
    },
  });

  const [localRound, setLocalRound] = useState("");

  const invalidateSurveyKeys = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-survey-config"] });
    queryClient.invalidateQueries({ queryKey: ["survey-config"] });
  };

  const toggleMutation = useMutation({
    mutationFn: async (newEnabled: boolean) => {
      const updated = { ...(config || { round: "2026-03", questions_per_session: 10 }), enabled: newEnabled };
      const { error } = await supabase
        .from("game_config")
        .upsert(
          { config_key: "player_survey_enabled", config_value: updated as any, updated_at: new Date().toISOString() },
          { onConflict: "config_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateSurveyKeys();
      toast({ title: "Survey toggled" });
    },
    onError: (err) => {
      toast({ title: "Failed to toggle survey", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateRoundMutation = useMutation({
    mutationFn: async (round: string) => {
      const updated = { ...(config || { enabled: false, questions_per_session: 10 }), round };
      const { error } = await supabase
        .from("game_config")
        .upsert(
          { config_key: "player_survey_enabled", config_value: updated as any, updated_at: new Date().toISOString() },
          { onConflict: "config_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateSurveyKeys();
      toast({ title: "Round updated" });
    },
    onError: (err) => {
      toast({ title: "Failed to update round", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  // Questions
  const { data: questions } = useQuery({
    queryKey: ["admin-survey-questions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_survey_questions")
        .select("*")
        .order("display_order");
      return data || [];
    },
  });

  // Completions count
  const { data: completions } = useQuery({
    queryKey: ["admin-survey-completions", config?.round],
    enabled: !!config?.round,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_survey_completions")
        .select("id, user_id, completed_at")
        .eq("survey_round", config!.round);
      return data || [];
    },
  });

  // All responses for current round
  const { data: responses } = useQuery({
    queryKey: ["admin-survey-responses", config?.round],
    enabled: !!config?.round,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_survey_responses")
        .select("*, player_survey_questions(question_text, question_type, category, options)")
        .eq("survey_round", config!.round);
      return data || [];
    },
  });

  // Total unique respondents
  const { data: totalRespondents } = useQuery({
    queryKey: ["admin-survey-respondents", config?.round],
    enabled: !!config?.round,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_survey_responses")
        .select("user_id")
        .eq("survey_round", config!.round);
      const unique = new Set((data || []).map((r: any) => r.user_id));
      return unique.size;
    },
  });

  // Build rating chart data
  const ratingData = (() => {
    if (!responses || !questions) return [];
    const ratingQs = questions.filter((q: any) => q.question_type === "rating_1_5" && q.is_active);
    return ratingQs.map((q: any) => {
      const qResponses = responses.filter((r: any) => r.question_id === q.id && r.answer_numeric);
      const avg = qResponses.length > 0
        ? qResponses.reduce((sum: number, r: any) => sum + (r.answer_numeric || 0), 0) / qResponses.length
        : 0;
      return {
        question: q.question_text.length > 40 ? q.question_text.slice(0, 37) + "..." : q.question_text,
        average: Math.round(avg * 100) / 100,
        responses: qResponses.length,
        category: q.category,
      };
    });
  })();

  // Build MC pie data per question
  const mcQuestions = questions?.filter((q: any) => q.question_type === "multiple_choice" && q.is_active) || [];

  const getMcData = (questionId: string) => {
    if (!responses) return [];
    const qResponses = responses.filter((r: any) => r.question_id === questionId && r.answer_value);
    const counts: Record<string, number> = {};
    qResponses.forEach((r: any) => { counts[r.answer_value] = (counts[r.answer_value] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  // Free text responses
  const freeTextResponses = responses?.filter(
    (r: any) => r.player_survey_questions?.question_type === "free_text" && r.answer_value
  ) || [];

  // Yes/No data
  const ynQuestions = questions?.filter((q: any) => q.question_type === "yes_no" && q.is_active) || [];
  const getYnData = (questionId: string) => {
    if (!responses) return [];
    const qResponses = responses.filter((r: any) => r.question_id === questionId && r.answer_value);
    const yes = qResponses.filter((r: any) => r.answer_value === "Yes").length;
    const no = qResponses.filter((r: any) => r.answer_value === "No").length;
    return [{ name: "Yes", value: yes }, { name: "No", value: no }];
  };

  return (
    <AdminRoute>
      <PageLayout>
        <PageHeader title="Player Survey" subtitle="Manage player feedback surveys and view results" />

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="settings" className="text-xs gap-1"><ClipboardList className="h-3.5 w-3.5" />Settings</TabsTrigger>
            <TabsTrigger value="ratings" className="text-xs gap-1"><BarChart3 className="h-3.5 w-3.5" />Ratings</TabsTrigger>
            <TabsTrigger value="choices" className="text-xs gap-1"><Users className="h-3.5 w-3.5" />Choices</TabsTrigger>
            <TabsTrigger value="freetext" className="text-xs gap-1"><MessageSquare className="h-3.5 w-3.5" />Free Text</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Survey Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Survey Enabled</Label>
                  <Switch
                    checked={config?.enabled || false}
                    onCheckedChange={(v) => toggleMutation.mutate(v)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>Current Round</Label>
                  <Input
                    value={localRound || config?.round || ""}
                    onChange={(e) => setLocalRound(e.target.value)}
                    placeholder="e.g. 2026-03"
                    className="max-w-[200px]"
                  />
                  <Button
                    size="sm"
                    onClick={() => updateRoundMutation.mutate(localRound || config?.round || "")}
                    disabled={updateRoundMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{completions?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Completions</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{totalRespondents || 0}</p>
                      <p className="text-xs text-muted-foreground">Unique Respondents</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Questions ({questions?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(questions || []).map((q: any) => (
                        <TableRow key={q.id}>
                          <TableCell className="text-xs">{q.display_order}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_LABELS[q.category] || q.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{q.question_text}</TableCell>
                          <TableCell className="text-xs">{q.question_type}</TableCell>
                          <TableCell>
                            <Badge variant={q.is_active ? "default" : "secondary"} className="text-xs">
                              {q.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ratings Tab */}
          <TabsContent value="ratings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Ratings by Question</CardTitle>
              </CardHeader>
              <CardContent>
                {ratingData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(300, ratingData.length * 40)}>
                    <BarChart data={ratingData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 5]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis dataKey="question" type="category" width={150} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number, name: string) => [value.toFixed(2), "Avg Rating"]}
                        labelFormatter={(label) => label}
                      />
                      <Bar dataKey="average" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No rating responses yet</p>
                )}
              </CardContent>
            </Card>

            {/* Yes/No Charts */}
            {ynQuestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Yes/No Responses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ynQuestions.map((q: any) => {
                      const data = getYnData(q.id);
                      const total = data.reduce((s, d) => s + d.value, 0);
                      if (total === 0) return null;
                      return (
                        <div key={q.id} className="space-y-2">
                          <p className="text-xs font-medium text-foreground">{q.question_text}</p>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                                {data.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Legend />
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Choices Tab */}
          <TabsContent value="choices" className="space-y-4">
            {mcQuestions.map((q: any) => {
              const data = getMcData(q.id);
              if (data.length === 0) return null;
              return (
                <Card key={q.id}>
                  <CardHeader>
                    <CardTitle className="text-sm">{q.question_text}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                          {data.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })}
            {mcQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No multiple choice responses yet</p>
            )}
          </TabsContent>

          {/* Free Text Tab */}
          <TabsContent value="freetext">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Free Text Responses ({freeTextResponses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {freeTextResponses.length > 0 ? (
                    <div className="space-y-3">
                      {freeTextResponses.map((r: any) => (
                        <div key={r.id} className="border border-border rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            {r.player_survey_questions?.question_text}
                          </p>
                          <p className="text-sm text-foreground">{r.answer_value}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No free text responses yet</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AdminRoute>
  );
}