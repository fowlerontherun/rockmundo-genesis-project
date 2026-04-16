import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SalvagePanelProps {
  equipment: any[];
  onSalvage?: (equipmentId: string) => void;
}

export const SalvagePanel = ({ equipment, onSalvage }: SalvagePanelProps) => {
  if (!equipment || equipment.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No equipment available to salvage.</p>
        <p className="text-xs mt-1">Purchase or craft equipment first, then you can break it down for materials.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Salvage equipment to recover crafting materials. The item will be destroyed in the process.
      </p>
      {equipment.map((item: any) => (
        <Card key={item.id} className="border-border/50">
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">
                {item.equipment?.name || item.name || "Unknown Item"}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.equipment?.category || item.category || "gear"}
              </span>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (onSalvage) {
                  onSalvage(item.id);
                } else {
                  toast.info("Salvage coming soon!");
                }
              }}
              className="h-7 px-2"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Salvage
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
