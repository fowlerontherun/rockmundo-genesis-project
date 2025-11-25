import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PHASES = ["SubmissionsOpen", "SelectionsDone", "EventLive", "VotingClosed", "Results"];

function EurovisionAdmin() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    phase: "SubmissionsOpen",
  });

  const { data: years = [] } = useQuery({
    queryKey: ["eurovision-years"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eurovision_years")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["eurovision-submissions", selectedYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eurovision_submissions")
        .select("*")
        .eq("year", selectedYear)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedYear,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["eurovision-entries", selectedYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eurovision_entries")
        .select("*")
        .eq("year", selectedYear)
        .order("vote_total", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedYear,
  });

  const createYearMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eurovision_years")
        .insert({
          year: formData.year,
          phase: formData.phase,
          submission_window_open: formData.phase === "SubmissionsOpen",
        })
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-years"] });
      toast.success("Eurovision year created");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ year, phase }: { year: number; phase: string }) => {
      const response = await fetch(
        `https://yztogmdixmchsmimtent.supabase.co/functions/v1/eurovision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}`,
          },
          body: JSON.stringify({
            action: "advance-phase",
            year,
            forcePhase: phase,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update phase");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-years"] });
      queryClient.invalidateQueries({ queryKey: ["eurovision-entries"] });
      toast.success("Phase updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("eurovision_submissions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-submissions"] });
      toast.success("Submission deleted");
    },
  });

  const currentYearData = years.find((y) => y.year === selectedYear);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8" />
            Eurovision Administration
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage Eurovision years, phases, submissions, and entries
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Years</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{years.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Phase</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{currentYearData?.phase || "N/A"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{submissions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{entries.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Year */}
      <Card>
        <CardHeader>
          <CardTitle>Create Eurovision Year</CardTitle>
          <CardDescription>Initialize a new Eurovision season</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createYearMutation.mutate();
            }}
            className="flex gap-4 items-end"
          >
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Phase</Label>
              <Select value={formData.phase} onValueChange={(value) => setFormData({ ...formData, phase: value })}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASES.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createYearMutation.isPending}>
              Create Year
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Year Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Manage Years</CardTitle>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.year} value={year.year.toString()}>
                    {year.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentYearData && (
            <>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold">Current Phase: {currentYearData.phase}</p>
                  <p className="text-sm text-muted-foreground">
                    Submissions: {currentYearData.submission_window_open ? "Open" : "Closed"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {PHASES.map((phase) => (
                    <Button
                      key={phase}
                      size="sm"
                      variant={currentYearData.phase === phase ? "default" : "outline"}
                      onClick={() => updatePhaseMutation.mutate({ year: selectedYear, phase })}
                      disabled={updatePhaseMutation.isPending}
                    >
                      {phase}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Submissions ({submissions.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead>Song</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((sub: any) => (
                      <TableRow key={sub.id}>
                        <TableCell>{sub.country_code}</TableCell>
                        <TableCell>{sub.artist_name}</TableCell>
                        <TableCell>{sub.song_title}</TableCell>
                        <TableCell>
                          <Badge variant={sub.status === "Selected" ? "default" : "secondary"}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSubmissionMutation.mutate(sub.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Contest Entries ({entries.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead>Song</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Running Order</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry: any, idx: number) => (
                      <TableRow key={entry.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{entry.country_code}</TableCell>
                        <TableCell>{entry.artist_name}</TableCell>
                        <TableCell>{entry.song_title}</TableCell>
                        <TableCell>{entry.vote_total}</TableCell>
                        <TableCell>{entry.running_order || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EurovisionAdminPage() {
  return (
    <AdminRoute>
      <EurovisionAdmin />
    </AdminRoute>
  );
}
