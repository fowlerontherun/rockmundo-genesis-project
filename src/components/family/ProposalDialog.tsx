import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart } from "lucide-react";

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  onPropose: (weddingDate?: string) => void;
  isPending: boolean;
}

export function ProposalDialog({ open, onOpenChange, partnerName, onPropose, isPending }: ProposalDialogProps) {
  const [weddingDate, setWeddingDate] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-social-love" />
            Propose to {partnerName}
          </DialogTitle>
          <DialogDescription>
            Send a marriage proposal. Your partner will need to accept before the wedding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="wedding-date" className="text-sm">Wedding Date (optional)</Label>
            <Input
              id="wedding-date"
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onPropose(weddingDate || undefined)}
            disabled={isPending}
            className="bg-social-love hover:bg-social-love/90 text-white"
          >
            💍 Propose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
