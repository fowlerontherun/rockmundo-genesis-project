import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flag, AlertTriangle } from "lucide-react";
import { useTwaaterModeration } from "@/hooks/useTwaaterModeration";

interface TwaatReportDialogProps {
  twaatId: string;
  accountId: string;
  viewerAccountId: string;
}

export const TwaatReportDialog = ({
  twaatId,
  accountId,
  viewerAccountId,
  asMenuItem = false,
}: TwaatReportDialogProps & { asMenuItem?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<
    "spam" | "harassment" | "inappropriate" | "misinformation" | "other"
  >("spam");
  const [details, setDetails] = useState("");
  const { reportTwaat, isReporting } = useTwaaterModeration(viewerAccountId);

  const handleSubmit = () => {
    reportTwaat(
      {
        twaatId,
        reporterAccountId: viewerAccountId,
        reason,
        details: details.trim() || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setDetails("");
          setReason("spam");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asMenuItem ? (
          <div className="flex items-center w-full cursor-pointer px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
            <Flag className="h-4 w-4 mr-2" />
            Report post
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            <Flag className="h-4 w-4 mr-1" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Report this post
          </DialogTitle>
          <DialogDescription>
            Help us keep Twaater safe by reporting content that violates our community
            guidelines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Why are you reporting this post?</Label>
            <RadioGroup value={reason} onValueChange={(value: any) => setReason(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="spam" id="spam" />
                <Label htmlFor="spam" className="font-normal cursor-pointer">
                  Spam or misleading content
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="harassment" id="harassment" />
                <Label htmlFor="harassment" className="font-normal cursor-pointer">
                  Harassment or bullying
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inappropriate" id="inappropriate" />
                <Label htmlFor="inappropriate" className="font-normal cursor-pointer">
                  Inappropriate or offensive content
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="misinformation" id="misinformation" />
                <Label htmlFor="misinformation" className="font-normal cursor-pointer">
                  False information
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other" className="font-normal cursor-pointer">
                  Other
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              placeholder="Provide any additional context about this report..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{details.length}/500</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isReporting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isReporting} variant="destructive">
            {isReporting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
