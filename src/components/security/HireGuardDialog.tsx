import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useHireGuard } from "@/hooks/useSecurityFirm";
import { UserPlus } from "lucide-react";

interface HireGuardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firmId: string;
}

const SKILL_LEVELS = [
  { level: 1, name: "Rookie", baseSalary: 50 },
  { level: 2, name: "Trainee", baseSalary: 75 },
  { level: 3, name: "Junior", baseSalary: 100 },
  { level: 4, name: "Standard", baseSalary: 150 },
  { level: 5, name: "Experienced", baseSalary: 200 },
  { level: 6, name: "Senior", baseSalary: 300 },
  { level: 7, name: "Expert", baseSalary: 450 },
  { level: 8, name: "Elite", baseSalary: 600 },
  { level: 9, name: "Master", baseSalary: 800 },
  { level: 10, name: "Legend", baseSalary: 1000 },
];

export const HireGuardDialog = ({
  open,
  onOpenChange,
  firmId,
}: HireGuardDialogProps) => {
  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState(3);
  const hireGuard = useHireGuard();

  const currentSkill = SKILL_LEVELS.find(s => s.level === skillLevel) || SKILL_LEVELS[2];
  const salary = currentSkill.baseSalary;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await hireGuard.mutateAsync({
      firmId,
      name: name.trim(),
      skillLevel,
      salaryPerEvent: salary,
    });
    
    setName("");
    setSkillLevel(3);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Hire Security Guard
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guard-name">Guard Name</Label>
            <Input
              id="guard-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Skill Level</Label>
              <span className="text-sm font-medium text-primary">
                {currentSkill.name} (Level {skillLevel})
              </span>
            </div>
            <Slider
              value={[skillLevel]}
              onValueChange={(v) => setSkillLevel(v[0])}
              min={1}
              max={10}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Higher skill guards handle larger crowds and difficult situations better.
            </p>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Salary per event:</span>
              <span className="font-semibold">${salary.toLocaleString()}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={hireGuard.isPending || !name.trim()}>
              {hireGuard.isPending ? "Hiring..." : "Hire Guard"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
