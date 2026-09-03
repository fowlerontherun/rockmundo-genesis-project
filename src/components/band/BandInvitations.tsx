import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { respondBandInvitation } from "@/services/bandInvitations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { AlertCircle, CheckCircle2, Mail, RefreshCw, Users, XCircle } from "lucide-react";

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
    status: string | null;
    is_solo_artist: boolean | null;
  };
}

interface ActiveMembership {
  band_id: string;
  bands: {
    name: string;
    status: string | null;
    is_solo_artist: boolean | null;
  } | null;
}

interface BandInvitationsProps {
  onMembershipChanged?: () => void | Promise<void>;
}

export const BandInvitations = ({ onMembershipChanged }: BandInvitationsProps) => {
  const { profileId, userId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["band-invitations", userId, profileId],
    queryFn: async () => {
      if (!userId || !profileId) return [];

      const { data, error } = await supabase
        .from("band_invitations")
        .select(`
          id,
          band_id,
          instrument_role,
          vocal_role,
          message,
          created_at,
          bands(name, genre, status, is_solo_artist)
        `)
        .eq("invited_user_id", userId)
        .or(`invited_profile_id.eq.${profileId},invited_profile_id.is.null`)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as BandInvitation[];
    },
    enabled: !!userId && !!profileId,
  });

  const { data: activeMembership, isLoading: isMembershipLoading } = useQuery<ActiveMembership | null>({
    queryKey: ["active-band-membership", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands:band_id(name, status, is_solo_artist)")
        .eq("profile_id", profileId)
        .eq("member_status", "active")
        .eq("is_touring_member", false);

      if (error) throw error;
      return ((data || []).find((membership: any) => membership.bands?.status === "active") || null) as ActiveMembership | null;
    },
    enabled: !!profileId,
    staleTime: 15_000,
  });

  const getAcceptanceBlockReason = (invitation: BandInvitation): string | null => {
    if (invitation.bands?.status !== "active") {
      return "This invitation is no longer valid because the band is not active.";
    }
    if (invitation.bands?.is_solo_artist) {
      return "This invitation is no longer valid because solo artist projects cannot add regular band members.";
    }
    if (activeMembership && activeMembership.band_id !== invitation.band_id) {
      const currentBandName = activeMembership.bands?.name || "another active band";
      return `You are already an active member of ${currentBandName}. Leave that band or solo project before accepting this invitation.`;
    }
    return null;
  };

  const responseMutation = useMutation({
    mutationFn: async ({ invitation, status }: { invitation: BandInvitation; status: "accepted" | "declined" }) => {
      if (status === "accepted") {
        const blockReason = getAcceptanceBlockReason(invitation);
        if (blockReason) throw new Error(blockReason);
      }
      return respondBandInvitation(invitation.id, status);
    },
    onSuccess: async (invitation) => {
      const accepted = invitation.status === "accepted";
      toast({
        title: accepted ? "Invitation Accepted" : "Invitation Declined",
        description: accepted ? "You've successfully joined the band!" : "You've declined the band invitation.",
      });
      queryClient.invalidateQueries({ queryKey: ["band-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["band-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-bands"] });
      queryClient.invalidateQueries({ queryKey: ["primary-band"] });
      queryClient.invalidateQueries({ queryKey: ["active-band-membership"] });
      queryClient.invalidateQueries({ queryKey: ["band-join-eligibility"] });
      if (accepted) await onMembershipChanged?.();
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

  if (!userId || !profileId) {
    return null;
  }

  if (isError) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Band Invitations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">
            {(error as Error)?.message || "Band invitations could not be loaded."}
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
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
          {invitations.map((invitation) => {
            const acceptanceBlockReason = getAcceptanceBlockReason(invitation);
            return (
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
                  {acceptanceBlockReason && (
                    <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive" role="alert">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{acceptanceBlockReason}</span>
                    </div>
                  )}
                </div>
                <div className="flex w-full gap-2 sm:w-auto" aria-label={`Respond to invitation from ${invitation.bands.name}`}>
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => responseMutation.mutate({ invitation, status: "accepted" })}
                    disabled={responseMutation.isPending || isMembershipLoading || !!acceptanceBlockReason}
                    aria-label={`Accept invitation from ${invitation.bands.name}`}
                    title={acceptanceBlockReason || undefined}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    {responseMutation.isPending ? "Saving..." : isMembershipLoading ? "Checking..." : "Accept"}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none"
                    variant="outline"
                    onClick={() => responseMutation.mutate({ invitation, status: "declined" })}
                    disabled={responseMutation.isPending}
                    aria-label={`Decline invitation from ${invitation.bands.name}`}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
