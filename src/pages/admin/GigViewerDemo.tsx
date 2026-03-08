import { useState, useEffect, useCallback, useMemo } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Play, Pause, RotateCcw, Eye, Settings2, Music2, Users, Zap, Sparkles, Flame } from "lucide-react";

import { TopDownStage, type StageMember } from "@/components/gig-viewer/TopDownStage";
import { TopDownCrowd } from "@/components/gig-viewer/TopDownCrowd";
import { TopDownHUD } from "@/components/gig-viewer/TopDownHUD";
import { TopDownCommentary, type CommentaryEntry } from "@/components/gig-viewer/TopDownCommentary";
import { VenueFeatures } from "@/components/gig-viewer/VenueFeatures";
import { ViewerControls } from "@/components/gig-viewer/ViewerControls";
import { WeatherAtmosphere } from "@/components/gig-viewer/WeatherAtmosphere";
import { SongTransition } from "@/components/gig-viewer/SongTransition";
import { AudienceInteractions } from "@/components/gig-viewer/AudienceInteractions";
import { SeatingTiers } from "@/components/gig-viewer/SeatingTiers";
import { PerformanceMilestones } from "@/components/gig-viewer/PerformanceMilestones";
import { CrowdDetails } from "@/components/gig-viewer/CrowdDetails";
import { getStageTheme } from "@/components/gig-viewer/StageThemes";
import { getGenreVisuals, getGenreLightingColor, GENRE_VISUALS } from "@/components/gig-viewer/GenreVisuals";

const VENUE_TYPES = [
  { value: 'bar', label: 'Bar / Pub' },
  { value: 'indie_venue', label: 'Indie Venue' },
  { value: 'rock_club', label: 'Rock Club' },
  { value: 'concert_hall', label: 'Concert Hall' },
  { value: 'arena', label: 'Arena' },
  { value: 'stadium', label: 'Stadium' },
  { value: 'festival_ground', label: 'Festival Ground' },
  { value: 'outdoor', label: 'Outdoor Stage' },
];

const GENRES = Object.keys(GENRE_VISUALS);

const MOODS = ['ecstatic', 'enthusiastic', 'engaged', 'mixed', 'disappointed'] as const;

const DEMO_MEMBERS: StageMember[] = [
  { id: '1', name: 'Lead Vocals', instrumentRole: 'Vocals', vocalRole: 'lead', performanceScore: 20, skillContribution: 18 },
  { id: '2', name: 'Lead Guitar', instrumentRole: 'Guitar', performanceScore: 22, skillContribution: 21 },
  { id: '3', name: 'Rhythm Guitar', instrumentRole: 'Guitar', performanceScore: 18, skillContribution: 16 },
  { id: '4', name: 'Bass', instrumentRole: 'Bass', performanceScore: 19, skillContribution: 17 },
  { id: '5', name: 'Drums', instrumentRole: 'Drums', performanceScore: 21, skillContribution: 20 },
  { id: '6', name: 'Keys', instrumentRole: 'Keyboard', performanceScore: 17, skillContribution: 15 },
];

const DEMO_SONGS = [
  { title: 'Opening Thunder', score: 18, played: true },
  { title: 'Electric Dreams', score: 22, played: true },
  { title: 'Midnight Fire', score: 20, played: true },
  { title: 'Soul Revolution', score: 0, played: false },
  { title: 'Final Countdown', score: 0, played: false },
];

const GigViewerDemo = () => {
  // Demo controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [venueType, setVenueType] = useState<string>('arena');
  const [genre, setGenre] = useState<string>('Rock');
  const [crowdMood, setCrowdMood] = useState<typeof MOODS[number]>('enthusiastic');
  const [songEnergy, setSongEnergy] = useState<'high' | 'medium' | 'low'>('high');
  const [intensity, setIntensity] = useState(0.7);
  const [attendancePercent, setAttendancePercent] = useState(85);
  const [momentum, setMomentum] = useState(2);
  const [currentSongIndex, setCurrentSongIndex] = useState(2);
  const [showStats, setShowStats] = useState(false);
  const [isFinale, setIsFinale] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEncore, setIsEncore] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [cameraZoom, setCameraZoom] = useState<'full' | 'stage'>('full');
  
  // Demo commentary
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([
    { id: '1', timestamp: new Date(Date.now() - 30000), type: 'arrival', message: 'The crowd ERUPTS as the band takes the stage! 🔥', variant: 'success' },
    { id: '2', timestamp: new Date(Date.now() - 20000), type: 'song_start', message: "They launch into 'Electric Dreams' with explosive energy!" },
    { id: '3', timestamp: new Date(Date.now() - 10000), type: 'crowd_reaction', message: 'The crowd is going ABSOLUTELY WILD! 🔥', variant: 'success' },
  ]);

  // Genre visuals
  const genreVisuals = useMemo(() => getGenreVisuals(genre), [genre]);
  const lightingColor = useMemo(() => getGenreLightingColor(genreVisuals, crowdMood), [genreVisuals, crowdMood]);
  const stageTheme = useMemo(() => getStageTheme(venueType), [venueType]);

  // Auto-advance simulation
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      // Simulate momentum changes
      setMomentum(prev => {
        const change = (Math.random() - 0.3) * 0.5;
        return Math.max(-3, Math.min(3, prev + change));
      });
      
      // Simulate intensity fluctuations
      setIntensity(prev => {
        const change = (Math.random() - 0.5) * 0.1;
        return Math.max(0.2, Math.min(1, prev + change));
      });
      
      // Random commentary
      if (Math.random() < 0.15) {
        const messages = [
          { type: 'special_moment', message: 'The lead guitarist pulls off an INSANE solo! 🎸', variant: 'success' as const },
          { type: 'crowd_reaction', message: 'PANDEMONIUM! The energy is OFF THE CHARTS!', variant: 'success' as const },
          { type: 'special_moment', message: 'Camera flashes light up the venue like stars! 📸' },
          { type: 'crowd_reaction', message: 'The whole venue is bouncing! The floor is SHAKING!' },
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        setCommentary(prev => [...prev.slice(-10), { 
          id: crypto.randomUUID(), 
          timestamp: new Date(), 
          ...msg 
        }]);
      }
    }, 2000 / playbackSpeed);
    
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Trigger song transition
  const triggerTransition = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 2500);
  }, []);

  // Reset demo
  const resetDemo = useCallback(() => {
    setIsPlaying(false);
    setMomentum(0);
    setIntensity(0.5);
    setCurrentSongIndex(0);
    setIsFinale(false);
    setIsEncore(false);
    setCommentary([]);
  }, []);

  // Camera zoom style
  const zoomStyle = cameraZoom === 'stage'
    ? { transform: 'scale(1.5) translateY(15%)', transformOrigin: 'top center' }
    : {};

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gig Viewer Demo</h1>
            <p className="text-muted-foreground">Test and preview the Top-Down Gig Viewer with configurable parameters</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview Mode
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Viewer Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Music2 className="h-5 w-5" />
                    Live Preview
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={isPlaying ? "destructive" : "default"} onClick={() => setIsPlaying(!isPlaying)}>
                      {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetDemo}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="relative w-full rounded-lg overflow-hidden border border-border bg-black" style={{ aspectRatio: '16/10' }}>
                  <div style={zoomStyle} className="w-full h-full transition-transform duration-500">
                    {/* Weather/atmosphere for outdoor venues */}
                    <WeatherAtmosphere venueType={venueType} songEnergy={songEnergy} intensity={intensity} />

                    {/* Stage area */}
                    <div className="absolute top-0 left-0 right-0" style={{ height: '55%' }}>
                      <TopDownStage
                        members={DEMO_MEMBERS}
                        intensity={intensity}
                        songEnergy={songEnergy}
                        lightingColor={lightingColor}
                        venueType={venueType}
                        genreVisuals={genreVisuals}
                        crowdMood={crowdMood}
                        showStats={showStats}
                        isFinale={isFinale}
                        songTitle={DEMO_SONGS[currentSongIndex]?.title}
                        bandName="The Demo Band"
                      />
                    </div>

                    {/* Crowd area */}
                    <div className="absolute bottom-0 left-0 right-0" style={{ height: '45%' }}>
                      <SeatingTiers
                        venueType={venueType}
                        attendancePercent={attendancePercent}
                        mood={crowdMood}
                        intensity={intensity}
                      />
                      <VenueFeatures theme={stageTheme} intensity={intensity} />
                      <AudienceInteractions
                        mood={crowdMood}
                        songEnergy={songEnergy}
                        intensity={intensity}
                        attendancePercent={attendancePercent}
                      />
                      <TopDownCrowd
                        attendancePercent={attendancePercent}
                        mood={crowdMood}
                        intensity={intensity}
                        genreVisuals={genreVisuals}
                        songEnergy={songEnergy}
                      />
                      <CrowdDetails
                        attendancePercent={attendancePercent}
                        mood={crowdMood}
                        intensity={intensity}
                        genreVisuals={genreVisuals}
                        songEnergy={songEnergy}
                      />
                    </div>
                  </div>

                  {/* Overlays */}
                  <SongTransition
                    isTransitioning={isTransitioning}
                    songTitle={DEMO_SONGS[currentSongIndex]?.title || 'Demo Song'}
                    songIndex={currentSongIndex}
                    isEncore={isEncore}
                    isFinale={isFinale}
                  />
                  <PerformanceMilestones
                    averageScore={20}
                    songsPlayed={currentSongIndex + 1}
                    crowdMood={crowdMood}
                    momentum={momentum}
                  />
                  <TopDownHUD
                    songTitle={DEMO_SONGS[currentSongIndex]?.title || 'Demo Song'}
                    songIndex={currentSongIndex}
                    totalSongs={DEMO_SONGS.length}
                    crowdMood={crowdMood}
                    attendancePercent={attendancePercent}
                    venueName={`Demo ${VENUE_TYPES.find(v => v.value === venueType)?.label || 'Venue'}`}
                    attendance={Math.round(attendancePercent * 100)}
                    venueCapacity={10000}
                    isLive={isPlaying}
                    momentum={momentum}
                    songScores={DEMO_SONGS}
                  />
                  <TopDownCommentary entries={commentary} />
                  <ViewerControls
                    playbackSpeed={playbackSpeed}
                    onSpeedChange={setPlaybackSpeed}
                    cameraZoom={cameraZoom}
                    onCameraChange={setCameraZoom}
                    showStats={showStats}
                    onStatsToggle={setShowStats}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Venue Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Venue Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Venue Type</Label>
                  <Select value={venueType} onValueChange={setVenueType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VENUE_TYPES.map(v => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Attendance: {attendancePercent}%</Label>
                  <Slider
                    value={[attendancePercent]}
                    onValueChange={([v]) => setAttendancePercent(v)}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Music Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Music2 className="h-4 w-4" />
                  Music & Genre
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {GENRES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Song Energy</Label>
                  <Select value={songEnergy} onValueChange={(v) => setSongEnergy(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Energy</SelectItem>
                      <SelectItem value="medium">Medium Energy</SelectItem>
                      <SelectItem value="low">Low Energy (Ballad)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Current Song</Label>
                  <Select value={String(currentSongIndex)} onValueChange={(v) => setCurrentSongIndex(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_SONGS.map((s, i) => (
                        <SelectItem key={i} value={String(i)}>{i + 1}. {s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button variant="outline" size="sm" className="w-full" onClick={triggerTransition}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Trigger Song Transition
                </Button>
              </CardContent>
            </Card>

            {/* Crowd Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Crowd & Energy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Crowd Mood</Label>
                  <Select value={crowdMood} onValueChange={(v) => setCrowdMood(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOODS.map(m => (
                        <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Intensity: {(intensity * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[intensity * 100]}
                    onValueChange={([v]) => setIntensity(v / 100)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Momentum: {momentum > 0 ? '+' : ''}{momentum.toFixed(1)}</Label>
                  <Slider
                    value={[momentum]}
                    onValueChange={([v]) => setMomentum(v)}
                    min={-3}
                    max={3}
                    step={0.5}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Special Effects */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flame className="h-4 w-4" />
                  Special Effects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Show Stats Overlay</Label>
                  <Switch checked={showStats} onCheckedChange={setShowStats} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Finale Mode</Label>
                  <Switch checked={isFinale} onCheckedChange={setIsFinale} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Encore Mode</Label>
                  <Switch checked={isEncore} onCheckedChange={setIsEncore} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
};

export default GigViewerDemo;
