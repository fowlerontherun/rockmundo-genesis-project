import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Music, Plus, DollarSign, Wrench } from "lucide-react";
import { useRehearsalRoomEquipment, useAddRehearsalEquipment } from "@/hooks/useRehearsalStudioBusiness";
import { EQUIPMENT_TYPES } from "@/types/rehearsal-studio-business";
import { useSubsidiaryEquipmentCatalog, subsidiaryEquipmentHourlyRate, subsidiaryEquipmentDailyRate } from "@/hooks/useSubsidiaryEquipmentCatalog";

interface RehearsalStudioEquipmentManagerProps {
  roomId: string;
}

export function RehearsalStudioEquipmentManager({ roomId }: RehearsalStudioEquipmentManagerProps) {
  const { data: equipment, isLoading } = useRehearsalRoomEquipment(roomId);
  const addEquipment = useAddRehearsalEquipment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: catalog = [], isLoading: catalogLoading } = useSubsidiaryEquipmentCatalog("rehearsal_equipment");
  const [catalogId, setCatalogId] = useState("");
  const pendingPurchaseIds = useRef(new Map<string, string>());
  const selectedItem = catalog.find((item) => item.id === catalogId);

  const handleAdd = async () => {
    if (!selectedItem) return;
    const intentKey = `${roomId}:${selectedItem.id}`;
    let requestId = pendingPurchaseIds.current.get(intentKey);
    if (!requestId) {
      requestId = crypto.randomUUID();
      pendingPurchaseIds.current.set(intentKey, requestId);
    }
    await addEquipment.mutateAsync({
      room_id: roomId,
      catalog_id: selectedItem.id,
      request_id: requestId,
    });
    pendingPurchaseIds.current.delete(intentKey);
    setIsDialogOpen(false);
    setCatalogId("");
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'amp': return '🔊';
      case 'drums': return '🥁';
      case 'keyboard': return '🎹';
      case 'pa_system': return '🔉';
      case 'microphone': return '🎤';
      case 'recording_interface': return '🎛️';
      case 'effects_pedals': return '🎚️';
      default: return '🎵';
    }
  };

  const getConditionColor = (condition: number) => {
    if (condition >= 80) return 'text-green-500';
    if (condition >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Rental Equipment
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Purchase Rental Equipment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Equipment catalog</Label>
                  <Select value={catalogId} onValueChange={setCatalogId}>
                    <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                    <SelectContent>
                      {catalog.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · ${item.base_price.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {catalogLoading && <p className="text-xs text-muted-foreground">Loading available stock...</p>}
                  {!catalogLoading && catalog.length === 0 && (
                    <p className="text-xs text-muted-foreground">No supported equipment is currently in stock.</p>
                  )}
                </div>
                {selectedItem && (
                  <p className="text-sm text-muted-foreground">
                    Purchase cost: ${selectedItem.base_price.toLocaleString()} · Rental: ${subsidiaryEquipmentHourlyRate(selectedItem.base_price).toLocaleString()}/hour, ${subsidiaryEquipmentDailyRate(selectedItem.base_price).toLocaleString()}/day · Available: {selectedItem.stock_quantity}
                  </p>
                )}
                <Button
                  onClick={handleAdd}
                  className="w-full"
                  disabled={!selectedItem || addEquipment.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {addEquipment.isPending ? "Purchasing..." : "Purchase Equipment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading equipment...</div>
        ) : equipment && equipment.length > 0 ? (
          <div className="grid gap-3">
            {equipment.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getEquipmentIcon(item.equipment_type)}</span>
                  <div>
                    <div className="font-medium">{item.equipment_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {EQUIPMENT_TYPES.find(t => t.value === item.equipment_type)?.label}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {item.hourly_rate}/hr • {item.daily_rate}/day
                    </div>
                  </div>
                  <div className="w-20">
                    <div className="flex items-center gap-1 mb-1">
                      <Wrench className={`h-3 w-3 ${getConditionColor(item.condition)}`} />
                      <span className={`text-xs ${getConditionColor(item.condition)}`}>
                        {item.condition}%
                      </span>
                    </div>
                    <Progress value={item.condition} className="h-1.5" />
                  </div>
                  <Badge variant={item.is_available ? 'default' : 'secondary'}>
                    {item.is_available ? 'Available' : 'In Use'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No rental equipment yet</p>
            <p className="text-sm">Add equipment bands can rent during sessions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
