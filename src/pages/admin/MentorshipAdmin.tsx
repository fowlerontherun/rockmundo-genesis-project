import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MentorshipAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: matches } = useQuery({
    queryKey: ["mentorship-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_mentorship_matches")
        .select(`
          *,
          mentor:mentor_profile_id(profile:profiles(username, display_name)),
          mentee:mentee_profile_id(username, display_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMatchStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("community_mentorship_matches")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorship-matches"] });
      toast({ title: "Match status updated" });
    },
  });

  const statusColors = {
    pending: "secondary",
    active: "default",
    completed: "outline",
    cancelled: "destructive",
  } as const;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mentorship Admin</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mentorship Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mentor</TableHead>
                <TableHead>Mentee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Match Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches?.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="font-medium">
                    {match.mentor?.profile?.display_name || match.mentor?.profile?.username || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {match.mentee?.display_name || match.mentee?.username || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[match.status as keyof typeof statusColors] || "secondary"}>
                      {match.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {match.match_date ? new Date(match.match_date).toLocaleDateString() : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {match.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateMatchStatus.mutate({ id: match.id, status: "active" })
                            }
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateMatchStatus.mutate({ id: match.id, status: "cancelled" })
                            }
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
