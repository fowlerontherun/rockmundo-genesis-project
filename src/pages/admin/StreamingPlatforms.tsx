import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Disc, Plus, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Platform {
  id: string;
  platform_name: string;
  platform_icon_url: string | null;
  base_payout_per_stream: number;
  quality_multiplier: number;
  min_quality_requirement: number;
  is_active: boolean;
}

interface FormState {
  platform_name: string;
  platform_icon_url: string;
  base_payout_per_stream: string;
  quality_multiplier: string;
  min_quality_requirement: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  platform_name: "",
  platform_icon_url: "",
  base_payout_per_stream: "0.003",
  quality_multiplier: "1.0",
  min_quality_requirement: "0",
  is_active: true,
};

const AdminStreamingPlatforms = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: platforms, isLoading } = useQuery({
    queryKey: ["admin-streaming-platforms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_platforms")
        .select("*")
        .order("platform_name");
      if (error) throw error;
      return data as Platform[];
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Platform) => {
    setEditingId(p.id);
    setForm({
      platform_name: p.platform_name,
      platform_icon_url: p.platform_icon_url ?? "",
      base_payout_per_stream: String(p.base_payout_per_stream ?? 0),
      quality_multiplier: String(p.quality_multiplier ?? 1),
      min_quality_requirement: String(p.min_quality_requirement ?? 0),
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        platform_name: form.platform_name.trim(),
        platform_icon_url: form.platform_icon_url.trim() || null,
        base_payout_per_stream: Number(form.base_payout_per_stream),
        quality_multiplier: Number(form.quality_multiplier),
        min_quality_requirement: Math.floor(Number(form.min_quality_requirement)),
        is_active: form.is_active,
      };

      if (!payload.platform_name) throw new Error("Platform name is required");
      if (!Number.isFinite(payload.base_payout_per_stream)) throw new Error("Invalid payout");
      if (!Number.isFinite(payload.quality_multiplier)) throw new Error("Invalid multiplier");

      if (editingId) {
        const { error } = await supabase
          .from("streaming_platforms")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("streaming_platforms").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-streaming-platforms"] });
      queryClient.invalidateQueries({ queryKey: ["streaming-platforms"] });
      toast({ title: editingId ? "Platform updated" : "Platform created" });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (p: Platform) => {
      const { error } = await supabase
        .from("streaming_platforms")
        .update({ is_active: !p.is_active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-streaming-platforms"] });
      queryClient.invalidateQueries({ queryKey: ["streaming-platforms"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Disc className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Streaming Platforms</h1>
            <p className="text-muted-foreground">
              Manage streaming platforms and payout rates
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Platform
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading platforms...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms?.map((platform) => (
            <Card key={platform.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {platform.platform_name}
                  <Badge variant={platform.is_active ? "default" : "secondary"}>
                    {platform.is_active ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Payout/1k:</span>
                    <div className="font-medium">
                      ${(Number(platform.base_payout_per_stream) * 1000).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quality Mult:</span>
                    <div className="font-medium">{platform.quality_multiplier}x</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Min Quality:</span>
                    <div className="font-medium">{platform.min_quality_requirement}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(platform)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive.mutate(platform)}
                    disabled={toggleActive.isPending}
                  >
                    {platform.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Platform" : "Add Platform"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input
                value={form.platform_name}
                onChange={(e) => setForm((f) => ({ ...f, platform_name: e.target.value }))}
                placeholder="e.g. Spotify"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon URL (optional)</Label>
              <Input
                value={form.platform_icon_url}
                onChange={(e) => setForm((f) => ({ ...f, platform_icon_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payout / stream ($)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.base_payout_per_stream}
                  onChange={(e) => setForm((f) => ({ ...f, base_payout_per_stream: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Quality Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.quality_multiplier}
                  onChange={(e) => setForm((f) => ({ ...f, quality_multiplier: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Quality</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.min_quality_requirement}
                  onChange={(e) => setForm((f) => ({ ...f, min_quality_requirement: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <div className="flex items-center h-10">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStreamingPlatforms;
