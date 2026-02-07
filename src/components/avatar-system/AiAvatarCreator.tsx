import { useState, useRef, useCallback } from "react";
import { Camera, Upload, Sparkles, RefreshCw, Save, Palette, ChevronDown, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth-context";
import { useUserBand } from "@/hooks/useUserBand";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MUSIC_GENRES } from "@/data/genres";

const GENRE_STYLE_DESCRIPTIONS: Record<string, string> = {
  Rock: "Leather jacket, ripped jeans, band tees",
  "Modern Rock": "Leather jacket, ripped jeans, Chuck Taylors",
  "Heavy Metal": "Studded leather, bullet belt, black everything",
  "Metalcore/Djent": "Studded leather, spiked gauntlets, black boots",
  "Punk Rock": "Mohawk, safety pins, tartan, combat boots",
  "Hip Hop": "Oversized chains, designer streetwear, snapback",
  Trap: "Gold chains, face tattoos, grillz, baggy pants",
  Drill: "Dark streetwear, ski mask, puffer jacket",
  "Lo-Fi Hip Hop": "Vintage hoodie, round glasses, beanie",
  Pop: "Bright colors, trendy fits, statement accessories",
  "K-Pop/J-Pop": "Pastel colors, K-pop fashion, platform shoes",
  Jazz: "Sharp suit, fedora, vintage vibes",
  Blues: "Worn leather vest, weathered hat, work boots",
  Country: "Cowboy hat, boots, denim, big belt buckle",
  Reggae: "Rastafari colors, tropical fit, dreadlocks",
  Classical: "Formal tailcoat, bow tie, polished shoes",
  Electronica: "Neon rave gear, LED accessories, futuristic",
  EDM: "Neon outfit, LED visor, glow elements",
  Latin: "Bold vibrant colors, ruffled shirt, gold accents",
  Flamenco: "Red and black, ruffled details, rose accent",
  "World Music": "Eclectic cultural fabrics, colorful patterns",
  "R&B": "Sleek satin, gold jewelry, designer shoes",
  "Alt R&B/Neo-Soul": "Minimalist earth tones, statement jewelry",
  "African Music": "Vibrant ankara patterns, bold colors",
  "Afrobeats/Amapiano": "Ankara patterns, designer shades, gold",
  "Indie/Bedroom Pop": "Thrift store cardigan, retro glasses",
  Synthwave: "Retro-futuristic, neon pink and cyan, aviators",
  Hyperpop: "Hyper-colorful, platform boots, cyber accessories",
  Goth: "All black Victorian, dark makeup, silver jewelry",
};

interface AiAvatarCreatorProps {
  onSwitchToClassic?: () => void;
}

export function AiAvatarCreator({ onSwitchToClassic }: AiAvatarCreatorProps) {
  const { user } = useAuth();
  const { data: band } = useUserBand();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const activeGenre = selectedGenre || band?.genre || "Rock";
  const styleDescription = GENRE_STYLE_DESCRIPTIONS[activeGenre] || "Stylish musician outfit";

  // Fetch profile for generation count and current avatar
  const { data: profile } = useQuery({
    queryKey: ["profile-avatar", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, avatar_generation_count, cash")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const generationCount = profile?.avatar_generation_count ?? 0;
  const cost = generationCount > 0 ? 500 : 0;
  const canAfford = cost === 0 || (profile?.cash ?? 0) >= cost;

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedPhoto(reader.result as string);
      setGeneratedAvatar(null);
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [processFile]);

  const handleGenerate = async () => {
    if (!uploadedPhoto || !user?.id) return;

    if (!canAfford) {
      toast.error(`You need $${cost} to regenerate your avatar`);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 85) return prev;
        return prev + Math.random() * 8;
      });
    }, 1000);

    try {
      const response = await supabase.functions.invoke("generate-photo-avatar", {
        body: {
          photoBase64: uploadedPhoto,
          genre: activeGenre,
          userId: user.id,
        },
      });

      clearInterval(progressInterval);

      if (response.error) {
        // Check for specific HTTP error codes
        const status = (response.error as any)?.status;
        if (status === 429) {
          toast.error("AI service is busy. Please try again in a moment.");
        } else if (status === 402) {
          toast.error("AI credits exhausted. Please contact support.");
        } else {
          const errorMessage = response.error.message || "Failed to generate avatar";
          toast.error(errorMessage);
        }
        return;
      }

      const data = response.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setGenerationProgress(100);
      setGeneratedAvatar(data.avatarUrl);

      // Invalidate profile queries to refresh count/cash
      queryClient.invalidateQueries({ queryKey: ["profile-avatar"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      if (data.cost > 0) {
        toast.success(`Avatar generated! $${data.cost} deducted.`);
      } else {
        toast.success("Avatar generated for free!");
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Avatar generation error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card className="border-dashed border-2 border-border bg-card/50">
        <CardContent className="p-6">
          {/* File upload input - NO capture attribute so gallery/files appear */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          {/* Camera capture input - separate with capture attribute */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!uploadedPhoto ? (
            <div className="w-full flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <ImageIcon className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Upload Your Photo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Take a selfie or upload a photo to create your avatar
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="mr-1.5 h-4 w-4" /> Take Photo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" /> Upload
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Uploaded Photo */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Photo</p>
                  <AspectRatio ratio={3 / 4} className="overflow-hidden rounded-lg border border-border bg-muted">
                    <img
                      src={uploadedPhoto}
                      alt="Uploaded photo"
                      className="h-full w-full object-cover"
                    />
                  </AspectRatio>
                </div>

                {/* Generated Avatar */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Avatar</p>
                  <AspectRatio ratio={3 / 4} className="overflow-hidden rounded-lg border border-border bg-muted">
                    {generatedAvatar ? (
                      <img
                        src={generatedAvatar}
                        alt="Generated avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : isGenerating ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
                        <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                        <p className="text-sm font-medium text-foreground">Creating your avatar...</p>
                        <Progress value={generationProgress} className="w-3/4" />
                        <p className="text-xs text-muted-foreground">This takes 10-20 seconds</p>
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-10 w-10" />
                        <p className="text-sm">Hit Generate to see your avatar</p>
                      </div>
                    )}
                  </AspectRatio>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadedPhoto(null);
                  setGeneratedAvatar(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-muted-foreground"
              >
                <Upload className="mr-2 h-4 w-4" />
                Change Photo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Genre Selection */}
      {uploadedPhoto && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Outfit Style</p>
                <p className="text-xs text-muted-foreground">{styleDescription}</p>
              </div>
              {band?.genre && (
                <Badge variant="secondary" className="text-xs">
                  Band: {band.genre}
                </Badge>
              )}
            </div>

            <Select
              value={activeGenre}
              onValueChange={(value) => setSelectedGenre(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select genre style" />
              </SelectTrigger>
              <SelectContent>
                {MUSIC_GENRES.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    <div className="flex items-center gap-2">
                      <Palette className="h-3 w-3 text-muted-foreground" />
                      <span>{genre}</span>
                      {genre === band?.genre && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                          Band
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {uploadedPhoto && (
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !canAfford}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : generatedAvatar ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate {cost > 0 ? `($${cost})` : "(Free)"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Avatar {cost > 0 ? `($${cost})` : "(Free)"}
              </>
            )}
          </Button>

          {!canAfford && cost > 0 && (
            <p className="text-xs text-destructive text-center">
              Not enough cash. You need ${cost} to regenerate.
            </p>
          )}
        </div>
      )}

      {/* Switch to Classic */}
      {onSwitchToClassic && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSwitchToClassic}
            className="text-muted-foreground text-xs"
          >
            <Palette className="mr-1.5 h-3 w-3" />
            Use Classic Avatar Creator
          </Button>
        </div>
      )}
    </div>
  );
}
