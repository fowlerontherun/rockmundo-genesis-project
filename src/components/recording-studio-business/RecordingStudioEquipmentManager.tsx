import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Mic2, Plus, DollarSign, Wrench, Star } from "lucide-react";
import { useRecordingStudioEquipment, useAddRecordingStudioEquipment } from "@/hooks/useRecordingStudioBusiness";
import { useSubsidiaryEquipmentCatalog, subsidiaryEquipmentHourlyRate } from "@/hooks/useSubsidiaryEquipmentCatalog";

interface RecordingStudioEquipmentManagerProps {
  studioId: string;
}

export function RecordingStudioEquipmentManager({ studioId }: RecordingStudioEquipmentManagerProps) {
  const { data: equipment, isLoading } = useRecordingStudioEquipment(studioId);
  const addEquipment = useAddRecordingStudioEquipment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: catalog = [], isLoading: catalogLoading } = useSubsidiaryEquipmentCatalog("recording_equipment");
  const [catalogId, setCatalogId] = useState("");
  const pendingPurchaseIds = useRef(new Map<string, string>());
  const selectedItem = catalog.find((item) => item.id === catalogId);

  const handleAdd = async () => {
    if (!selectedItem) return;
    const intentKey = `${studioId}:${selectedItem.id}`;
    let requestId = pendingPurchaseIds.current.get(intentKey);
    if (!requestId) {
      requestId = crypto.randomUUID();
      pendingPurchaseIds.current.set(intentKey, requestId);
    }
    await addEquipment.mutateAsync({
      studio_id: studioId,
      catalog_id: selectedItem.id,
      request_id: requestId,
    });
    pendingPurchaseIds.current.delete(intentKey);
    setIsDialogOpen(false);
    setCatalogId("");
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'microphone': return '🎤';
      case 'preamp': return '🎚️';
      case 'compressor': return '📊';
      case 'equalizer': return '🎛️';
      case 'reverb': return '🌊';
      case 'console': return '🎛️';
      case 'monitor': return '🔊';
      case 'instrument': return '🎸';
      case 'plugin_bundle': return '💿';
      default: return '🎵';
    }
  };

  const totalValue = equipment?.reduce((sum, e) => sum + e.value, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mic2 className="h-5 w-5" />
            Studio Gear
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Gear
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Purchase Studio Equipment</DialogTitle>
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
                    Purchase cost: ${selectedItem.base_price.toLocaleString()} · Hourly rental rate: ${subsidiaryEquipmentHourlyRate(selectedItem.base_price).toLocaleString()} · Available: {selectedItem.stock_quantity}
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
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Total Gear Value</span>
              <span className="font-bold text-lg">${totalValue.toLocaleString()}</span>
            </div>

            <div className="grid gap-3">
              {equipment.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getEquipmentIcon(item.equipment_type)}</span>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {item.equipment_name}
                        {item.is_vintage && (
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                            <Star className="h-3 w-3 mr-1" />
                            Vintage
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.brand} {item.model}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">${item.value.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        ${item.hourly_rental_rate}/hr rental
                      </div>
                    </div>
                    <div className="w-16">
                      <div className="flex items-center gap-1 mb-1">
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{item.condition}%</span>
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
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Mic2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No equipment yet</p>
            <p className="text-sm">Add microphones, preamps, and outboard gear</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
