import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TermsOfServiceContent, TERMS_VERSION } from "./TermsOfServiceContent";

interface TermsDialogProps {
  trigger?: React.ReactNode;
  triggerText?: string;
}

export const TermsDialog = ({ trigger, triggerText = "Terms of Service" }: TermsDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button 
            type="button"
            className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            {triggerText}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Please review Rockmundo's terms regarding AI-generated music ownership.
          </DialogDescription>
        </DialogHeader>
        <TermsOfServiceContent />
      </DialogContent>
    </Dialog>
  );
};

export { TERMS_VERSION };
