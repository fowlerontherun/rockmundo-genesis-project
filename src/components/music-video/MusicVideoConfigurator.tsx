import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { calculateMusicVideoPlan } from "@/lib/musicVideoMetrics";
import { Film, Palette, Coins, Users, Camera, MapPin, Youtube, Sparkles } from "lucide-react";

export interface ReleaseOption {
  id: string;
  title: string;
  artist_name: string | null;
  release_type: string;
  release_status: string;
  band_id: string | null;
}

export interface MusicVideoConfiguratorResult {
  releaseId: string | null;
  theme: string;
  artStyle: string;
  budgetTier: string;
  imageQuality: string;
  castOption: string;
  castQuality?: string | null;
  locationStyle?: string | null;
  productionNotes?: string | null;
  youtubeUrl?: string | null;
  budgetAmount: number;
}

interface MusicVideoConfiguratorProps {
  releases: ReleaseOption[];
  onCreate: (result: MusicVideoConfiguratorResult) => void;
  isSaving: boolean;
}

const themeOptions = [
  { value: "cinematic", label: "Cinematic Narrative", description: "Story-driven, filmic visuals" },
  { value: "performance", label: "Performance Showcase", description: "Stage and choreography focus" },
  { value: "animated", label: "Animated", description: "Stylized or fully animated experience" },
  { value: "narrative", label: "Concept Narrative", description: "Character and plot heavy" },
  { value: "experimental", label: "Experimental", description: "Art-house, abstract visuals" },
];

const artStyles = [
  { value: "neon_cyberpunk", label: "Neon Cyberpunk" },
  { value: "vintage_film", label: "Vintage Film" },
  { value: "modern_minimal", label: "Modern Minimal" },
  { value: "surrealist", label: "Surrealist" },
  { value: "documentary", label: "Documentary" },
];

const budgetTiers = [
  { value: "diy", label: "DIY" },
  { value: "indie", label: "Indie" },
  { value: "studio", label: "Studio" },
  { value: "blockbuster", label: "Blockbuster" },
];

const imageQualities = [
  { value: "hd", label: "HD" },
  { value: "4k", label: "4K" },
  { value: "6k", label: "6K" },
  { value: "8k", label: "8K" },
];

const castOptions = [
  { value: "band_only", label: "Band Only" },
  { value: "featured_dancers", label: "Featured Dancers" },
  { value: "celebrity_cameo", label: "Celebrity Cameo" },
  { value: "professional_actors", label: "Professional Cast" },
];

const castQualityOptions = [
  { value: "emerging", label: "Emerging Talent" },
  { value: "seasoned", label: "Seasoned Performers" },
  { value: "award_winning", label: "Award Winning" },
];

const locationStyles = [
  { value: "studio_with_led", label: "LED Volume Stage" },
  { value: "urban_night", label: "Urban Nightscape" },
  { value: "desert_scape", label: "Desert Landscape" },
  { value: "sound_stage", label: "Sound Stage" },
  { value: "on_tour", label: "On Tour Documentary" },
];

export function MusicVideoConfigurator({ releases, onCreate, isSaving }: MusicVideoConfiguratorProps) {
  const [selectedRelease, setSelectedRelease] = useState<string | null>(releases[0]?.id ?? null);
  const [theme, setTheme] = useState("cinematic");
  const [artStyle, setArtStyle] = useState("neon_cyberpunk");
  const [budgetTier, setBudgetTier] = useState("studio");
  const [imageQuality, setImageQuality] = useState("4k");
  const [castOption, setCastOption] = useState("band_only");
  const [castQuality, setCastQuality] = useState<string | null>("seasoned");
  const [locationStyle, setLocationStyle] = useState<string | null>("studio_with_led");
  const [productionNotes, setProductionNotes] = useState<string>("");
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");

  useEffect(() => {
    if (!selectedRelease && releases[0]?.id) {
      setSelectedRelease(releases[0].id);
    }
  }, [releases, selectedRelease]);

  const plan = useMemo(
    () =>
      calculateMusicVideoPlan({
        theme,
        artStyle,
        budgetTier,
        imageQuality,
        castOption,
        castQuality,
        locationStyle,
      }),
    [theme, artStyle, budgetTier, imageQuality, castOption, castQuality, locationStyle]
  );

  const release = releases.find((r) => r.id === selectedRelease) ?? null;

  const handleSubmit = () => {
    onCreate({
      releaseId: selectedRelease,
      theme,
      artStyle,
      budgetTier,
      imageQuality,
      castOption,
      castQuality: castOption === "band_only" ? null : castQuality,
      locationStyle,
      productionNotes: productionNotes || undefined,
      youtubeUrl: youtubeUrl || undefined,
      budgetAmount: plan.budgetAmount,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="space-y-6">
        <CardHeader>
          <CardTitle className="text-xl">Video Blueprint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Attach to Release</Label>
              <Select value={selectedRelease ?? "unlinked"} onValueChange={(value) => setSelectedRelease(value === "unlinked" ? null : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a release" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlinked">Standalone Visual</SelectItem>
                  {releases.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.title} • {option.release_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {release && (
                <p className="text-xs text-muted-foreground">
                  {release.artist_name} • {release.release_status}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  {themeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Art Direction</Label>
              <Select value={artStyle} onValueChange={setArtStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an art style" />
                </SelectTrigger>
                <SelectContent>
                  {artStyles.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Budget Tier</Label>
              <Select value={budgetTier} onValueChange={setBudgetTier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a budget" />
                </SelectTrigger>
                <SelectContent>
                  {budgetTiers.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Image Quality</Label>
              <Select value={imageQuality} onValueChange={setImageQuality}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  {imageQualities.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cast Configuration</Label>
              <Select value={castOption} onValueChange={(value) => {
                setCastOption(value);
                if (value === "band_only") {
                  setCastQuality(null);
                } else if (!castQuality) {
                  setCastQuality("seasoned");
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cast" />
                </SelectTrigger>
                <SelectContent>
                  {castOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {castOption !== "band_only" && (
              <div className="space-y-2">
                <Label>Cast Quality</Label>
              <Select value={castQuality ?? undefined} onValueChange={(value) => setCastQuality(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    {castQualityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Location Style</Label>
              <Select value={locationStyle ?? undefined} onValueChange={(value) => setLocationStyle(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locationStyles.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Production Notes</Label>
              <Textarea
                placeholder="Storyboard beats, performance cues, or logistics"
                value={productionNotes}
                onChange={(event) => setProductionNotes(event.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>YouTube Video URL</Label>
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={isSaving} className="w-full">
            {isSaving ? "Saving plan..." : "Create Music Video Plan"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle className="text-lg">Projected Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              <span>Theme</span>
            </div>
            <Badge variant="secondary">{themeOptions.find((t) => t.value === theme)?.label ?? theme}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span>Art Style</span>
            </div>
            <Badge variant="secondary">{artStyles.find((a) => a.value === artStyle)?.label ?? artStyle}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              <span>Budget</span>
            </div>
            <span className="font-semibold">${plan.budgetAmount.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              <span>Image Quality</span>
            </div>
            <Badge variant="outline">{imageQualities.find((q) => q.value === imageQuality)?.label ?? imageQuality}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Cast Strategy</span>
            </div>
            <Badge variant="outline">{castOptions.find((c) => c.value === castOption)?.label ?? castOption}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>Location Plan</span>
            </div>
            <Badge variant="outline">{locationStyles.find((l) => l.value === locationStyle)?.label ?? locationStyle}</Badge>
          </div>

          <div className="rounded-lg border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Projected YouTube Views</span>
              <div className="flex items-center gap-2 font-semibold">
                <Youtube className="h-4 w-4 text-red-500" />
                {plan.youtubeViews.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Projected Chart Position</span>
              <Badge>{plan.chartPosition}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Chart Velocity</span>
              <Badge variant="secondary">{plan.chartVelocity}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">MTV Spin Potential</span>
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4" />
                {plan.mtvSpins}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
