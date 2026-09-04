import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, UserPlus } from "lucide-react";
import {
  BAND_APPLICATION_MESSAGE_MAX_LENGTH,
  BAND_APPLICATION_ROLES,
  DEFAULT_BAND_PERFORMANCE_ROLE,
  normalizeBandApplicationSubmissionInput,
  submitBandApplication,
  type BandApplicationResult,
} from "@/services/bandApplications";

interface BandApplicationDialogProps {
  bandId: string;
  bandName: string;
  profileId?: string;
  onSubmitted?: (application: BandApplicationResult) => void;
}

interface JoinEligibility {
  eligible: boolean;
  reason: string | null;
}

export function BandApplicationDialog({ bandId, bandName, profileId, onSubmitted }: BandApplicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [instrumentRole, setInstrumentRole] = useState(DEFAULT_BAND_PERFORMANCE_ROLE);
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const statusId = useId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: eligibility, isLoading: isEligibilityLoading, refetch: refetchEligibility } = useQuery<JoinEligibility>({
    queryKey: ["band-join-eligibility", profileId, bandId],
    queryFn: async () => {
      if (!profileId) {
        return { eligible: false, reason: "Select an active player character before applying to a band." };
      }

      const [{ data: targetBand, error: targetBandError }, { data: memberships, error: membershipError }] = await Promise.all([
        supabase
          .from("bands")
          .select("id, status, is_solo_artist, is_recruiting, allow_applications")
          .eq("id", bandId)
          .maybeSingle(),
        supabase
          .from("band_members")
          .select("band_id, bands:band_id(id, name, status, is_solo_artist)")
          .eq("profile_id", profileId)
          .eq("member_status", "active")
          .eq("is_touring_member", false),
      ]);

      if (targetBandError) throw targetBandError;
      if (membershipError) throw membershipError;

      if (!targetBand || targetBand.status !== "active") {
        return { eligible: false, reason: "This band is not currently active." };
      }
      if (targetBand.is_solo_artist) {
        return { eligible: false, reason: "This is a solo artist project and cannot accept regular band members." };
      }
      if (!targetBand.is_recruiting || targetBand.allow_applications === false) {
        return { eligible: false, reason: "This band is not currently accepting applications." };
      }

      const activeMembership = ((memberships || []) as any[]).find((membership: any) => membership.bands?.status === "active");
      if (activeMembership) {
        if (activeMembership.band_id === bandId) {
          return { eligible: false, reason: "You are already a member of this band." };
        }
        const currentBandName = activeMembership.bands?.name || "another active band";
        return {
          eligible: false,
          reason: `You are already an active member of ${currentBandName}. Leave that band or solo project before applying to another band.`,
        };
      }

      return { eligible: true, reason: null };
    },
    enabled: !!profileId && !!bandId,
    staleTime: 15_000,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const latestEligibility = await refetchEligibility();
      if (!latestEligibility.data?.eligible) {
        throw new Error(latestEligibility.data?.reason || "You are not currently eligible to join this band.");
      }
      return submitBandApplication(bandId, instrumentRole, message);
    },
    onSuccess: (application) => {
      toast({ title: "Application Sent", description: `Your application to ${bandName} has been submitted.` });
      queryClient.invalidateQueries({ queryKey: ["band-application", bandId, profileId] });
      queryClient.invalidateQueries({ queryKey: ["band-profile", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band-join-eligibility", profileId] });
      onSubmitted?.(application);
      setOpen(false);
      setMessage("");
      setValidationError(null);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "";
      const msg = errorMessage.includes("duplicate") ? "You have already applied to this band." : errorMessage;
      setValidationError(msg || "Could not submit your application.");
      toast({ title: "Unable to apply", description: msg || "Could not submit your application.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    try {
      normalizeBandApplicationSubmissionInput(bandId, instrumentRole, message);
      setValidationError(null);
      applyMutation.mutate();
    } catch (error) {
      const description = error instanceof Error ? error.message : "Check your application and try again.";
      setValidationError(description);
      toast({ title: "Check Application", description, variant: "destructive" });
    }
  };

  const messageLength = message.trim().length;
  const eligibilityReason = eligibility?.reason || null;
  const isSubmitDisabled = applyMutation.isPending || isEligibilityLoading || !profileId || eligibility?.eligible === false;

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button disabled={isEligibilityLoading || eligibility?.eligible === false} title={eligibilityReason || undefined}>
            <UserPlus className="h-4 w-4 mr-2" />
            {isEligibilityLoading ? "Checking..." : "Apply to Join"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to Join {bandName}</DialogTitle>
            <DialogDescription>
              Send an application to the band leader. They will review and accept or reject it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {eligibilityReason && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{eligibilityReason}</span>
              </div>
            )}
            <div>
              <Label htmlFor="band-application-role">Instrument Role</Label>
              <Select value={instrumentRole} onValueChange={setInstrumentRole} disabled={applyMutation.isPending || eligibility?.eligible === false}>
                <SelectTrigger id="band-application-role" aria-label="Instrument role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BAND_APPLICATION_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="band-application-message">Message (optional)</Label>
              <Textarea
                id="band-application-message"
                placeholder="Tell the band why you'd be a great fit..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={BAND_APPLICATION_MESSAGE_MAX_LENGTH}
                disabled={applyMutation.isPending || eligibility?.eligible === false}
                aria-describedby={statusId}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {messageLength}/{BAND_APPLICATION_MESSAGE_MAX_LENGTH} characters. Plain text only.
              </p>
            </div>
            <div id={statusId} role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
              {applyMutation.isPending ? "Submitting your application…" : validationError}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={applyMutation.isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
              {applyMutation.isPending ? "Sending..." : "Send Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {eligibilityReason && (
        <p className="max-w-md text-xs text-muted-foreground" role="status">
          {eligibilityReason}
        </p>
      )}
    </div>
  );
}
