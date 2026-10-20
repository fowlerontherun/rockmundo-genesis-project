import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CrowdAudioManager } from "@/features/shared-audio/CrowdAudioManager";
import { loadCuratedCrowdAssets, selectCuratedCrowdClip } from "@/features/shared-audio/crowdAudioCatalogue";
import type { CrowdCategory, CrowdEnvironment, CrowdSize } from "@/features/gig-experience/audio/crowdCueSelection";

/** Admin playback follows the same filtering, volume, ducking and cleanup rules as the viewers. */
export function CrowdMixPreview() {
  const [category, setCategory] = useState<CrowdCategory>("applause");
  const [environment, setEnvironment] = useState<Exclude<CrowdEnvironment, "any">>("studio");
  const [crowdSize, setCrowdSize] = useState<Exclude<CrowdSize, "any">>("medium");
  const [intensity, setIntensity] = useState(3);
  const [volume, setVolume] = useState(0.6);
  const [speaking, setSpeaking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const manager = useRef<CrowdAudioManager | null>(null);
  if (!manager.current) manager.current = new CrowdAudioManager();
  const library = useQuery({ queryKey: ["crowd-audio", "preview"], queryFn: loadCuratedCrowdAssets });

  useEffect(() => {
    manager.current?.setCrowdVolume(volume);
    manager.current?.setDialogueActive(speaking);
  }, [volume, speaking]);
  useEffect(() => () => {
    manager.current?.dispose();
    manager.current = null;
  }, []);

  const preview = () => {
    const engine = manager.current!;
    engine.stop();
    engine.prime();
    engine.setCrowdVolume(volume);
    engine.setDialogueActive(speaking);
    const clip = selectCuratedCrowdClip(library.data ?? [], {
      category, environment, crowdSize, intensity,
      seed: `admin:${category}:${environment}:${crowdSize}:${intensity}`,
      atSeconds: 0, history: [],
    });
    if (!clip) { setPreviewing(false); return; }
    setPreviewing(true);
    if (category === "ambient") void engine.setAmbience(clip);
    else void engine.playReaction(clip, 0);
  };
  const stop = () => { manager.current?.stop(); setPreviewing(false); };

  return (
    <Card data-crowd-mix-preview>
      <CardHeader>
        <CardTitle>Crowd Mix Preview</CardTitle>
        <CardDescription>
          Audition approved recordings using the live venue, audience, intensity and speech-ducking rules. Music and presenter volume are unaffected. Unapproved recordings remain available for individual admin review in Crowd Sounds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label>Event</Label><Select value={category} onValueChange={(value) => setCategory(value as CrowdCategory)}><SelectTrigger aria-label="Crowd cue category"><SelectValue /></SelectTrigger><SelectContent>{(["ambient","applause","cheer","encore","finale","reaction"] as const).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Venue</Label><Select value={environment} onValueChange={(value) => setEnvironment(value as Exclude<CrowdEnvironment, "any">)}><SelectTrigger aria-label="Crowd venue"><SelectValue /></SelectTrigger><SelectContent>{(["pub","club","indoor","arena","festival","outdoor","studio"] as const).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Crowd size</Label><Select value={crowdSize} onValueChange={(value) => setCrowdSize(value as Exclude<CrowdSize, "any">)}><SelectTrigger aria-label="Crowd size"><SelectValue /></SelectTrigger><SelectContent>{(["small","medium","large"] as const).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="crowd-preview-intensity">Intensity: {intensity}</Label><Slider id="crowd-preview-intensity" aria-label="Preview crowd intensity" min={1} max={5} step={1} value={[intensity]} onValueChange={([value]) => setIntensity(value)} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-44 space-y-1"><Label htmlFor="crowd-preview-volume">Crowd volume: {Math.round(volume * 100)}%</Label><Slider id="crowd-preview-volume" aria-label="Preview crowd volume" min={0} max={100} value={[Math.round(volume * 100)]} onValueChange={([value]) => setVolume(value / 100)} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={speaking} onCheckedChange={setSpeaking} /> Presenter speaking (duck crowd)</label>
          <Button onClick={preview} type="button" disabled={library.isLoading || !library.data?.length}>Play selected cue</Button>
          <Button onClick={stop} type="button" variant="outline" disabled={!previewing}>Stop all crowd audio</Button>
        </div>
        <p className="text-xs text-muted-foreground" role="status">
          {library.isError ? "Could not load approved recordings." :
            !library.data?.length ? "No rights-confirmed recordings enabled yet." :
            `${library.data.length} published recordings available for this preview. A mismatched venue/size/cue stays silent.`}
        </p>
      </CardContent>
    </Card>
  );
}
