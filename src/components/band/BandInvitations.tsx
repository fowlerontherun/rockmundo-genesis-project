import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { respondBandInvitation } from "@/services/bandInvitations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { CheckCircle2, Mail, Users, XCircle } from "lucide-react";

interface BandInvitation {
  id: string;
  band_id: string;
  instrument_role: string;
  vocal_role: string | null;
  message: string | null;
  created_at: string;
  bands: {
    name: string;
    genre: string | null;
  };
}

export const BandInvitations = () => {
  const { userId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading } = useQuery({
    queryKey: ["band-invitations", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("band_invitations")
        .select(`
          id,
          band_id,
          instrument_role,
          vocal_role,
          message,
          created_at,
          bands(name, genre)
        `)
        .eq("invited_user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as BandInvitation[];
    },
    enabled: !!userId,
  });

  const responseMutation = useMutation({
    mutationFn: async ({ invitationId, status }: { invitationId: string; status: "accepted" | "declined" }) => {
      return respondBandInvitation(invitationId, status);
    },
    onSuccess: (invitation) => {
      const accepted = invitation.status === "accepted";
      toast({
        title: accepted ? "Invitation Accepted" : "Invitation Declined",
        description: accepted ? "You've successfully joined the band!" : "You've declined the band invitation.",
      });
      queryClient.invalidateQueries({ queryKey: ["band-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["band-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-bands"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Band invitation response failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Band Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userId) {
    return null;
  }

  if (!invitations || invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Band Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pending band invitations right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Band Invitations ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{invitation.bands.name}</span>
                  {invitation.bands.genre && (
                    <Badge variant="secondary">{invitation.bands.genre}</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Role: {invitation.instrument_role}
                  {invitation.vocal_role && ` / ${invitation.vocal_role}`}
                </div>
                {invitation.message && (
                  <p className="text-sm italic text-muted-foreground">
                    "{invitation.message}"
                  </p>
                )}
              </div>
              <div className="flex w-full gap-2 sm:w-auto" aria-label={`Respond to invitation from ${invitation.bands.name}`}>
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => responseMutation.mutate({ invitationId: invitation.id, status: "accepted" })}
                  disabled={responseMutation.isPending}
                  aria-label={`Accept invitation from ${invitation.bands.name}`}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  {responseMutation.isPending ? "Saving..." : "Accept"}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  variant="outline"
                  onClick={() => responseMutation.mutate({ invitationId: invitation.id, status: "declined" })}
                  disabled={responseMutation.isPending}
                  aria-label={`Decline invitation from ${invitation.bands.name}`}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
