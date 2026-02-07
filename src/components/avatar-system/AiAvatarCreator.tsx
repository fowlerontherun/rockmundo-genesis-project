import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, Sparkles, RefreshCw, Save, Palette, ImageIcon } from "lucide-react";
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

/**
 * Resize and compress an image to ensure it's within the AI gateway's limits.
 * Camera photos can be 8-12MB raw which becomes even larger as base64.
 * This resizes to max 1024px and compresses to JPEG ~0.8 quality.
 */
function compressImage(dataUrl: string, maxSize = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if larger than maxSize
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Compress to JPEG at 0.8 quality — keeps base64 small
      const compressed = canvas.toDataURL("image/jpeg", 0.8);
      console.log(
        `[AiAvatar] Compressed image: ${Math.round(dataUrl.length / 1024)}KB → ${Math.round(compressed.length / 1024)}KB (${width}x${height})`
      );
      resolve(compressed);
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = dataUrl;
  });
}

export function AiAvatarCreator() {
  const { user } = useAuth();
  const { data: band } = useUserBand();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Restore saved avatar when profile loads (persistence fix)
  useEffect(() => {
    if (profile?.avatar_url && !generatedAvatar && !uploadedPhoto) {
      setGeneratedAvatar(profile.avatar_url);
    }
  }, [profile?.avatar_url]); // eslint-disable-line react-hooks/exhaustive-deps

  const generationCount = profile?.avatar_generation_count ?? 0;
  const cost = generationCount > 0 ? 500 : 0;
  const canAfford = cost === 0 || (profile?.cash ?? 0) >= cost;

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !file.name.match(/\.(heic|heif)$/i)) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawDataUrl = reader.result as string;
        // Compress to ensure consistent size for both camera & upload
        const compressed = await compressImage(rawDataUrl);
        setUploadedPhoto(compressed);
        setGeneratedAvatar(null);
      } catch (err) {
        console.error("[AiAvatar] Compression error:", err);
        // Fallback: use raw image if compression fails
        setUploadedPhoto(reader.result as string);
        setGeneratedAvatar(null);
      }
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

  const handleSaveAvatar = async () => {
    if (!generatedAvatar || !user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: generatedAvatar })
        .eq("user_id", user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["profile-avatar"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Avatar saved to your profile!");
    } catch (err) {
      console.error("Save avatar error:", err);
      toast.error("Failed to save avatar. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedPhoto || !user?.id) return;

    if (!canAfford) {
      toast.error(`You need $${cost} to regenerate your avatar`);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);

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

  // Determine if we have a saved avatar but no new photo yet (returning user state)
  const hasSavedAvatar = !!generatedAvatar && !uploadedPhoto;

  return (
    <div className="space-y-6">
      {/* Current Avatar Display (when returning to page with saved avatar) */}
      {hasSavedAvatar && (
        <Card className="border-border bg-card/50">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Current Avatar</p>
              <div className="w-40 h-52 overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src={generatedAvatar}
                  alt="Current avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-sm text-muted-foreground">Upload a new photo to regenerate</p>
            </div>
          </CardContent>
        </Card>
      )}

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
                <p className="font-medium text-foreground">
                  {hasSavedAvatar ? "Upload a New Photo" : "Upload Your Photo"}
                </p>
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
                  setGeneratedAvatar(profile?.avatar_url ?? null);
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

          {generatedAvatar && (
            <Button
              onClick={handleSaveAvatar}
              disabled={isSaving}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save as Profile Avatar
                </>
              )}
            </Button>
          )}

          {!canAfford && cost > 0 && (
            <p className="text-xs text-destructive text-center">
              Not enough cash. You need ${cost} to regenerate.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
