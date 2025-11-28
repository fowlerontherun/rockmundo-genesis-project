import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, FileText } from "lucide-react";

export default function ContractsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClause, setEditingClause] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    clause_key: "",
    contract_type: "label_deal",
    description: "",
    sort_order: 1,
  });

  const { data: clauses } = useQuery({
    queryKey: ["contract-clauses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_clauses")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createClause = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("contract_clauses")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast({ title: "Contract clause created" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateClause = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from("contract_clauses")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast({ title: "Contract clause updated" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteClause = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contract_clauses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast({ title: "Contract clause deleted" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      clause_key: "",
      contract_type: "label_deal",
      description: "",
      sort_order: 1,
    });
    setEditingClause(null);
  };

  const handleEdit = (clause: any) => {
    setEditingClause(clause);
    setFormData(clause);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingClause) {
      updateClause.mutate({ id: editingClause.id, ...formData });
    } else {
      createClause.mutate(formData);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Contracts Admin</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Clause
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClause ? "Edit" : "Create"} Contract Clause</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Clause Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Clause Key</Label>
                <Input
                  value={formData.clause_key}
                  onChange={(e) => setFormData({ ...formData, clause_key: e.target.value })}
                  placeholder="e.g. royalty_split"
                />
              </div>
              <div>
                <Label>Contract Type</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(v) => setFormData({ ...formData, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="label_deal">Label Deal</SelectItem>
                    <SelectItem value="sponsorship">Sponsorship</SelectItem>
                    <SelectItem value="venue_contract">Venue Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingClause ? "Update" : "Create"} Clause
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Clauses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clauses?.map((clause) => (
                <TableRow key={clause.id}>
                  <TableCell className="font-medium">{clause.title}</TableCell>
                  <TableCell className="font-mono text-sm">{clause.clause_key}</TableCell>
                  <TableCell className="capitalize">{clause.contract_type}</TableCell>
                  <TableCell>{clause.sort_order}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(clause)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteClause.mutate(clause.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
