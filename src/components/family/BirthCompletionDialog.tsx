import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Baby, Sparkles } from "lucide-react";
import type { ChildRequest } from "@/hooks/useChildPlanning";

interface BirthCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ChildRequest;
  surname: string;
  onComplete: (name: string) => void;
  isPending: boolean;
}

export function BirthCompletionDialog({
  open,
  onOpenChange,
  request,
  surname,
  onComplete,
  isPending,
}: BirthCompletionDialogProps) {
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-social-loyalty" />
            Your Child Has Arrived! 🎉
          </DialogTitle>
          <DialogDescription>
            The wait period is complete. Name your child to welcome them into the family.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="child-name" className="text-sm font-medium">First Name</Label>
            <Input
              id="child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Enter your child's name"
              className="mt-1"
              autoFocus
            />
            {surname && (
              <p className="text-xs text-muted-foreground mt-1">
                Full name: <span className="font-medium">{name || "..."} {surname}</span>
              </p>
            )}
          </div>

          <div className="rounded-lg border border-social-chemistry/30 bg-social-chemistry/5 p-3 space-y-1">
            <p className="text-xs font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Inherited potential
            </p>
            <p className="text-xs text-muted-foreground">
              Potential is calculated securely from both parents' real skill profiles and the agreed {request.upbringing_focus} upbringing focus. It affects future growth potential rather than granting immediate skill levels.
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">
              Your child starts as an <strong>NPC</strong>, moves into guided development from age 6, and can be converted into a playable character from age 18.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Later</Button>
          <Button
            onClick={() => onComplete(name)}
            disabled={isPending || !name.trim()}
            className="bg-social-loyalty hover:bg-social-loyalty/90 text-white"
          >
            <Baby className="h-4 w-4 mr-1" /> Welcome {name || "Baby"} 🎉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
