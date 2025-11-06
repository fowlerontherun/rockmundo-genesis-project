import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isBefore, addDays, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import type { Database } from "@/lib/supabase-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const EQUIPMENT_CATEGORIES = ["Sound", "Lighting", "Visuals", "Effects", "Decor", "Transport", "Utility"] as const;
const MAINTENANCE_STATUS = ["good", "scheduled", "needs_service", "under_repair"] as const;
const MAINTENANCE_ACTIONS = ["inspection", "repair", "upgrade", "cleaning", "emergency_fix"] as const;
const VEHICLE_TYPES = ["Van", "Tour Bus", "Truck", "Sprinter", "Utility", "Trailer"] as const;

type MaintenanceStatus = (typeof MAINTENANCE_STATUS)[number];

type BandStageEquipmentRow = Database["public"]["Tables"]["band_stage_equipment"]["Row"];

type StageEquipmentRecord = BandStageEquipmentRow & {
  condition_rating?: number | null;
  is_active?: boolean | null;
  vehicle_id?: string | null;
  maintenance_due_at?: string | null;
  maintenance_status?: MaintenanceStatus | null;
  in_service?: boolean | null;
  size_units?: number | null;
  band_vehicles?: {
    id: string;
    name: string | null;
    vehicle_type: string | null;
    capacity: number | null;
  } | null;
};

interface BandVehicleRecord {
  id: string;
  band_id: string;
  name: string;
  vehicle_type: string;
  capacity: number;
  location: string | null;
  condition: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MaintenanceLogRecord {
  id: string;
  band_equipment_id: string;
  band_id: string;
  performed_by: string | null;
  action: string;
  cost: number;
  notes: string | null;
  condition_before: number | null;
  condition_after: number | null;
  created_at: string;
  band_stage_equipment?: {
    equipment_name: string | null;
  } | null;
}

interface AddEquipmentFormValues {
  equipmentName: string;
  equipmentType: typeof EQUIPMENT_CATEGORIES[number];
  qualityRating: number;
  conditionRating: number;
  powerDraw?: number | null;
  purchaseCost?: number | null;
  purchaseDate?: string;
  maintenanceDueAt?: string;
  maintenanceStatus: MaintenanceStatus;
  sizeUnits: number;
  notes?: string;
}

interface MaintenanceFormValues {
  action: typeof MAINTENANCE_ACTIONS[number];
  cost: number;
  conditionAfter: number;
  maintenanceStatus: MaintenanceStatus;
  maintenanceDueAt?: string;
  notes?: string;
  markActive: boolean;
  markInService: boolean;
}

interface VehicleFormValues {
  name: string;
  vehicleType: typeof VEHICLE_TYPES[number];
  capacity: number;
  location?: string;
  condition: number;
  notes?: string;
}

const getStatusBadge = (status?: MaintenanceStatus | null) => {
  switch (status) {
    case "good":
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">Ready</Badge>;
    case "scheduled":
      return <Badge className="bg-amber-500 hover:bg-amber-600">Scheduled</Badge>;
    case "needs_service":
      return <Badge variant="destructive">Needs Service</Badge>;
    case "under_repair":
      return <Badge className="bg-blue-600 hover:bg-blue-700">Under Repair</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    const parsed = typeof value === "string" && value.includes("T") ? parseISO(value) : new Date(value);
    return format(parsed, "MMM d, yyyy");
  } catch (error) {
    return "—";
  }
};

const StageEquipmentSystem = () => {
  const queryClient = useQueryClient();
  const { profile } = useGameData();
  const { data: primaryBand, isLoading: loadingBand } = usePrimaryBand();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [maintenanceDialog, setMaintenanceDialog] = useState<StageEquipmentRecord | null>(null);
  const [assignDialog, setAssignDialog] = useState<StageEquipmentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StageEquipmentRecord | null>(null);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<BandVehicleRecord | null>(null);

  const addEquipmentForm = useForm<AddEquipmentFormValues>({
    defaultValues: {
      equipmentName: "",
      equipmentType: "Sound",
      qualityRating: 70,
      conditionRating: 100,
      powerDraw: null,
      purchaseCost: null,
      purchaseDate: "",
      maintenanceDueAt: "",
      maintenanceStatus: "good",
      sizeUnits: 1,
      notes: "",
    },
  });

  const maintenanceForm = useForm<MaintenanceFormValues>({
    defaultValues: {
      action: "inspection",
      cost: 0,
      conditionAfter: 100,
      maintenanceStatus: "good",
      maintenanceDueAt: "",
      notes: "",
      markActive: true,
      markInService: true,
    },
  });

  const vehicleForm = useForm<VehicleFormValues>({
    defaultValues: {
      name: "",
      vehicleType: "Van",
      capacity: 10,
      location: "",
      condition: 100,
      notes: "",
    },
  });

  const { data: equipment, isLoading: loadingEquipment } = useQuery<StageEquipmentRecord[]>({
    queryKey: ["band-stage-equipment", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("band_stage_equipment")
        .select(
          `*`
        )
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch vehicle data separately if needed
      const equipmentData = data ?? [];
      const vehicleIds = equipmentData
        .filter((e: any) => e.vehicle_id)
        .map((e: any) => e.vehicle_id as string);
      
      let vehiclesData: any[] = [];
      if (vehicleIds.length > 0) {
        const { data: vData } = await (supabase as any)
          .from("band_vehicles")
          .select("id, name, vehicle_type, capacity")
          .in("id", vehicleIds);
        vehiclesData = vData ?? [];
      }
      
      // Merge data
      const enriched = equipmentData.map((eq: any) => ({
        ...eq,
        band_vehicles: eq.vehicle_id 
          ? vehiclesData.find((v: any) => v.id === eq.vehicle_id) ?? null
          : null
      }));
      
      return enriched as StageEquipmentRecord[];
    },
    enabled: !!bandId,
  });

  const { data: vehicles, isLoading: loadingVehicles } = useQuery<BandVehicleRecord[]>({
    queryKey: ["band-vehicles", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await (supabase as any)
        .from("band_vehicles")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: true});

      if (error) throw error;
      return data as any as BandVehicleRecord[] ?? [];
    },
    enabled: !!bandId,
  });

  const { data: maintenanceLogs, isLoading: loadingLogs } = useQuery<MaintenanceLogRecord[]>({
    queryKey: ["band-equipment-logs", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await (supabase as any)
        .from("band_equipment_maintenance_logs")
        .select(
          `id, band_equipment_id, band_id, performed_by, action, cost, notes, condition_before, condition_after, created_at`
        )
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch equipment names separately
      const logsData = data ?? [];
      const equipmentIds = logsData.map((log: any) => log.band_equipment_id);
      
      let equipmentData: any[] = [];
      if (equipmentIds.length > 0) {
        const { data: eqData } = await supabase
          .from("band_stage_equipment")
          .select("id, equipment_name")
          .in("id", equipmentIds);
        equipmentData = eqData ?? [];
      }
      
      // Merge data
      const enriched = logsData.map((log: any) => ({
        ...log,
        band_stage_equipment: equipmentData.find((eq: any) => eq.id === log.band_equipment_id) ?? null
      }));
      
      return enriched as any as MaintenanceLogRecord[];
    },
    enabled: !!bandId,
  });

  const addEquipmentMutation = useMutation({
    mutationFn: async (values: AddEquipmentFormValues) => {
      if (!bandId) return;

      const { error } = await supabase.from("band_stage_equipment").insert({
        band_id: bandId,
        equipment_name: values.equipmentName,
        equipment_type: values.equipmentType,
        quality_rating: values.qualityRating,
        condition_rating: values.conditionRating,
        power_draw: values.powerDraw ?? null,
        purchase_cost: values.purchaseCost ?? null,
        purchase_date: values.purchaseDate ? new Date(values.purchaseDate).toISOString() : null,
        maintenance_due_at: values.maintenanceDueAt ? new Date(values.maintenanceDueAt).toISOString() : null,
        maintenance_status: values.maintenanceStatus,
        size_units: values.sizeUnits,
        notes: values.notes ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipment added to stage inventory");
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      addEquipmentForm.reset();
      setAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add equipment");
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StageEquipmentRecord> }) => {
      const { error } = await supabase
        .from("band_stage_equipment")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      if (variables.updates.maintenance_status || variables.updates.condition_rating) {
        queryClient.invalidateQueries({ queryKey: ["band-equipment-logs", bandId] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update equipment");
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (values: MaintenanceFormValues & { equipment: StageEquipmentRecord }) => {
      if (!bandId) return;

      const equipment = values.equipment;
      const { id } = equipment;

      const updates: Partial<StageEquipmentRecord> = {
        condition_rating: values.conditionAfter,
        maintenance_status: values.maintenanceStatus,
        maintenance_due_at: values.maintenanceDueAt ? new Date(values.maintenanceDueAt).toISOString() : null,
        is_active: values.markActive,
        in_service: values.markInService,
      };

      const { error: updateError } = await supabase
        .from("band_stage_equipment")
        .update(updates)
        .eq("id", id);

      if (updateError) throw updateError;

      const { error: logError } = await (supabase as any)
        .from("band_equipment_maintenance_logs")
        .insert({
          band_equipment_id: id,
          band_id: bandId,
          performed_by: profile?.id ?? null,
          action: values.action,
          cost: values.cost,
          notes: values.notes ?? null,
          condition_before: equipment.condition_rating ?? equipment.quality_rating,
          condition_after: values.conditionAfter,
        });

      if (logError) throw logError;
    },
    onSuccess: () => {
      toast.success("Maintenance recorded");
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band-equipment-logs", bandId] });
      maintenanceForm.reset();
      setMaintenanceDialog(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to record maintenance");
    },
  });

  const removeEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      const { error } = await supabase
        .from("band_stage_equipment")
        .delete()
        .eq("id", equipmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipment removed");
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove equipment");
    },
  });

  const addVehicleMutation = useMutation({
    mutationFn: async (values: VehicleFormValues) => {
      if (!bandId) return;
      const { error } = await (supabase as any).from("band_vehicles").insert({
        band_id: bandId,
        name: values.name,
        vehicle_type: values.vehicleType,
        capacity: values.capacity,
        location: values.location ?? null,
        condition: values.condition,
        notes: values.notes ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle added");
      vehicleForm.reset();
      queryClient.invalidateQueries({ queryKey: ["band-vehicles", bandId] });
      setVehicleDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add vehicle");
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BandVehicleRecord> }) => {
      const { error } = await (supabase as any)
        .from("band_vehicles")
        .update(updates as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-vehicles", bandId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update vehicle");
    },
  });

  const removeVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await (supabase as any)
        .from("band_vehicles")
        .delete()
        .eq("id", vehicleId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle removed");
      queryClient.invalidateQueries({ queryKey: ["band-vehicles", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      setDeleteVehicleTarget(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove vehicle");
    },
  });

  const assignVehicleMutation = useMutation({
    mutationFn: async ({ equipmentId, vehicleId }: { equipmentId: string; vehicleId: string | null }) => {
      const { error } = await supabase
        .from("band_stage_equipment")
        .update({ vehicle_id: vehicleId } as any)
        .eq("id", equipmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipment assignment updated");
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      setAssignDialog(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign vehicle");
    },
  });

  const metrics = useMemo(() => {
    if (!equipment || equipment.length === 0) {
      return {
        total: 0,
        active: 0,
        averageCondition: 0,
        totalPower: 0,
        scheduledMaintenance: 0,
      };
    }

    const total = equipment.length;
    const active = equipment.filter((item) => item.is_active).length;
    const averageCondition = Math.round(
      equipment.reduce((sum, item) => sum + (item.condition_rating ?? 100), 0) / total
    );
    const totalPower = equipment.reduce((sum, item) => sum + (item.power_draw ?? 0), 0);
    const scheduledMaintenance = equipment.filter((item) => {
      if (!item.maintenance_due_at) return false;
      const dueDate = new Date(item.maintenance_due_at);
      return isBefore(dueDate, addDays(new Date(), 7));
    }).length;

    return { total, active, averageCondition, totalPower, scheduledMaintenance };
  }, [equipment]);

  const vehicleAssignments = useMemo(() => {
    if (!vehicles) return {} as Record<string, StageEquipmentRecord[]>;
    const grouped: Record<string, StageEquipmentRecord[]> = {};
    for (const vehicle of vehicles) {
      grouped[vehicle.id] = [];
    }
    if (equipment) {
      for (const item of equipment) {
        if (item.vehicle_id) {
          if (!grouped[item.vehicle_id]) {
            grouped[item.vehicle_id] = [];
          }
          grouped[item.vehicle_id].push(item);
        }
      }
    }
    return grouped;
  }, [vehicles, equipment]);

  const lowCondition = equipment?.filter((item) => (item.condition_rating ?? 0) <= 30) ?? [];
  const offlineEquipment = equipment?.filter((item) => item.in_service === false) ?? [];

  const renderEquipmentTable = () => {
    if (loadingEquipment) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }

    if (!equipment || equipment.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No stage equipment yet. Add your first rig to start tracking power, condition, and maintenance.
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Power</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Maintenance</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item) => {
            const condition = item.condition_rating ?? 100;
            const dueSoon = item.maintenance_due_at
              ? isBefore(new Date(item.maintenance_due_at), addDays(new Date(), 7))
              : false;

            return (
              <TableRow key={item.id} className={!item.in_service ? "bg-destructive/5" : undefined}>
                <TableCell className="space-y-1">
                  <div className="font-medium">{item.equipment_name}</div>
                  {item.notes ? <div className="text-xs text-muted-foreground">{item.notes}</div> : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.equipment_type}</Badge>
                </TableCell>
                <TableCell className="space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {item.is_active ? (
                      <Badge className="bg-primary/80">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Standby</Badge>
                    )}
                    {item.in_service ? (
                      <Badge variant="outline">In Service</Badge>
                    ) : (
                      <Badge variant="destructive">Offline</Badge>
                    )}
                  </div>
                  {getStatusBadge(item.maintenance_status as MaintenanceStatus)}
                </TableCell>
                <TableCell className="w-40">
                  <div className="flex items-center gap-2">
                    <Progress value={condition} className="h-2" />
                    <span className="text-sm font-medium">{condition}%</span>
                  </div>
                </TableCell>
                <TableCell>{item.quality_rating}</TableCell>
                <TableCell>{item.power_draw ? `${item.power_draw} W` : "—"}</TableCell>
                <TableCell>
                  {item.band_vehicles?.name ? (
                    <div className="text-sm font-medium">{item.band_vehicles.name}</div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.maintenance_due_at ? (
                    <div className="space-y-1">
                      <div className="text-sm">{formatDate(item.maintenance_due_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.maintenance_due_at), { addSuffix: true })}
                      </div>
                      {dueSoon ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" /> Due soon
                        </Badge>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not scheduled</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Manage equipment</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          updateEquipmentMutation.mutate({
                            id: item.id,
                            updates: { is_active: !item.is_active },
                          })
                        }
                      >
                        {item.is_active ? "Mark as standby" : "Mark as active"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          updateEquipmentMutation.mutate({
                            id: item.id,
                            updates: { in_service: !item.in_service },
                          })
                        }
                      >
                        {item.in_service ? "Take offline" : "Return to service"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setMaintenanceDialog(item);
                          maintenanceForm.reset({
                            action: "inspection",
                            cost: 0,
                            conditionAfter: item.condition_rating ?? 100,
                            maintenanceStatus: (item.maintenance_status as MaintenanceStatus) ?? "good",
                            maintenanceDueAt: item.maintenance_due_at
                              ? format(new Date(item.maintenance_due_at), "yyyy-MM-dd")
                              : "",
                            notes: "",
                            markActive: Boolean(item.is_active),
                            markInService: item.in_service !== false,
                          });
                        }}
                      >
                        Record maintenance
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAssignDialog(item)}>
                        Assign vehicle
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(item)}>
                        Remove from inventory
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderVehicles = () => {
    if (loadingVehicles) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }

    if (!vehicles || vehicles.length === 0) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No transport assets configured yet. Add a van, bus, or truck to start planning loadouts and capacity.
          </p>
          <Button onClick={() => setVehicleDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add vehicle
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {vehicles.map((vehicle) => {
          const assignments = vehicleAssignments[vehicle.id] ?? [];
          const usedCapacity = assignments.reduce((sum, item) => sum + (item.size_units ?? 0), 0);
          const capacityPercent = vehicle.capacity > 0 ? Math.min(100, Math.round((usedCapacity / vehicle.capacity) * 100)) : 0;

          return (
            <Card key={vehicle.id} className="flex flex-col">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{vehicle.name}</CardTitle>
                    <CardDescription>{vehicle.vehicle_type}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteVehicleTarget(vehicle)}>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Capacity</span>
                    <span>
                      {usedCapacity} / {vehicle.capacity} units
                    </span>
                  </div>
                  <Progress value={capacityPercent} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Condition</span>
                    <span>{vehicle.condition}%</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    <span>{vehicle.location || "Location TBD"}</span>
                  </div>
                  {vehicle.notes ? <p className="text-muted-foreground">{vehicle.notes}</p> : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Assigned equipment</span>
                    <Badge variant="secondary">{assignments.length}</Badge>
                  </div>
                  {assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No equipment assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map((item) => (
                        <div key={item.id} className="rounded border p-2">
                          <div className="text-sm font-medium">{item.equipment_name}</div>
                          <div className="text-xs text-muted-foreground">{item.equipment_type}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateVehicleMutation.mutate({
                        id: vehicle.id,
                        updates: { condition: Math.min(100, vehicle.condition + 5) },
                      })
                    }
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Tune-up
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      updateVehicleMutation.mutate({
                        id: vehicle.id,
                        updates: { location: vehicle.location || "On tour" },
                      })
                    }
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" /> Update location
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loadingBand) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!bandId) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Join a band to manage stage equipment</CardTitle>
            <CardDescription>
              Stage rigs, transport plans, and maintenance history unlock once you are part of a band on Rockmundo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stage Equipment Control</h1>
          <p className="text-muted-foreground">
            Operational overview of {bandName}'s touring rigs, upkeep plans, and vehicle capacity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add stage equipment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Add stage equipment</DialogTitle>
                <DialogDescription>Capture the core specs for new touring gear.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={addEquipmentForm.handleSubmit((values) => addEquipmentMutation.mutate(values))}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="equipmentName">Name</Label>
                    <Input id="equipmentName" {...addEquipmentForm.register("equipmentName", { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equipmentType">Category</Label>
                    <Select
                      value={addEquipmentForm.watch("equipmentType")}
                      onValueChange={(value) => addEquipmentForm.setValue("equipmentType", value as AddEquipmentFormValues["equipmentType"])}
                    >
                      <SelectTrigger id="equipmentType">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="qualityRating">Quality</Label>
                    <Input
                      id="qualityRating"
                      type="number"
                      min={0}
                      max={100}
                      {...addEquipmentForm.register("qualityRating", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conditionRating">Condition</Label>
                    <Input
                      id="conditionRating"
                      type="number"
                      min={0}
                      max={100}
                      {...addEquipmentForm.register("conditionRating", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sizeUnits">Size Units</Label>
                    <Input
                      id="sizeUnits"
                      type="number"
                      min={0}
                      {...addEquipmentForm.register("sizeUnits", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="powerDraw">Power (W)</Label>
                    <Input
                      id="powerDraw"
                      type="number"
                      min={0}
                      {...addEquipmentForm.register("powerDraw", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchaseCost">Purchase Cost</Label>
                    <Input
                      id="purchaseCost"
                      type="number"
                      min={0}
                      {...addEquipmentForm.register("purchaseCost", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input id="purchaseDate" type="date" {...addEquipmentForm.register("purchaseDate")} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceStatus">Maintenance Status</Label>
                    <Select
                      value={addEquipmentForm.watch("maintenanceStatus")}
                      onValueChange={(value) =>
                        addEquipmentForm.setValue("maintenanceStatus", value as MaintenanceStatus)
                      }
                    >
                      <SelectTrigger id="maintenanceStatus">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_STATUS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceDueAt">Next Service</Label>
                    <Input id="maintenanceDueAt" type="date" {...addEquipmentForm.register("maintenanceDueAt")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={3} {...addEquipmentForm.register("notes")} />
                </div>

                <Button type="submit" className="w-full" disabled={addEquipmentMutation.isPending}>
                  {addEquipmentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                    </>
                  ) : (
                    "Add equipment"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Truck className="mr-2 h-4 w-4" /> Add vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add transport asset</DialogTitle>
                <DialogDescription>Track the vehicles moving your touring rig.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={vehicleForm.handleSubmit((values) => addVehicleMutation.mutate(values))}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleName">Name</Label>
                    <Input id="vehicleName" {...vehicleForm.register("name", { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">Type</Label>
                    <Select
                      value={vehicleForm.watch("vehicleType")}
                      onValueChange={(value) =>
                        vehicleForm.setValue("vehicleType", value as VehicleFormValues["vehicleType"])
                      }
                    >
                      <SelectTrigger id="vehicleType">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleCapacity">Capacity</Label>
                    <Input
                      id="vehicleCapacity"
                      type="number"
                      min={0}
                      {...vehicleForm.register("capacity", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleCondition">Condition</Label>
                    <Input
                      id="vehicleCondition"
                      type="number"
                      min={0}
                      max={100}
                      {...vehicleForm.register("condition", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleLocation">Location</Label>
                    <Input id="vehicleLocation" {...vehicleForm.register("location")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicleNotes">Notes</Label>
                  <Textarea id="vehicleNotes" rows={3} {...vehicleForm.register("notes")} />
                </div>

                <Button type="submit" className="w-full" disabled={addVehicleMutation.isPending}>
                  {addVehicleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                    </>
                  ) : (
                    "Add vehicle"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total assets</CardDescription>
                <CardTitle className="text-2xl">{metrics.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Pieces of stage equipment logged.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active rigs</CardDescription>
                <CardTitle className="text-2xl">{metrics.active}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Currently marked as active for shows.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Average condition</CardDescription>
                <CardTitle className="text-2xl">{metrics.averageCondition}%</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Health across all tracked gear.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total power</CardDescription>
                <CardTitle className="text-2xl">{metrics.totalPower.toLocaleString()} W</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Output available for upcoming shows.</p>
              </CardContent>
            </Card>
          </div>

          {(lowCondition.length > 0 || offlineEquipment.length > 0 || metrics.scheduledMaintenance > 0) && (
            <div className="grid gap-4 md:grid-cols-3">
              {lowCondition.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Wear alerts</AlertTitle>
                  <AlertDescription>
                    {lowCondition.length} items are below 30% condition. Prioritize repairs to avoid show penalties.
                  </AlertDescription>
                </Alert>
              ) : null}
              {metrics.scheduledMaintenance > 0 ? (
                <Alert>
                  <CalendarClock className="h-4 w-4" />
                  <AlertTitle>Upcoming maintenance</AlertTitle>
                  <AlertDescription>
                    {metrics.scheduledMaintenance} pieces need service within the next week.
                  </AlertDescription>
                </Alert>
              ) : null}
              {offlineEquipment.length > 0 ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Offline gear</AlertTitle>
                  <AlertDescription>
                    {offlineEquipment.length} items are currently offline. Toggle them back once repairs are complete.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Stage equipment</CardTitle>
              <CardDescription>Track condition, maintenance, and transport assignments.</CardDescription>
            </CardHeader>
            <CardContent>{renderEquipmentTable()}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transport fleet</CardTitle>
              <CardDescription>Monitor capacity, locations, and assigned rigs.</CardDescription>
            </CardHeader>
            <CardContent>{renderVehicles()}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance history</CardTitle>
              <CardDescription>Every repair and inspection logged against the touring rig.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !maintenanceLogs || maintenanceLogs.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No maintenance logged yet. Record inspections and repairs to build a complete history.
                </p>
              ) : (
                <div className="space-y-4">
                  {maintenanceLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">
                            {log.band_stage_equipment?.equipment_name ?? "Equipment"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(log.created_at)} · {log.action.replace("_", " ")}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">Cost: ${log.cost.toLocaleString()}</Badge>
                          <Badge variant="outline">Condition {log.condition_before ?? "?"}% → {log.condition_after ?? "?"}%</Badge>
                        </div>
                      </div>
                      {log.notes ? <p className="mt-2 text-sm text-muted-foreground">{log.notes}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(maintenanceDialog)} onOpenChange={(open) => !open && setMaintenanceDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record maintenance</DialogTitle>
            <DialogDescription>
              Update condition and schedule the next service for {maintenanceDialog?.equipment_name}.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={maintenanceForm.handleSubmit((values) =>
              maintenanceDialog && maintenanceMutation.mutate({ ...values, equipment: maintenanceDialog })
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maintenanceAction">Action</Label>
                <Select
                  value={maintenanceForm.watch("action")}
                  onValueChange={(value) =>
                    maintenanceForm.setValue("action", value as MaintenanceFormValues["action"])
                  }
                >
                  <SelectTrigger id="maintenanceAction">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_ACTIONS.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenanceCost">Cost</Label>
                <Input
                  id="maintenanceCost"
                  type="number"
                  min={0}
                  {...maintenanceForm.register("cost", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conditionAfter">Condition after</Label>
                <Input
                  id="conditionAfter"
                  type="number"
                  min={0}
                  max={100}
                  {...maintenanceForm.register("conditionAfter", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenanceStatus">Status</Label>
                <Select
                  value={maintenanceForm.watch("maintenanceStatus")}
                  onValueChange={(value) =>
                    maintenanceForm.setValue("maintenanceStatus", value as MaintenanceStatus)
                  }
                >
                  <SelectTrigger id="maintenanceStatus">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_STATUS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maintenanceDue">Next service</Label>
                <Input id="maintenanceDue" type="date" {...maintenanceForm.register("maintenanceDueAt")} />
              </div>
              <div className="space-y-2">
                <Label>Status toggles</Label>
                <div className="flex flex-col gap-2 rounded border p-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={maintenanceForm.watch("markActive")}
                      onChange={(event) => maintenanceForm.setValue("markActive", event.target.checked)}
                    />
                    Active for shows
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={maintenanceForm.watch("markInService")}
                      onChange={(event) => maintenanceForm.setValue("markInService", event.target.checked)}
                    />
                    In service
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenanceNotes">Notes</Label>
              <Textarea id="maintenanceNotes" rows={3} {...maintenanceForm.register("notes")} />
            </div>

            <Button type="submit" className="w-full" disabled={maintenanceMutation.isPending}>
              {maintenanceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                "Save maintenance"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignDialog)} onOpenChange={(open) => !open && setAssignDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign vehicle</DialogTitle>
            <DialogDescription>
              Route {assignDialog?.equipment_name} to a transport asset for logistics planning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={assignDialog?.vehicle_id ?? "none"}
              onValueChange={(value) =>
                assignDialog &&
                assignVehicleMutation.mutate({ equipmentId: assignDialog.id, vehicleId: value === "none" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {vehicles?.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.vehicle_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Assigning a vehicle helps the gig planner ensure capacity and transport bonuses are applied.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove equipment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {deleteTarget?.equipment_name} from your stage inventory and any associated maintenance history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && removeEquipmentMutation.mutate(deleteTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteVehicleTarget)} onOpenChange={(open) => !open && setDeleteVehicleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {deleteVehicleTarget?.name} and unassign any gear currently routed through it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteVehicleTarget && removeVehicleMutation.mutate(deleteVehicleTarget.id)}
            >
              Remove vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StageEquipmentSystem;
