import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import {
  BAND_APPLICATION_MESSAGE_MAX_LENGTH,
  BAND_APPLICATION_ROLES,
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

export function BandApplicationDialog({ bandId, bandName, profileId, onSubmitted }: BandApplicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [instrumentRole, setInstrumentRole] = useState("Guitar");
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const statusId = useId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const applyMutation = useMutation({
    mutationFn: async () => submitBandApplication(bandId, instrumentRole, message),
    onSuccess: (application) => {
      toast({ title: "Application Sent", description: `Your application to ${bandName} has been submitted.` });
      queryClient.invalidateQueries({ queryKey: ["band-application", bandId, profileId] });
      queryClient.invalidateQueries({ queryKey: ["band-profile", bandId] });
      onSubmitted?.(application);
      setOpen(false);
      setMessage("");
      setValidationError(null);
    },
    onError: (error: any) => {
      const msg = error.message?.includes("duplicate") ? "You have already applied to this band." : error.message;
      setValidationError(msg || "Could not submit your application.");
      toast({ title: "Error", description: msg, variant: "destructive" });
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
  const isSubmitDisabled = applyMutation.isPending || !profileId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Apply to Join
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
          <div>
            <Label htmlFor="band-application-role">Instrument Role</Label>
            <Select value={instrumentRole} onValueChange={setInstrumentRole} disabled={applyMutation.isPending}>
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
              disabled={applyMutation.isPending}
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
  );
}
