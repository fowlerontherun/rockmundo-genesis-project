import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatDistanceToNow, format, isPast } from "date-fns";
import {
  Radio, Mic, Music, Clock, CheckCircle, XCircle, 
  Star, Users, MapPin, Calendar, Award, Zap, Gift,
  Headphones, TrendingUp
} from "lucide-react";

interface RadioInvitation {
  id: string;
  station_id: string;
  band_id: string;
  invitation_type: "interview" | "live_lounge" | "guest_dj";
  status: "pending" | "accepted" | "declined" | "completed" | "expired";
  scheduled_at: string | null;
  expires_at: string | null;
  fame_reward: number;
  fan_reward: number;
  xp_reward: number;
  show_id: string | null;
  created_at: string;
  responded_at: string | null;
  completed_at: string | null;
  station?: {
    id: string;
    name: string;
    country: string;
    listener_base: number;
    station_type: string;
  };
  show?: {
    id: string;
    show_name: string;
    host_name: string;
  };
}

interface RadioInvitationsProps {
  bandId: string;
}

const invitationTypeConfig = {
  interview: {
    icon: Mic,
    label: "Interview",
    description: "Discuss your music and career on air",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  live_lounge: {
    icon: Music,
    label: "Live Session",
    description: "Perform live on the radio",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  guest_dj: {
    icon: Headphones,
    label: "Guest DJ",
    description: "Take over the station for a set",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
};

export function RadioInvitations({ bandId }: RadioInvitationsProps) {
  const queryClient = useQueryClient();
  const [selectedInvitation, setSelectedInvitation] = useState<RadioInvitation | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"accept" | "decline" | null>(null);

  // Fetch invitations for the band
  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["radio-invitations", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_invitations")
        .select(`
          *,
          station:radio_stations(id, name, country, listener_base, station_type),
          show:radio_shows(id, show_name, host_name)
        `)
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as RadioInvitation[];
    },
    enabled: !!bandId,
    staleTime: 2 * 60 * 1000,
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("radio_invitations")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radio-invitations", bandId] });
      toast.success("Invitation accepted!", {
        description: "Check your schedule for the upcoming session.",
      });
      setConfirmDialogOpen(false);
      setSelectedInvitation(null);
    },
    onError: (error: any) => {
      toast.error("Failed to accept invitation", { description: error.message });
    },
  });

  // Decline invitation mutation
  const declineMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("radio_invitations")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radio-invitations", bandId] });
      toast.info("Invitation declined");
      setConfirmDialogOpen(false);
      setSelectedInvitation(null);
    },
    onError: (error: any) => {
      toast.error("Failed to decline invitation", { description: error.message });
    },
  });

  // Complete invitation (simulate the session completion)
  const completeMutation = useMutation({
    mutationFn: async (invitation: RadioInvitation) => {
      // Update invitation status
      const { error: updateError } = await supabase
        .from("radio_invitations")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (updateError) throw updateError;

      // Award fame and fans to the band
      const { error: bandError } = await supabase
        .from("bands")
        .update({
          fame: supabase.rpc ? undefined : invitation.fame_reward, // Will use RPC instead
          total_fans: supabase.rpc ? undefined : invitation.fan_reward,
        })
        .eq("id", bandId);

      // Add country fame
      if (invitation.station?.country) {
        await supabase.rpc("add_band_country_fame", {
          p_band_id: bandId,
          p_country: invitation.station.country,
          p_fame_amount: invitation.fame_reward,
          p_fans_amount: invitation.fan_reward,
        });
      }

      return { invitation };
    },
    onSuccess: ({ invitation }) => {
      queryClient.invalidateQueries({ queryKey: ["radio-invitations", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band"] });
      toast.success("Session completed!", {
        description: `Earned ${invitation.fame_reward} fame and ${invitation.fan_reward} fans!`,
      });
    },
    onError: (error: any) => {
      toast.error("Failed to complete session", { description: error.message });
    },
  });

  const handleAction = (invitation: RadioInvitation, action: "accept" | "decline") => {
    setSelectedInvitation(invitation);
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };

  const confirmActionHandler = () => {
    if (!selectedInvitation || !confirmAction) return;
    
    if (confirmAction === "accept") {
      acceptMutation.mutate(selectedInvitation.id);
    } else {
      declineMutation.mutate(selectedInvitation.id);
    }
  };

  // Separate invitations by status
  const pendingInvitations = invitations.filter(i => i.status === "pending" && (!i.expires_at || !isPast(new Date(i.expires_at))));
  const acceptedInvitations = invitations.filter(i => i.status === "accepted");
  const completedInvitations = invitations.filter(i => i.status === "completed");
  const expiredOrDeclined = invitations.filter(i => 
    i.status === "declined" || 
    i.status === "expired" || 
    (i.status === "pending" && i.expires_at && isPast(new Date(i.expires_at)))
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Radio Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Invitations */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              New Invitations
              {pendingInvitations.length > 0 && (
                <Badge variant="default" className="ml-2">{pendingInvitations.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Radio stations want you on their shows!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Radio className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No pending invitations</p>
                <p className="text-sm">Build your fame to attract station invites</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <InvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    onAccept={() => handleAction(invitation, "accept")}
                    onDecline={() => handleAction(invitation, "decline")}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accepted (Upcoming) */}
        {acceptedInvitations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-500" />
                Upcoming Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {acceptedInvitations.map((invitation) => (
                  <AcceptedInvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    onComplete={() => completeMutation.mutate(invitation)}
                    isCompleting={completeMutation.isPending}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed */}
        {completedInvitations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                Completed Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {completedInvitations.slice(0, 10).map((invitation) => (
                    <CompletedInvitationRow key={invitation.id} invitation={invitation} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "accept" ? "Accept Invitation?" : "Decline Invitation?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "accept" 
                ? "You'll be scheduled for this radio session."
                : "Are you sure you want to decline this invitation?"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvitation && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={`p-2 rounded-lg ${invitationTypeConfig[selectedInvitation.invitation_type].bgColor}`}>
                  {(() => {
                    const Icon = invitationTypeConfig[selectedInvitation.invitation_type].icon;
                    return <Icon className={`h-5 w-5 ${invitationTypeConfig[selectedInvitation.invitation_type].color}`} />;
                  })()}
                </div>
                <div>
                  <p className="font-medium">{selectedInvitation.station?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {invitationTypeConfig[selectedInvitation.invitation_type].label}
                  </p>
                </div>
              </div>
              
              {confirmAction === "accept" && (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <p className="text-lg font-bold text-primary">+{selectedInvitation.fame_reward}</p>
                    <p className="text-xs text-muted-foreground">Fame</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <p className="text-lg font-bold text-emerald-500">+{selectedInvitation.fan_reward}</p>
                    <p className="text-xs text-muted-foreground">Fans</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <p className="text-lg font-bold text-amber-500">+{selectedInvitation.xp_reward}</p>
                    <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === "accept" ? "default" : "destructive"}
              onClick={confirmActionHandler}
              disabled={acceptMutation.isPending || declineMutation.isPending}
            >
              {confirmAction === "accept" ? "Accept" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Sub-components
function InvitationCard({ 
  invitation, 
  onAccept, 
  onDecline 
}: { 
  invitation: RadioInvitation; 
  onAccept: () => void; 
  onDecline: () => void;
}) {
  const config = invitationTypeConfig[invitation.invitation_type];
  const Icon = config.icon;
  const expiresIn = invitation.expires_at 
    ? formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })
    : null;

  return (
    <div className="rounded-lg border p-4 hover:bg-accent/30 transition-colors">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${config.bgColor} shrink-0`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{invitation.station?.name}</span>
              <Badge variant="outline" className="text-xs">
                {config.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {config.description}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {invitation.station?.country}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {invitation.station?.listener_base.toLocaleString()} listeners
              </span>
              {invitation.show?.show_name && (
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3" />
                  {invitation.show.show_name}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 shrink-0">
          {/* Rewards preview */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3 text-primary" />
              +{invitation.fame_reward}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3 text-emerald-500" />
              +{invitation.fan_reward}
            </Badge>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onDecline}>
              Decline
            </Button>
            <Button size="sm" onClick={onAccept}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Accept
            </Button>
          </div>
          
          {expiresIn && (
            <p className="text-xs text-muted-foreground text-right">
              <Clock className="h-3 w-3 inline mr-1" />
              Expires {expiresIn}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AcceptedInvitationCard({ 
  invitation,
  onComplete,
  isCompleting,
}: { 
  invitation: RadioInvitation;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  const config = invitationTypeConfig[invitation.invitation_type];
  const Icon = config.icon;
  const scheduledDate = invitation.scheduled_at 
    ? format(new Date(invitation.scheduled_at), "PPp")
    : "To be scheduled";

  // Check if session can be completed (simulated - in real game would be time-based)
  const canComplete = invitation.status === "accepted";

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{invitation.station?.name}</span>
              <Badge className="bg-emerald-500 text-xs">Scheduled</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {config.label} • {scheduledDate}
            </p>
          </div>
        </div>
        
        <Button 
          onClick={onComplete} 
          disabled={!canComplete || isCompleting}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          <Zap className="h-4 w-4 mr-1" />
          {isCompleting ? "Completing..." : "Complete Session"}
        </Button>
      </div>

      {/* Rewards to earn */}
      <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <span className="font-bold text-primary">+{invitation.fame_reward}</span>
          <span className="text-muted-foreground ml-1">fame</span>
        </div>
        <div>
          <span className="font-bold text-emerald-500">+{invitation.fan_reward}</span>
          <span className="text-muted-foreground ml-1">fans</span>
        </div>
        <div>
          <span className="font-bold text-amber-500">+{invitation.xp_reward}</span>
          <span className="text-muted-foreground ml-1">XP</span>
        </div>
      </div>
    </div>
  );
}

function CompletedInvitationRow({ invitation }: { invitation: RadioInvitation }) {
  const config = invitationTypeConfig[invitation.invitation_type];
  const Icon = config.icon;
  const completedDate = invitation.completed_at 
    ? formatDistanceToNow(new Date(invitation.completed_at), { addSuffix: true })
    : "";

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
      <Icon className={`h-4 w-4 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{invitation.station?.name}</p>
        <p className="text-xs text-muted-foreground">{completedDate}</p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-primary">+{invitation.fame_reward}</span>
        <span className="text-emerald-500">+{invitation.fan_reward}</span>
      </div>
    </div>
  );
}
