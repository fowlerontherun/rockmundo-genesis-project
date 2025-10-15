import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plane, Train, Plus, Trash2, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface City {
  id: string;
  name: string;
  country: string;
}

interface TransportRoute {
  id: string;
  from_city_id: string;
  to_city_id: string;
  transport_type: string;
  base_cost: number;
  duration_hours: number;
  frequency: string | null;
  comfort_rating: number;
  from_city?: { name: string };
  to_city?: { name: string };
}

export default function Travel() {
  const { toast } = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);

  const [formData, setFormData] = useState({
    from_city_id: "",
    to_city_id: "",
    transport_type: "train",
    base_cost: "",
    duration_hours: "",
    frequency: "",
    comfort_rating: "50",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [citiesResult, routesResult] = await Promise.all([
        supabase.from("cities").select("id, name, country").order("name"),
        supabase
          .from("city_transport_routes")
          .select("*, from_city:cities!city_transport_routes_from_city_id_fkey(name), to_city:cities!city_transport_routes_to_city_id_fkey(name)")
          .order("created_at", { ascending: false }),
      ]);

      if (citiesResult.error) throw citiesResult.error;
      if (routesResult.error) throw routesResult.error;

      setCities(citiesResult.data || []);
      setRoutes(routesResult.data as any || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load travel data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.from_city_id || !formData.to_city_id || !formData.base_cost || !formData.duration_hours) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const routeData = {
        from_city_id: formData.from_city_id,
        to_city_id: formData.to_city_id,
        transport_type: formData.transport_type,
        base_cost: parseInt(formData.base_cost),
        duration_hours: parseInt(formData.duration_hours),
        frequency: formData.frequency || null,
        comfort_rating: parseInt(formData.comfort_rating),
      };

      if (editingRoute) {
        const { error } = await supabase
          .from("city_transport_routes")
          .update(routeData)
          .eq("id", editingRoute.id);

        if (error) throw error;

        toast({
          title: "Route updated",
          description: "Travel route has been updated successfully",
        });
      } else {
        const { error } = await supabase.from("city_transport_routes").insert(routeData);

        if (error) throw error;

        toast({
          title: "Route created",
          description: "New travel route has been created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving route:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save travel route",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this route?")) return;

    try {
      const { error } = await supabase.from("city_transport_routes").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Route deleted",
        description: "Travel route has been removed",
      });

      loadData();
    } catch (error: any) {
      console.error("Error deleting route:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete route",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      from_city_id: "",
      to_city_id: "",
      transport_type: "train",
      base_cost: "",
      duration_hours: "",
      frequency: "",
      comfort_rating: "50",
    });
    setEditingRoute(null);
  };

  const handleEdit = (route: TransportRoute) => {
    setEditingRoute(route);
    setFormData({
      from_city_id: route.from_city_id,
      to_city_id: route.to_city_id,
      transport_type: route.transport_type,
      base_cost: route.base_cost.toString(),
      duration_hours: route.duration_hours.toString(),
      frequency: route.frequency || "",
      comfort_rating: route.comfort_rating.toString(),
    });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading travel routes...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Travel Routes</h1>
          <p className="text-muted-foreground">Manage transportation between cities</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRoute ? "Edit" : "Create"} Travel Route</DialogTitle>
              <DialogDescription>
                {editingRoute ? "Update" : "Add"} a transportation route between cities
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from_city">From City *</Label>
                  <Select
                    value={formData.from_city_id}
                    onValueChange={(value) => setFormData({ ...formData, from_city_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select origin city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}, {city.country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to_city">To City *</Label>
                  <Select
                    value={formData.to_city_id}
                    onValueChange={(value) => setFormData({ ...formData, to_city_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}, {city.country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transport_type">Transport Type *</Label>
                  <Select
                    value={formData.transport_type}
                    onValueChange={(value) => setFormData({ ...formData, transport_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="train">Train</SelectItem>
                      <SelectItem value="bus">Bus</SelectItem>
                      <SelectItem value="flight">Flight</SelectItem>
                      <SelectItem value="ferry">Ferry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base_cost">Base Cost ($) *</Label>
                  <Input
                    id="base_cost"
                    type="number"
                    min="1"
                    value={formData.base_cost}
                    onChange={(e) => setFormData({ ...formData, base_cost: e.target.value })}
                    placeholder="e.g., 50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration_hours">Duration (hours) *</Label>
                  <Input
                    id="duration_hours"
                    type="number"
                    min="1"
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                    placeholder="e.g., 3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comfort_rating">Comfort Rating (0-100)</Label>
                  <Input
                    id="comfort_rating"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.comfort_rating}
                    onChange={(e) => setFormData({ ...formData, comfort_rating: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Input
                  id="frequency"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  placeholder="e.g., Daily, Every 2 hours, Weekly"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">{editingRoute ? "Update" : "Create"} Route</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {routes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No travel routes configured yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          routes.map((route) => (
            <Card key={route.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {route.transport_type === "flight" ? (
                      <Plane className="h-6 w-6 text-primary" />
                    ) : (
                      <Train className="h-6 w-6 text-primary" />
                    )}
                    <div>
                      <CardTitle className="text-xl">
                        {route.from_city?.name} → {route.to_city?.name}
                      </CardTitle>
                      <CardDescription className="capitalize">
                        {route.transport_type} • {route.duration_hours}h • ${route.base_cost}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(route)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(route.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Comfort:</span>{" "}
                    <span className="font-medium">{route.comfort_rating}%</span>
                  </div>
                  {route.frequency && (
                    <div>
                      <span className="text-muted-foreground">Frequency:</span>{" "}
                      <span className="font-medium">{route.frequency}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
