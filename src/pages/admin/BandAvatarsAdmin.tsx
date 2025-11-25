import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Save } from "lucide-react";

const INSTRUMENTS = ["guitar", "bass", "drums", "keys", "vocal", "dj", "saxophone", "trumpet"];

export default function BandAvatarsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBandId, setSelectedBandId] = useState("");
  const [presets, setPresets] = useState<any[]>([]);

  const { data: bands } = useQuery({
    queryKey: ["bands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: animationSets } = useQuery({
    queryKey: ["animation-sets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animation_sets")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: bandPresets, isLoading } = useQuery({
    queryKey: ["band-avatars", selectedBandId],
    queryFn: async () => {
      if (!selectedBandId) return [];
      const { data, error } = await supabase
        .from("band_avatar_presets")
        .select("*")
        .eq("band_id", selectedBandId)
        .order("member_index");
      if (error) throw error;
      setPresets(data || []);
      return data;
    },
    enabled: !!selectedBandId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing presets
      await supabase
        .from("band_avatar_presets")
        .delete()
        .eq("band_id", selectedBandId);

      // Insert new presets
      if (presets.length > 0) {
        const { error } = await supabase
          .from("band_avatar_presets")
          .insert(presets.map(p => ({ ...p, band_id: selectedBandId })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-avatars", selectedBandId] });
      toast({ title: "Avatar presets saved successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save presets",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addPreset = () => {
    setPresets([
      ...presets,
      {
        member_index: presets.length,
        instrument_type: "guitar",
        avatar_model_path: "",
        gear_model_path: "",
        default_animation_set_id: null,
      },
    ]);
  };

  const updatePreset = (index: number, field: string, value: any) => {
    const updated = [...presets];
    updated[index] = { ...updated[index], [field]: value };
    setPresets(updated);
  };

  const removePreset = (index: number) => {
    setPresets(presets.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bebas mb-2">Band Avatar Presets</h1>
        <p className="text-muted-foreground font-oswald">Configure 3D avatars for band members</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Band</CardTitle>
          <CardDescription>Choose a band to configure their avatar presets</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedBandId} onValueChange={setSelectedBandId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a band" />
            </SelectTrigger>
            <SelectContent>
              {bands?.map((band) => (
                <SelectItem key={band.id} value={band.id}>
                  {band.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedBandId && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Band Members</CardTitle>
                <Button onClick={addPreset} size="sm">
                  Add Member
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {presets.map((preset, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">Member {index + 1}</h4>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removePreset(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Instrument</Label>
                        <Select
                          value={preset.instrument_type}
                          onValueChange={(value) => updatePreset(index, "instrument_type", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INSTRUMENTS.map((inst) => (
                              <SelectItem key={inst} value={inst}>
                                {inst}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Animation Set</Label>
                        <Select
                          value={preset.default_animation_set_id || ""}
                          onValueChange={(value) => updatePreset(index, "default_animation_set_id", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select animation" />
                          </SelectTrigger>
                          <SelectContent>
                            {animationSets
                              ?.filter((set) => set.instrument_type === preset.instrument_type)
                              .map((set) => (
                                <SelectItem key={set.id} value={set.id}>
                                  {set.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Avatar Model Path</Label>
                        <Input
                          value={preset.avatar_model_path || ""}
                          onChange={(e) => updatePreset(index, "avatar_model_path", e.target.value)}
                          placeholder="/assets/avatars/member1.glb"
                        />
                      </div>

                      <div>
                        <Label>Gear Model Path</Label>
                        <Input
                          value={preset.gear_model_path || ""}
                          onChange={(e) => updatePreset(index, "gear_model_path", e.target.value)}
                          placeholder="/assets/gear/guitar.glb"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            Save All Presets
          </Button>
        </>
      )}
    </div>
  );
}
