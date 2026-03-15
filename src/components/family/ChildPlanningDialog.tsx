import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Baby, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ChildPlanningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentAName: string;
  parentBName: string;
  parentAId: string;
  parentBId: string;
  marriageId: string;
  canCreateChild: boolean;
  onSubmit: (params: {
    controllerParentId: string;
    surnamePolicy: string;
    customSurname?: string;
    upbringingFocus: string;
  }) => void;
  isPending: boolean;
}

export function ChildPlanningDialog({
  open, onOpenChange, parentAName, parentBName,
  parentAId, parentBId, marriageId,
  canCreateChild, onSubmit, isPending,
}: ChildPlanningDialogProps) {
  const [controller, setController] = useState(parentAId);
  const [surnamePolicy, setSurnamePolicy] = useState("parent_a");
  const [customSurname, setCustomSurname] = useState("");
  const [upbringing, setUpbringing] = useState("balanced");

  const handleSubmit = () => {
    onSubmit({
      controllerParentId: controller,
      surnamePolicy,
      customSurname: surnamePolicy === "custom" ? customSurname : undefined,
      upbringingFocus: upbringing,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-social-loyalty" />
            Plan a Child
          </DialogTitle>
          <DialogDescription>
            Both parents must agree. Your partner will receive a request to confirm.
          </DialogDescription>
        </DialogHeader>

        {!canCreateChild ? (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">No available character slots. Purchase more slots to have children.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Controlling Parent</Label>
              <p className="text-xs text-muted-foreground mb-1.5">This parent's player will manage the child character</p>
              <Select value={controller} onValueChange={setController}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={parentAId}>{parentAName} (You)</SelectItem>
                  <SelectItem value={parentBId}>{parentBName}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Surname Policy</Label>
              <Select value={surnamePolicy} onValueChange={setSurnamePolicy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent_a">{parentAName}'s Surname</SelectItem>
                  <SelectItem value="parent_b">{parentBName}'s Surname</SelectItem>
                  <SelectItem value="hyphenated">Hyphenated</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {surnamePolicy === "custom" && (
                <Input
                  value={customSurname}
                  onChange={(e) => setCustomSurname(e.target.value)}
                  placeholder="Enter custom surname"
                  className="mt-2"
                />
              )}
            </div>

            <div>
              <Label className="text-sm">Upbringing Focus</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Affects inherited skill potentials (±15%)</p>
              <Select value={upbringing} onValueChange={setUpbringing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="artistic">Artistic (+Songwriting, Creativity)</SelectItem>
                  <SelectItem value="academic">Academic (+Technical, Composition)</SelectItem>
                  <SelectItem value="athletic">Athletic (+Performance, Drums)</SelectItem>
                  <SelectItem value="social">Social (+Vocals, Performance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Gestation:</strong> 7 in-game days after your partner accepts.
                The child will start as an NPC and become playable at age 16.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !canCreateChild}
            className="bg-social-loyalty hover:bg-social-loyalty/90 text-white"
          >
            <Baby className="h-4 w-4 mr-1" /> Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
