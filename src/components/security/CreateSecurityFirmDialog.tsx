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
import { useCreateSecurityFirm } from "@/hooks/useSecurityFirm";
import { Shield } from "lucide-react";

interface CreateSecurityFirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export const CreateSecurityFirmDialog = ({
  open,
  onOpenChange,
  companyId,
}: CreateSecurityFirmDialogProps) => {
  const [name, setName] = useState("");
  const createFirm = useCreateSecurityFirm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createFirm.mutateAsync({ companyId, name: name.trim() });
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Create Security Firm
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firm-name">Firm Name</Label>
            <Input
              id="firm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Iron Shield Security"
              required
            />
          </div>

          <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
            <p className="font-medium">Starting Benefits:</p>
            <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
              <li>Basic License (venues up to 500 capacity)</li>
              <li>Up to 10 security guards</li>
              <li>Basic equipment quality</li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFirm.isPending || !name.trim()}>
              {createFirm.isPending ? "Creating..." : "Create Firm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
