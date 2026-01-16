import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Music, Users, Sparkles, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RpmAvatarImage } from "@/components/gig-viewer/RpmAvatarImage";
import { InstrumentOverlay } from "@/components/gig-viewer/InstrumentOverlay";
import { SimpleStageBackground } from "@/components/gig-viewer/SimpleStageBackground";
import { StageSpotlights } from "@/components/gig-viewer/StageSpotlights";
import { RPM_BAND_AVATARS } from "@/data/rpmAvatarPool";
import { useIsMobile } from "@/hooks/use-mobile";

type SongSection = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';

// Demo band configuration
const DEMO_BAND = [
  { role: 'vocalist' as const, avatarUrl: RPM_BAND_AVATARS[0] || null },
  { role: 'guitarist' as const, avatarUrl: RPM_BAND_AVATARS[1] || null },
  { role: 'bassist' as const, avatarUrl: RPM_BAND_AVATARS[2] || null },
  { role: 'drummer' as const, avatarUrl: RPM_BAND_AVATARS[3] || null },
];

export default function ParallaxGigDemo() {
  const [crowdMood, setCrowdMood] = useState(50);
  const [songSection, setSongSection] = useState<SongSection>('chorus');
  const [isAutoProgressing, setIsAutoProgressing] = useState(false);
  const [useSessionMusicians, setUseSessionMusicians] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const isMobile = useIsMobile();

  const intensity = crowdMood / 100;

  // Toggle between real avatars and session musicians (no avatars)
  const bandMembers = useSessionMusicians
    ? DEMO_BAND.map(m => ({ ...m, avatarUrl: null })) // Simulate session musicians
    : DEMO_BAND;

  // Auto-progress through song sections
  const startAutoProgress = () => {
    setIsAutoProgressing(true);
    const sections: SongSection[] = ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'solo', 'outro'];
    let index = 0;
    
    const interval = setInterval(() => {
      index = (index + 1) % sections.length;
      setSongSection(sections[index]);
    }, 3000);

    setTimeout(() => {
      clearInterval(interval);
      setIsAutoProgressing(false);
    }, 24000);
  };

  const resetToDefaults = () => {
    setCrowdMood(50);
    setSongSection('chorus');
    setUseSessionMusicians(false);
  };

  const getMoodLabel = (mood: number) => {
    if (mood < 20) return "😴 Tired";
    if (mood < 40) return "😐 Bored";
    if (mood < 60) return "🙂 Mixed";
    if (mood < 80) return "😄 Energetic";
    return "🤩 Ecstatic";
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bebas text-foreground">Parallax Stage Demo</h1>
          <p className="text-xs lg:text-sm text-muted-foreground">Test the 2D parallax gig viewer</p>
        </div>
        <div className="flex items-center gap-2">
          {isMobile && (
            <Button variant="outline" size="sm" onClick={() => setShowControls(!showControls)}>
              {showControls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="ml-1">Controls</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RefreshCw className="h-4 w-4 lg:mr-2" />
            <span className="hidden lg:inline">Reset</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Control Panel - Collapsible on mobile */}
        <AnimatePresence>
          {(!isMobile || showControls) && (
            <motion.div 
              className="lg:w-80 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto p-4 space-y-4 shrink-0 max-h-[40vh] lg:max-h-none"
              initial={isMobile ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={isMobile ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
            >
          {/* Crowd Controls */}
          <Card className="p-4 space-y-4">
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
          </Card>

          {/* Song Section Controls */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Song Section</h3>
            </div>

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

            <Button 
              onClick={startAutoProgress}
              disabled={isAutoProgressing}
              className="w-full"
              variant="secondary"
            >
              {isAutoProgressing ? 'Auto-Progressing...' : 'Simulate Song'}
            </Button>
          </Card>

          {/* Band Configuration */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Band Configuration</h3>
            </div>

            <div className="space-y-2">
              <Label>Avatar Mode</Label>
              <Select 
                value={useSessionMusicians ? 'session' : 'rpm'} 
                onValueChange={(v) => setUseSessionMusicians(v === 'session')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rpm">🎭 RPM Avatars (Real Players)</SelectItem>
                  <SelectItem value="session">👤 Session Musicians (Fallback)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {useSessionMusicians 
                  ? 'Showing fallback avatars for session/touring musicians'
                  : 'Showing Ready Player Me 2D avatar renders'}
              </p>
            </div>
          </Card>

          {/* Info */}
          <Card className="p-4 bg-muted/50">
            <h4 className="font-semibold mb-2">How It Works</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• RPM avatars converted to 2D images via render API</li>
              <li>• CSS animations based on instrument role</li>
              <li>• Intensity scales with crowd mood</li>
              <li>• Spotlights change per song section</li>
              <li>• Session musicians get gradient fallbacks</li>
            </ul>
          </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage Preview - Takes remaining space, min height on mobile */}
        <div className="flex-1 relative bg-black overflow-hidden min-h-[50vh] lg:min-h-0">
          {/* Stage Background */}
          <SimpleStageBackground crowdMood={crowdMood} songSection={songSection} />
          
          {/* Spotlight Effects */}
          <StageSpotlights crowdMood={crowdMood} songSection={songSection} />
          
          {/* Band Members on Stage */}
          <div className="absolute inset-0 flex items-end justify-center pb-4 lg:pb-8">
            <div className="relative w-full max-w-4xl h-[50vh] lg:h-[60vh]">
              {/* Drummer (back center) */}
              <motion.div
                className="absolute bottom-[30%] left-1/2 -translate-x-1/2 z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <RpmAvatarImage
                  avatarUrl={bandMembers.find(m => m.role === 'drummer')?.avatarUrl || null}
                  role="drummer"
                  intensity={intensity}
                  songSection={songSection}
                  size="md"
                />
                <InstrumentOverlay role="drummer" />
              </motion.div>

              {/* Guitarist (front left) */}
              <motion.div
                className="absolute bottom-[5%] left-[15%] z-20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <RpmAvatarImage
                  avatarUrl={bandMembers.find(m => m.role === 'guitarist')?.avatarUrl || null}
                  role="guitarist"
                  intensity={intensity}
                  songSection={songSection}
                  size="lg"
                />
                <InstrumentOverlay role="guitarist" />
              </motion.div>

              {/* Vocalist (front center) */}
              <motion.div
                className="absolute bottom-[5%] left-1/2 -translate-x-1/2 z-30"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <RpmAvatarImage
                  avatarUrl={bandMembers.find(m => m.role === 'vocalist')?.avatarUrl || null}
                  role="vocalist"
                  intensity={intensity}
                  songSection={songSection}
                  size="xl"
                />
                <InstrumentOverlay role="vocalist" />
              </motion.div>

              {/* Bassist (front right) */}
              <motion.div
                className="absolute bottom-[5%] right-[15%] z-20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <RpmAvatarImage
                  avatarUrl={bandMembers.find(m => m.role === 'bassist')?.avatarUrl || null}
                  role="bassist"
                  intensity={intensity}
                  songSection={songSection}
                  size="lg"
                />
                <InstrumentOverlay role="bassist" />
              </motion.div>
            </div>
          </div>

          {/* Crowd Silhouettes */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
            <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end opacity-40">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-6 bg-black rounded-t-full"
                  animate={{
                    y: [0, -3, 0],
                  }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.5,
                    repeat: Infinity,
                    delay: Math.random() * 0.5,
                  }}
                  style={{
                    height: 20 + Math.random() * 20,
                  }}
                />
              ))}
            </div>
          </div>

          {/* HUD Overlay */}
          <div className="absolute top-4 left-4 z-40">
            <Card className="bg-black/60 backdrop-blur-sm border-white/20 px-4 py-3">
              <div className="text-white space-y-2">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-xs text-white/60">Song Section</div>
                    <div className="text-base font-bebas capitalize">{songSection}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <div className="space-y-1">
                    <div className="text-xs text-white/60">Crowd Energy</div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500"
                          animate={{ width: `${crowdMood}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-xs font-medium">{crowdMood}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
