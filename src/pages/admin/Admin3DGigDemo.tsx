import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GigDemoViewer } from "@/components/gig-viewer/GigDemoViewer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Music, Users, Sparkles, Settings, RefreshCw, Maximize2, Camera } from "lucide-react";

type SongSection = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
type PerformanceTier = 'low' | 'medium' | 'high';
type CameraMode = 'pov' | 'orbit' | 'free' | 'cinematic';

const DEFAULT_MERCH_COLOR = "#ff0066";

export default function Admin3DGigDemo() {
  const [crowdMood, setCrowdMood] = useState(50);
  const [bandFame, setBandFame] = useState(1000);
  const [songIntensity, setSongIntensity] = useState(70);
  const [crowdDensity, setCrowdDensity] = useState(0.7);
  const [maxCrowdCount, setMaxCrowdCount] = useState(300);
  const [performanceTier, setPerformanceTier] = useState<PerformanceTier>('high');
  const [enableShadows, setEnableShadows] = useState(true);
  const [enablePostProcessing, setEnablePostProcessing] = useState(true);
  const [stageTemplateId, setStageTemplateId] = useState<string | null>(null);
  const [floorType, setFloorType] = useState('wood');
  const [backdropType, setBackdropType] = useState('curtain-black');
  const [merchColor, setMerchColor] = useState(DEFAULT_MERCH_COLOR);
  const [bandName, setBandName] = useState('ROCKMUNDO');
  const [songSection, setSongSection] = useState<SongSection>('chorus');
  const [isAutoProgressing, setIsAutoProgressing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'preview'>('full');
  const [isOutdoor, setIsOutdoor] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('night');
  const [cameraMode, setCameraMode] = useState<CameraMode>('pov');
  const [zoomLevel, setZoomLevel] = useState(13);

  // Fetch stage templates
  const { data: stageTemplates } = useQuery({
    queryKey: ['stage-templates-demo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_templates')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Auto-progress through song sections
  const startAutoProgress = () => {
    setIsAutoProgressing(true);
    const sections: SongSection[] = ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'solo', 'outro'];
    let index = 0;
    
    const interval = setInterval(() => {
      index = (index + 1) % sections.length;
      setSongSection(sections[index]);
    }, 5000);

    setTimeout(() => {
      clearInterval(interval);
      setIsAutoProgressing(false);
    }, 40000);
  };

  const resetToDefaults = () => {
    setCrowdMood(50);
    setBandFame(1000);
    setSongIntensity(70);
    setCrowdDensity(0.7);
    setMaxCrowdCount(300);
    setPerformanceTier('high');
    setEnableShadows(true);
    setEnablePostProcessing(true);
    setFloorType('wood');
    setBackdropType('curtain-black');
    setMerchColor(DEFAULT_MERCH_COLOR);
    setBandName('ROCKMUNDO');
    setSongSection('chorus');
  };

  const getMoodLabel = (mood: number) => {
    if (mood < 20) return "😴 Tired";
    if (mood < 40) return "😐 Bored";
    if (mood < 60) return "🙂 Mixed";
    if (mood < 80) return "😄 Energetic";
    return "🤩 Ecstatic";
  };

  const getMerchPercentage = (fame: number) => {
    if (fame < 500) return 0;
    if (fame < 1000) return 5;
    if (fame < 2500) return 15;
    if (fame < 5000) return 30;
    return 50;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-2 md:p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bebas text-foreground">3D Gig Demo</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Test and preview 3D gig viewer</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'full' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('full')}
          >
            Full Demo
          </Button>
          <Button
            variant={viewMode === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('preview')}
          >
            Preview Only
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Control Panel - Horizontal scroll on mobile, vertical on desktop */}
        {viewMode === 'full' && (
        <div className="lg:w-96 border-b lg:border-b-0 lg:border-r border-border overflow-x-auto lg:overflow-y-auto p-2 md:p-4">
          <div className="flex lg:flex-col gap-2 md:gap-4 min-w-max lg:min-w-0">
          {/* Stage Template */}
          <Card className="p-3 md:p-4 space-y-2 md:space-y-3 min-w-[280px] lg:min-w-0">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Stage Setup</h3>
            </div>
            
            <div className="space-y-2">
              <Label>Stage Template</Label>
              <Select value={stageTemplateId || ''} onValueChange={setStageTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage template" />
                </SelectTrigger>
                <SelectContent>
                  {stageTemplates?.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.capacity_min}-{template.capacity_max})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Floor Type</Label>
                <Select value={floorType} onValueChange={setFloorType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wood">Wood</SelectItem>
                    <SelectItem value="metal">Metal</SelectItem>
                    <SelectItem value="rubber">Rubber</SelectItem>
                    <SelectItem value="concrete">Concrete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Backdrop</Label>
                <Select value={backdropType} onValueChange={setBackdropType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curtain-red">Red Curtain</SelectItem>
                    <SelectItem value="curtain-black">Black Curtain</SelectItem>
                    <SelectItem value="led-grid">LED Grid</SelectItem>
                    <SelectItem value="brick">Brick Wall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Venue Type</Label>
              <Select value={isOutdoor ? "outdoor" : "indoor"} onValueChange={(v) => setIsOutdoor(v === "outdoor")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indoor">🏢 Indoor</SelectItem>
                  <SelectItem value="outdoor">🌳 Outdoor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isOutdoor && (
              <div className="space-y-2">
                <Label>Time of Day</Label>
                <Select value={timeOfDay} onValueChange={(v: any) => setTimeOfDay(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">☀️ Day</SelectItem>
                    <SelectItem value="sunset">🌅 Sunset</SelectItem>
                    <SelectItem value="night">🌙 Night</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {timeOfDay === 'day' && 'Bright daylight with blue sky'}
                  {timeOfDay === 'sunset' && 'Golden hour with orange/pink gradient'}
                  {timeOfDay === 'night' && 'Night sky with stars and festival lighting'}
                </p>
              </div>
            )}
          </Card>

          {/* Crowd Controls */}
          <Card className="p-3 md:p-4 space-y-2 md:space-y-4 min-w-[280px] lg:min-w-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Crowd Controls</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Crowd Mood</Label>
                <Badge variant="secondary">{getMoodLabel(crowdMood)}</Badge>
              </div>
              <Slider 
                value={[crowdMood]} 
                onValueChange={([v]) => setCrowdMood(v)}
                min={0}
                max={100}
                step={1}
              />
              <div className="text-xs text-muted-foreground text-center">{crowdMood}%</div>
            </div>

            <div className="space-y-2">
              <Label>Crowd Density</Label>
              <Slider 
                value={[crowdDensity * 100]} 
                onValueChange={([v]) => setCrowdDensity(v / 100)}
                min={10}
                max={100}
                step={1}
              />
              <div className="text-xs text-muted-foreground text-center">{Math.round(crowdDensity * 100)}%</div>
            </div>

            <div className="space-y-2">
              <Label>Max Crowd Count</Label>
              <Slider 
                value={[maxCrowdCount]} 
                onValueChange={([v]) => setMaxCrowdCount(v)}
                min={50}
                max={1000}
                step={50}
              />
              <div className="text-xs text-muted-foreground text-center">{maxCrowdCount} people</div>
            </div>
          </Card>

          {/* Band Controls */}
          <Card className="p-3 md:p-4 space-y-2 md:space-y-4 min-w-[280px] lg:min-w-0">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Band & Performance</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Band Fame</Label>
                <Badge variant="outline">{getMerchPercentage(bandFame)}% wearing merch</Badge>
              </div>
              <Slider 
                value={[bandFame]} 
                onValueChange={([v]) => setBandFame(v)}
                min={0}
                max={10000}
                step={100}
              />
              <div className="text-xs text-muted-foreground text-center">{bandFame.toLocaleString()} fame</div>
            </div>

            <div className="space-y-2">
              <Label>Merch Color</Label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={merchColor}
                  onChange={(e) => setMerchColor(e.target.value)}
                  className="h-10 w-20 rounded cursor-pointer"
                />
                <div className="flex-1 flex items-center justify-center bg-muted rounded text-sm">
                  {merchColor}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Band Name (on merch)</Label>
              <input 
                type="text" 
                value={bandName}
                onChange={(e) => setBandName(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded bg-background border border-border text-foreground"
                placeholder="BAND NAME"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Appears on T-shirts when fans wear merch
              </p>
            </div>

            <div className="space-y-2">
              <Label>Song Intensity</Label>
              <Slider 
                value={[songIntensity]} 
                onValueChange={([v]) => setSongIntensity(v)}
                min={0}
                max={100}
                step={1}
              />
              <div className="text-xs text-muted-foreground text-center">{songIntensity}%</div>
            </div>

            <div className="space-y-2">
              <Label>Song Section</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['intro', 'verse', 'chorus', 'bridge', 'solo', 'outro'] as SongSection[]).map((section) => (
                  <Button
                    key={section}
                    variant={songSection === section ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSongSection(section)}
                    className="capitalize"
                  >
                    {section}
                  </Button>
                ))}
              </div>
            </div>

            <Button 
              onClick={startAutoProgress}
              disabled={isAutoProgressing}
              className="w-full"
              variant="secondary"
            >
              {isAutoProgressing ? 'Auto-Progressing...' : 'Simulate Song Progression'}
            </Button>
          </Card>

          {/* Camera Controls */}
          <Card className="p-3 md:p-4 space-y-2 md:space-y-4 min-w-[280px] lg:min-w-0">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Camera Controls</h3>
            </div>

            <div className="space-y-2">
              <Label>Camera Mode</Label>
              <Select value={cameraMode} onValueChange={(v) => setCameraMode(v as CameraMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pov">👤 POV (Crowd View)</SelectItem>
                  <SelectItem value="orbit">🔄 Orbit (Free Rotate)</SelectItem>
                  <SelectItem value="free">🎮 Free Camera</SelectItem>
                  <SelectItem value="cinematic">🎬 Cinematic</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {cameraMode === 'pov' && 'Locked crowd perspective with head bobbing'}
                {cameraMode === 'orbit' && 'Click and drag to rotate. Scroll to zoom.'}
                {cameraMode === 'free' && 'WASD to move. Mouse to look around.'}
                {cameraMode === 'cinematic' && 'Automated camera sweep around stage'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Zoom Level</Label>
              <Slider 
                value={[zoomLevel]} 
                onValueChange={([v]) => setZoomLevel(v)}
                min={5}
                max={30}
                step={0.5}
              />
              <div className="text-xs text-muted-foreground text-center">{zoomLevel.toFixed(1)}m</div>
            </div>
          </Card>

          {/* Visual Controls */}
          <Card className="p-3 md:p-4 space-y-2 md:space-y-4 min-w-[280px] lg:min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Visual Quality</h3>
            </div>

            <div className="space-y-2">
              <Label>Performance Tier</Label>
              <Select value={performanceTier} onValueChange={(v) => setPerformanceTier(v as PerformanceTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Best FPS)</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High (Best Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Enable Shadows</Label>
              <Switch checked={enableShadows} onCheckedChange={setEnableShadows} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Post-Processing Effects</Label>
              <Switch checked={enablePostProcessing} onCheckedChange={setEnablePostProcessing} />
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-2 min-w-[280px] lg:min-w-0">
            <Button onClick={resetToDefaults} variant="outline" className="w-full text-xs md:text-sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Info Panel */}
          <Card className="p-3 md:p-4 space-y-2 bg-muted/50 min-w-[280px] lg:min-w-0">
            <h4 className="font-semibold text-xs md:text-sm">Current State</h4>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div>• Crowd: {getMoodLabel(crowdMood)} ({crowdMood}%)</div>
              <div>• Density: {Math.round(crowdDensity * 100)}% ({maxCrowdCount} max)</div>
              <div>• Fame: {bandFame.toLocaleString()} ({getMerchPercentage(bandFame)}% merch)</div>
              <div>• Section: {songSection.toUpperCase()}</div>
              <div>• Quality: {performanceTier.toUpperCase()}</div>
            </div>
          </Card>
          </div>
        </div>
        )}

        {/* 3D Preview */}
        <div className="flex-1 relative min-h-[400px]">
          <GigDemoViewer
            crowdMood={crowdMood}
            bandFame={bandFame}
            songIntensity={songIntensity / 100}
            crowdDensity={crowdDensity}
            maxCrowdCount={maxCrowdCount}
            performanceTier={performanceTier}
            enableShadows={enableShadows}
            enablePostProcessing={enablePostProcessing}
            stageTemplateId={stageTemplateId}
            floorType={floorType}
            backdropType={backdropType}
            merchColor={merchColor}
            bandName={bandName}
            songSection={songSection}
            isOutdoor={isOutdoor}
            timeOfDay={timeOfDay}
            cameraMode={cameraMode}
            zoomLevel={zoomLevel}
          />
        </div>
      </div>
    </div>
  );
}
