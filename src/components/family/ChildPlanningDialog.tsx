import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Baby, AlertCircle, Heart, HandHeart } from "lucide-react";
import { cn } from "@/lib/utils";

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
    pathway: "biological" | "adoption";
    agency?: string;
    applicationFeeCents?: number;
  }) => void;
  isPending: boolean;
}

const ADOPTION_AGENCIES = [
  { value: "local", label: "Local Agency", fee: 50000 },
  { value: "national", label: "National Agency", fee: 150000 },
  { value: "international", label: "International Agency", fee: 350000 },
];

export function ChildPlanningDialog({
  open, onOpenChange, parentAName, parentBName,
  parentAId, parentBId, marriageId,
  canCreateChild, onSubmit, isPending,
}: ChildPlanningDialogProps) {
  const [pathway, setPathway] = useState<"biological" | "adoption">("biological");
  const [controller, setController] = useState(parentAId);
  const [surnamePolicy, setSurnamePolicy] = useState("parent_a");
  const [customSurname, setCustomSurname] = useState("");
  const [upbringing, setUpbringing] = useState("balanced");
  const [agency, setAgency] = useState("local");

  const selectedAgency = ADOPTION_AGENCIES.find(a => a.value === agency);

  const handleSubmit = () => {
    onSubmit({
      controllerParentId: controller,
      surnamePolicy,
      customSurname: surnamePolicy === "custom" ? customSurname : undefined,
      upbringingFocus: upbringing,
      pathway,
      agency: pathway === "adoption" ? agency : undefined,
      applicationFeeCents: pathway === "adoption" ? selectedAgency?.fee : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
            {/* Pathway Selector */}
            <div>
              <Label className="text-sm">Pathway</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setPathway("biological")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all",
                    pathway === "biological"
                      ? "border-social-loyalty bg-social-loyalty/10 text-social-loyalty"
                      : "border-border/50 hover:border-border text-muted-foreground"
                  )}
                >
                  <Heart className="h-5 w-5" />
                  <span className="font-semibold">Biological</span>
                  <span className="text-[10px] opacity-70">7-day gestation</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPathway("adoption")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all",
                    pathway === "adoption"
                      ? "border-social-chemistry bg-social-chemistry/10 text-social-chemistry"
                      : "border-border/50 hover:border-border text-muted-foreground"
                  )}
                >
                  <HandHeart className="h-5 w-5" />
                  <span className="font-semibold">Adoption</span>
                  <span className="text-[10px] opacity-70">Variable wait</span>
                </button>
              </div>
            </div>

            {/* Adoption agency */}
            {pathway === "adoption" && (
              <div>
                <Label className="text-sm">Adoption Agency</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Higher tiers expand pool & age options</p>
                <Select value={agency} onValueChange={setAgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADOPTION_AGENCIES.map(a => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label} — ${(a.fee / 100).toLocaleString()} fee
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                {pathway === "biological" ? (
                  <><strong>Gestation:</strong> 7 in-game days after your partner accepts. The child will start as an NPC and become playable at age 16.</>
                ) : (
                  <><strong>Adoption:</strong> Once approved, the agency matches you with a child. Adopted children may start older with developed traits but lower inherited potentials.</>
                )}
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
            {pathway === "biological" ? <Baby className="h-4 w-4 mr-1" /> : <HandHeart className="h-4 w-4 mr-1" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
