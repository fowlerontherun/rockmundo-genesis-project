import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Image, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface TwaatMediaUploadProps {
  onMediaUploaded: (url: string, type: "image" | "video") => void;
  onMediaRemoved: () => void;
  currentMediaUrl?: string;
  currentMediaType?: "image" | "video" | null;
}

const IMAGE_LIMIT = 5 * 1024 * 1024;
const VIDEO_LIMIT = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export const TwaatMediaUpload = ({
  onMediaUploaded,
  onMediaRemoved,
  currentMediaUrl,
  currentMediaType,
}: TwaatMediaUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);

    if (!isImage && !isVideo) {
      toast({
        title: "Invalid file type",
        description: "Use JPG, PNG, WebP, GIF, MP4 or WebM media.",
        variant: "destructive",
      });
      return;
    }

    const sizeLimit = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT;
    if (file.size > sizeLimit) {
      toast({
        title: "File too large",
        description: isVideo ? "Videos must be 25MB or smaller." : "Images must be 5MB or smaller.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("You must be signed in to upload media.");

      const safeExt = isVideo
        ? (file.type === "video/webm" ? "webm" : "mp4")
        : ({
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
          } as Record<string, string>)[file.type];

      const filePath = `${authData.user.id}/${crypto.randomUUID()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from("twaater-media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("twaater-media")
        .getPublicUrl(filePath);

      setUploadedPath(filePath);
      onMediaUploaded(publicUrl, isVideo ? "video" : "image");

      toast({
        title: isVideo ? "Video uploaded" : "Image uploaded",
        description: "Your media has been attached to the Twaat.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "The media could not be uploaded.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (uploadedPath) {
      const { error } = await supabase.storage
        .from("twaater-media")
        .remove([uploadedPath]);

      if (error) {
        toast({
          title: "Media cleanup failed",
          description: "The attachment was removed from the draft, but its uploaded file could not be deleted.",
          variant: "destructive",
        });
      } else {
        setUploadedPath(null);
      }
    }

    onMediaRemoved();
  };

  if (currentMediaUrl) {
    return (
      <div className="relative inline-block mt-2 max-w-full">
        {currentMediaType === "video" ? (
          <video
            src={currentMediaUrl}
            controls
            preload="metadata"
            className="max-h-64 max-w-full rounded border"
          />
        ) : (
          <img
            src={currentMediaUrl}
            alt="Upload preview"
            className="max-h-48 max-w-full rounded border object-contain"
          />
        )}
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2"
          onClick={handleRemove}
          aria-label="Remove media"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        onChange={handleFileSelect}
        className="hidden"
        id="media-upload"
        disabled={isUploading}
      />
      <label htmlFor="media-upload">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isUploading}
          asChild
        >
          <span className="cursor-pointer">
            {isUploading ? <Image className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            <span className="ml-1">{isUploading ? "Uploading..." : "Media"}</span>
          </span>
        </Button>
      </label>
    </div>
  );
};
