import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GigViewer3D } from "@/components/gig-viewer/GigViewer3D";
import { Play, RotateCcw } from "lucide-react";

export default function Admin3DGigViewer() {
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [crowdMood, setCrowdMood] = useState([50]);
  const [songIntensity, setSongIntensity] = useState([50]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationKey, setSimulationKey] = useState(0);

  const { data: stageTemplates, isLoading } = useQuery({
    queryKey: ["stage-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stage_templates")
        .select("*")
        .order("venue_size", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const handleStartSimulation = () => {
    setIsPlaying(true);
    setSimulationKey(prev => prev + 1);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCrowdMood([50]);
    setSongIntensity([50]);
    setSimulationKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bebas tracking-wide">3D Gig Viewer Preview</h1>
          <p className="text-muted-foreground">Test and preview stage configurations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Stage Controls</CardTitle>
            <CardDescription>Configure the preview settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Stage Template</Label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    stageTemplates?.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name} ({stage.venue_size})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Crowd Mood: {crowdMood[0]}%</Label>
              <Slider
                value={crowdMood}
                onValueChange={setCrowdMood}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {crowdMood[0] < 30 && "Bored / Uninterested"}
                {crowdMood[0] >= 30 && crowdMood[0] < 50 && "Warming Up"}
                {crowdMood[0] >= 50 && crowdMood[0] < 70 && "Engaged"}
                {crowdMood[0] >= 70 && crowdMood[0] < 85 && "Energetic"}
                {crowdMood[0] >= 85 && "Ecstatic"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Song Intensity: {songIntensity[0]}%</Label>
              <Slider
                value={songIntensity}
                onValueChange={setSongIntensity}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Controls lighting effects and energy
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleStartSimulation} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                {isPlaying ? "Restart" : "Start"} Preview
              </Button>
              <Button onClick={handleReset} variant="outline">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>
              Real-time 3D visualization of the gig experience
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full h-[600px] bg-black relative">
              {selectedStage ? (
              <div key={simulationKey} className="w-full h-full">
                <GigViewer3D
                  gigId="preview-gig"
                  onClose={() => {}}
                  previewMode={true}
                  previewCrowdMood={crowdMood[0]}
                  previewSongIntensity={songIntensity[0]}
                />
                  <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm p-4 rounded-lg border border-white/10">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Crowd Mood:</span>
                        <span className="ml-2 font-bold text-primary">{crowdMood[0]}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Intensity:</span>
                        <span className="ml-2 font-bold text-primary">{songIntensity[0]}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Select a stage template to preview</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Stage Templates</CardTitle>
          <CardDescription>Manage and configure stage templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stageTemplates?.map((stage) => (
              <div
                key={stage.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedStage === stage.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedStage(stage.id)}
              >
                <h3 className="font-bebas text-lg">{stage.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {stage.venue_size} Venue
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Capacity: {stage.capacity_min} - {stage.capacity_max}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
