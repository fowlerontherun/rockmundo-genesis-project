import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GigViewer3D } from "@/components/gig-viewer/GigViewer3D";

export default function Admin3DGigViewer() {
  const [crowdMood, setCrowdMood] = useState(50);
  const [songIntensity, setSongIntensity] = useState(50);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [showViewer, setShowViewer] = useState(true);

  const { data: stageTemplates } = useQuery({
    queryKey: ["stage-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stage_templates")
        .select("*")
        .order("capacity_min");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (stageTemplates && stageTemplates.length > 0 && !selectedStageId) {
      setSelectedStageId(stageTemplates[0].id);
    }
  }, [stageTemplates, selectedStageId]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bebas mb-2">3D Gig Viewer Admin</h1>
        <p className="text-muted-foreground font-oswald">
          Preview and test 3D stage configurations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Preview Controls</CardTitle>
            <CardDescription>Adjust parameters to test different scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="stage-template">Stage Template</Label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger id="stage-template">
                  <SelectValue placeholder="Select stage template" />
                </SelectTrigger>
                <SelectContent>
                  {stageTemplates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.size})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Crowd Mood: {crowdMood}%</Label>
              <Slider
                value={[crowdMood]}
                onValueChange={(value) => setCrowdMood(value[0])}
                min={0}
                max={100}
                step={1}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Bored</span>
                <span>Ecstatic</span>
              </div>
            </div>

            <div>
              <Label>Song Intensity: {songIntensity}%</Label>
              <Slider
                value={[songIntensity]}
                onValueChange={(value) => setSongIntensity(value[0])}
                min={0}
                max={100}
                step={1}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Calm</span>
                <span>Intense</span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animation State:</span>
                <span className="font-medium">
                  {crowdMood < 20 ? "Tired/Bored" :
                   crowdMood < 40 ? "Warming Up" :
                   crowdMood < 60 ? "Engaged" :
                   crowdMood < 80 ? "Energetic" :
                   "Ecstatic"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lighting:</span>
                <span className="font-medium">
                  {songIntensity < 30 ? "Dim" :
                   songIntensity < 70 ? "Normal" :
                   "Intense"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3D Preview */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] overflow-hidden">
            <CardHeader>
              <CardTitle>Stage Preview</CardTitle>
              <CardDescription>
                Live 3D preview with selected parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100%-5rem)] p-0">
              {showViewer && selectedStageId && (
                <div className="relative w-full h-full">
                  <GigViewer3D
                    gigId="preview"
                    onClose={() => {}}
                    previewMode={true}
                    previewCrowdMood={crowdMood}
                    previewSongIntensity={songIntensity}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
