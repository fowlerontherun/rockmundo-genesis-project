import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";

export default function SponsorshipsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    size: "emerging",
    wealth_score: 50,
    available_budget: 10000,
    min_fame_threshold: 100,
    exclusivity_pref: false,
    is_active: true,
  });

  const { data: brands } = useQuery({
    queryKey: ["sponsorship-brands"],
    queryFn: async () => {
      // Placeholder - sponsorship tables need to be created
      return [];
    },
  });

  const createBrand = useMutation({
    mutationFn: async (data: typeof formData) => {
      throw new Error("Sponsorship tables need to be created first");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsorship-brands"] });
      toast({ title: "Brand created successfully" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateBrand = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      throw new Error("Sponsorship tables need to be created first");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsorship-brands"] });
      toast({ title: "Brand updated successfully" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteBrand = useMutation({
    mutationFn: async (id: string) => {
      throw new Error("Sponsorship tables need to be created first");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsorship-brands"] });
      toast({ title: "Brand deleted successfully" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      size: "emerging",
      wealth_score: 50,
      available_budget: 10000,
      min_fame_threshold: 100,
      exclusivity_pref: false,
      is_active: true,
    });
    setEditingBrand(null);
  };

  const handleEdit = (brand: any) => {
    setEditingBrand(brand);
    setFormData(brand);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingBrand) {
      updateBrand.mutate({ id: editingBrand.id, ...formData });
    } else {
      createBrand.mutate(formData);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sponsorships Admin</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Brand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBrand ? "Edit" : "Create"} Sponsorship Brand</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Brand Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Size</Label>
                  <Select value={formData.size} onValueChange={(v) => setFormData({ ...formData, size: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emerging">Emerging</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Wealth Score (1-100)</Label>
                  <Input
                    type="number"
                    value={formData.wealth_score}
                    onChange={(e) => setFormData({ ...formData, wealth_score: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Available Budget</Label>
                  <Input
                    type="number"
                    value={formData.available_budget}
                    onChange={(e) => setFormData({ ...formData, available_budget: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Min Fame Threshold</Label>
                  <Input
                    type="number"
                    value={formData.min_fame_threshold}
                    onChange={(e) => setFormData({ ...formData, min_fame_threshold: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingBrand ? "Update" : "Create"} Brand
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sponsorship Brands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Wealth</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Min Fame</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands && brands.length > 0 ? (
                brands.map((brand: any) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="capitalize">{brand.size}</TableCell>
                    <TableCell>{brand.wealth_score}</TableCell>
                    <TableCell>${brand.available_budget?.toLocaleString()}</TableCell>
                    <TableCell>{brand.min_fame_threshold}</TableCell>
                    <TableCell>{brand.is_active ? "Active" : "Inactive"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(brand)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBrand.mutate(brand.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Sponsorship tables need to be created in the database first
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
