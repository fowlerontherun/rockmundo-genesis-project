import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  reportSocialTarget,
  socialReportCategoryLabels,
  type SocialReportCategory,
  type SocialReportTargetType,
} from "@/features/social-safety/services/socialSafety";

const categoryOptions = Object.entries(socialReportCategoryLabels) as Array<[SocialReportCategory, string]>;

interface ReportSocialTargetDialogProps {
  reportedProfileId?: string | null;
  targetType: SocialReportTargetType;
  targetId?: string | null;
  triggerLabel?: string;
  context?: Record<string, unknown>;
}

export function ReportSocialTargetDialog({
  reportedProfileId = null,
  targetType,
  targetId = null,
  triggerLabel = "Report",
  context = {},
}: ReportSocialTargetDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SocialReportCategory>("harassment");
  const [reason, setReason] = useState("");

  const report = useMutation({
    mutationFn: () =>
      reportSocialTarget({
        reportedProfileId,
        targetType,
        targetId,
        category,
        reason,
        context,
      }),
    onSuccess: () => {
      toast.success("Report submitted for moderator review");
      setReason("");
      setCategory("harassment");
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not submit this report"),
  });

  const validReason = reason.trim().length >= 10 && reason.trim().length <= 2000;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
        >
          <Flag className="mr-1 h-3 w-3" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
          <DialogDescription>
            Moderators receive a server-captured snapshot of the reported content, so it can still be reviewed if it changes later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as SocialReportCategory)} disabled={report.isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`report-${targetType}-${targetId ?? reportedProfileId ?? "target"}`}>What happened?</Label>
            <Textarea
              id={`report-${targetType}-${targetId ?? reportedProfileId ?? "target"}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={2000}
              disabled={report.isPending}
              placeholder="Give moderators enough context to understand the issue."
            />
            <p className="text-xs text-muted-foreground">{reason.trim().length}/2000 characters · minimum 10</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={report.isPending}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => report.mutate()} disabled={!validReason || report.isPending}>
              {report.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
