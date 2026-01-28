import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Pause,
  Play,
  Trash2,
  XCircle,
  Calendar,
  Users,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FestivalStatus = "draft" | "published" | "postponed" | "cancelled" | "completed";

interface Festival {
  id: string;
  name: string;
  status?: FestivalStatus;
  is_active: boolean;
  start_date: string;
  end_date: string;
  capacity?: number;
  max_participants?: number;
  city?: { name: string; country: string };
}

interface FestivalLifecycleControlsProps {
  festival: Festival;
  onUpdate?: () => void;
}

const STATUS_CONFIG: Record<FestivalStatus, { icon: React.ReactNode; color: string; label: string }> = {
  draft: { icon: <Edit className="h-3 w-3" />, color: "bg-muted text-muted-foreground", label: "Draft" },
  published: { icon: <CheckCircle className="h-3 w-3" />, color: "bg-green-500/10 text-green-500", label: "Published" },
  postponed: { icon: <Pause className="h-3 w-3" />, color: "bg-amber-500/10 text-amber-500", label: "Postponed" },
  cancelled: { icon: <XCircle className="h-3 w-3" />, color: "bg-destructive/10 text-destructive", label: "Cancelled" },
  completed: { icon: <CheckCircle className="h-3 w-3" />, color: "bg-primary/10 text-primary", label: "Completed" },
};

const VALID_TRANSITIONS: Record<FestivalStatus, FestivalStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["postponed", "cancelled", "completed"],
  postponed: ["published", "cancelled"],
  cancelled: [],
  completed: [],
};

export function FestivalLifecycleControls({ festival, onUpdate }: FestivalLifecycleControlsProps) {
  const queryClient = useQueryClient();
  const currentStatus = (festival.status as FestivalStatus) || "draft";
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editedFestival, setEditedFestival] = useState({
    name: festival.name,
    capacity: festival.capacity || 10000,
    maxParticipants: festival.max_participants || 20,
    isActive: festival.is_active,
  });
  const [cancelReason, setCancelReason] = useState("");

  // Status transition mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, reason }: { newStatus: FestivalStatus; reason?: string }) => {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "cancelled" || newStatus === "postponed") {
        updateData.is_active = false;
        updateData.cancellation_reason = reason;
      } else if (newStatus === "published") {
        updateData.is_active = true;
        updateData.published_at = new Date().toISOString();
      }
      
      const { error } = await (supabase as any)
        .from("festivals")
        .update(updateData)
        .eq("id", festival.id);
      
      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast.success(`Festival ${newStatus}`);
      onUpdate?.();
    },
    onError: (error: any) => {
      toast.error("Failed to update status", { description: error.message });
    },
  });

  // Edit festival mutation
  const editFestivalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("festivals")
        .update({
          name: editedFestival.name,
          capacity: editedFestival.capacity,
          max_participants: editedFestival.maxParticipants,
          is_active: editedFestival.isActive,
        })
        .eq("id", festival.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-festivals"] });
      toast.success("Festival updated");
      setEditDialogOpen(false);
      onUpdate?.();
    },
    onError: (error: any) => {
      toast.error("Failed to update festival", { description: error.message });
    },
  });

  const handleStatusChange = (newStatus: FestivalStatus) => {
    if (newStatus === "cancelled") {
      setCancelDialogOpen(true);
    } else {
      updateStatusMutation.mutate({ newStatus });
    }
  };

  const handleCancel = () => {
    updateStatusMutation.mutate({ newStatus: "cancelled", reason: cancelReason });
    setCancelDialogOpen(false);
    setCancelReason("");
  };

  const validTransitions = VALID_TRANSITIONS[currentStatus];
  const statusConfig = STATUS_CONFIG[currentStatus];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{festival.name}</CardTitle>
              <CardDescription>
                {festival.city?.name}, {festival.city?.country}
              </CardDescription>
            </div>
            <Badge className={cn("flex items-center gap-1", statusConfig.color)}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {new Date(festival.start_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {festival.max_participants || 0} slots
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={festival.is_active ? "text-green-500" : "text-muted-foreground"}>
                {festival.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <Separator />

          {/* Status Controls */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Status Actions</Label>
            <div className="flex flex-wrap gap-2">
              {validTransitions.map((status) => {
                const config = STATUS_CONFIG[status];
                return (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "cancelled" ? "destructive" : "outline"}
                    onClick={() => handleStatusChange(status)}
                    disabled={updateStatusMutation.isPending}
                    className="h-8"
                  >
                    {config.icon}
                    <span className="ml-1">{config.label}</span>
                  </Button>
                );
              })}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
                className="h-8"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            
            {validTransitions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No status changes available for {currentStatus} festivals
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Festival</DialogTitle>
            <DialogDescription>
              Update festival settings and configuration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Festival Name</Label>
              <Input
                id="name"
                value={editedFestival.name}
                onChange={(e) => setEditedFestival(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Venue Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={editedFestival.capacity}
                  onChange={(e) => setEditedFestival(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Max Performers</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  value={editedFestival.maxParticipants}
                  onChange={(e) => setEditedFestival(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  Make this festival visible to players
                </p>
              </div>
              <Switch
                checked={editedFestival.isActive}
                onCheckedChange={(checked) => setEditedFestival(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => editFestivalMutation.mutate()} disabled={editFestivalMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cancel Festival
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Cancelling will notify all participants and trigger refunds.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Cancellation Reason</Label>
              <Textarea
                id="reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explain why this festival is being cancelled..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Festival
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={updateStatusMutation.isPending}>
              <XCircle className="h-4 w-4 mr-2" />
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
