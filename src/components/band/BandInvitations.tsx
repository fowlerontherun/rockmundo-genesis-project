import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { Users, Mail } from "lucide-react";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading } = useQuery({
    queryKey: ["band-invitations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
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
        .eq("invited_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as BandInvitation[];
    },
    enabled: !!user?.id,
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const invitation = invitations?.find((i) => i.id === invitationId);
      if (!invitation || !user?.id) throw new Error("Invalid invitation");

      // Update invitation status
      const { error: inviteError } = await supabase
        .from("band_invitations")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      if (inviteError) throw inviteError;

      // Add member to band
      const { error: memberError } = await supabase
        .from("band_members")
        .insert({
          band_id: invitation.band_id,
          user_id: user.id,
          role: "member",
          instrument_role: invitation.instrument_role,
          vocal_role: invitation.vocal_role,
        });

      if (memberError) throw memberError;
    },
    onSuccess: () => {
      toast({
        title: "Invitation Accepted",
        description: "You've successfully joined the band!",
      });
      queryClient.invalidateQueries({ queryKey: ["band-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["band-members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("band_invitations")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Invitation Declined",
        description: "You've declined the band invitation.",
      });
      queryClient.invalidateQueries({ queryKey: ["band-invitations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!invitations || invitations.length === 0) {
    return null;
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
              className="flex items-start justify-between rounded-lg border bg-card p-4"
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => acceptInviteMutation.mutate(invitation.id)}
                  disabled={acceptInviteMutation.isPending}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => declineInviteMutation.mutate(invitation.id)}
                  disabled={declineInviteMutation.isPending}
                >
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
