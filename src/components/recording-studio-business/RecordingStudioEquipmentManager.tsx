import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Mic2, Plus, DollarSign, Wrench, Star } from "lucide-react";
import { useRecordingStudioEquipment, useAddRecordingStudioEquipment } from "@/hooks/useRecordingStudioBusiness";
import { STUDIO_EQUIPMENT_TYPES } from "@/types/recording-studio-business";

interface RecordingStudioEquipmentManagerProps {
  studioId: string;
}

export function RecordingStudioEquipmentManager({ studioId }: RecordingStudioEquipmentManagerProps) {
  const { data: equipment, isLoading } = useRecordingStudioEquipment(studioId);
  const addEquipment = useAddRecordingStudioEquipment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    equipment_name: '',
    equipment_type: 'microphone' as const,
    brand: '',
    model: '',
    value: 5000,
    hourly_rental_rate: 25,
    is_vintage: false,
  });

  const handleAdd = async () => {
    await addEquipment.mutateAsync({
      studio_id: studioId,
      ...newEquipment,
    });
    setIsDialogOpen(false);
    setNewEquipment({ 
      equipment_name: '', 
      equipment_type: 'microphone', 
      brand: '', 
      model: '', 
      value: 5000, 
      hourly_rental_rate: 25,
      is_vintage: false 
    });
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
                <DialogTitle>Add Studio Equipment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Equipment Name</Label>
                  <Input
                    value={newEquipment.equipment_name}
                    onChange={(e) => setNewEquipment({ ...newEquipment, equipment_name: e.target.value })}
                    placeholder="e.g., Neumann U87"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      value={newEquipment.brand}
                      onChange={(e) => setNewEquipment({ ...newEquipment, brand: e.target.value })}
                      placeholder="e.g., Neumann"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      value={newEquipment.model}
                      onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                      placeholder="e.g., U87"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newEquipment.equipment_type}
                    onValueChange={(v) => setNewEquipment({ ...newEquipment, equipment_type: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STUDIO_EQUIPMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {getEquipmentIcon(type.value)} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Value ($)</Label>
                    <Input
                      type="number"
                      value={newEquipment.value}
                      onChange={(e) => setNewEquipment({ ...newEquipment, value: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate ($)</Label>
                    <Input
                      type="number"
                      value={newEquipment.hourly_rental_rate}
                      onChange={(e) => setNewEquipment({ ...newEquipment, hourly_rental_rate: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="vintage"
                    checked={newEquipment.is_vintage}
                    onCheckedChange={(checked) => setNewEquipment({ ...newEquipment, is_vintage: checked })}
                  />
                  <Label htmlFor="vintage">Vintage/Classic Piece</Label>
                </div>

                <Button 
                  onClick={handleAdd} 
                  className="w-full"
                  disabled={!newEquipment.equipment_name || addEquipment.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Inventory
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
