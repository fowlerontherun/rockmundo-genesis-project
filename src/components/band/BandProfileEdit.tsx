import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Camera, Info, Loader2, Music, Save, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface BandProfileEditProps {
  bandId: string;
  bandName: string;
  logoUrl: string | null;
  soundDescription: string | null;
  isLeader: boolean;
  onUpdate?: () => void;
}

export function BandProfileEdit({
  bandId,
  bandName,
  logoUrl,
  soundDescription,
  isLeader,
  onUpdate,
}: BandProfileEditProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(soundDescription || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl);
  const [uploading, setUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: { logo_url?: string; sound_description?: string }) => {
      const { error } = await supabase
        .from("bands")
        .update(data)
        .eq("id", bandId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band", bandId] });
      toast({ title: "Profile Updated", description: "Band profile saved successfully" });
      onUpdate?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Logo must be under 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `band-logos/${bandId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setPreviewUrl(urlData.publicUrl);
      await updateMutation.mutateAsync({ logo_url: urlData.publicUrl });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDescription = () => {
    updateMutation.mutate({ sound_description: description });
  };

  if (!isLeader) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Band Profile
          </CardTitle>
          <CardDescription>Only the band leader can edit the profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={logoUrl || undefined} alt={bandName} />
              <AvatarFallback className="text-2xl">{bandName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{bandName}</p>
              {soundDescription && (
                <p className="text-sm text-muted-foreground mt-1">{soundDescription}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Band Profile
        </CardTitle>
        <CardDescription>Customize your band's identity and sound</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Band Logo</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-24 w-24 border-2 border-dashed border-border">
              <AvatarImage src={previewUrl || undefined} alt={bandName} />
              <AvatarFallback className="text-3xl bg-secondary">
                {bandName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </span>
                </Button>
              </Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
            </div>
          </div>
        </div>

        {/* Sound Description */}
        <div className="space-y-3">
          <Label htmlFor="sound-description">Sound Description</Label>
          <Textarea
            id="sound-description"
            placeholder="Describe your band's unique sound, style, and musical influences in one paragraph..."
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={4}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{description.length}/500 characters</p>
          </div>
        </div>

        {/* AI Prompt Info */}
        <Alert className="border-primary/30 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>AI Music Generation:</strong> Your sound description will be included in all 
              AI-generated music prompts for this band. Describe your signature style, influences, 
              and sonic characteristics to ensure generated songs match your vision.
            </span>
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <Button
          onClick={handleSaveDescription}
          disabled={updateMutation.isPending}
          className="w-full"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Profile
        </Button>
      </CardContent>
    </Card>
  );
}
