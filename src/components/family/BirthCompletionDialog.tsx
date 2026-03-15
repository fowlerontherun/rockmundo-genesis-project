import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Baby, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChildRequest } from "@/hooks/useChildPlanning";

interface BirthCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ChildRequest;
  surname: string;
  inheritedPotentials: Record<string, number>;
  onComplete: (name: string) => void;
  isPending: boolean;
}

export function BirthCompletionDialog({
  open, onOpenChange, request, surname,
  inheritedPotentials, onComplete, isPending,
}: BirthCompletionDialogProps) {
  const [name, setName] = useState("");

  const topPotentials = Object.entries(inheritedPotentials)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-social-loyalty" />
            Your Child Has Arrived! 🎉
          </DialogTitle>
          <DialogDescription>
            The gestation period is complete. Name your newborn to welcome them into the world.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="child-name" className="text-sm font-medium">First Name</Label>
            <Input
              id="child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Inherited Potentials
            </p>
            <div className="flex flex-wrap gap-1.5">
              {topPotentials.map(([skill, value]) => (
                <Badge key={skill} variant="secondary" className="text-[10px]">
                  {skill.charAt(0).toUpperCase() + skill.slice(1)}: {value}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-social-chemistry/30 bg-social-chemistry/5 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Upbringing:</strong> {request.upbringing_focus.charAt(0).toUpperCase() + request.upbringing_focus.slice(1)}<br />
              Your child will start as an <strong>NPC</strong> and become playable at age 16.
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
