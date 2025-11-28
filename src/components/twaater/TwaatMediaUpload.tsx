import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Image, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface TwaatMediaUploadProps {
  onMediaUploaded: (url: string, type: 'image' | 'video') => void;
  onMediaRemoved: () => void;
  currentMediaUrl?: string;
}

export const TwaatMediaUpload = ({ onMediaUploaded, onMediaRemoved, currentMediaUrl }: TwaatMediaUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('twaater-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('twaater-media')
        .getPublicUrl(filePath);

      onMediaUploaded(publicUrl, 'image');
      
      toast({
        title: "Image uploaded",
        description: "Your image has been attached to the twaat",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (currentMediaUrl) {
    return (
      <div className="relative inline-block mt-2">
        <img 
          src={currentMediaUrl} 
          alt="Upload preview" 
          className="max-h-48 rounded border"
        />
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2"
          onClick={onMediaRemoved}
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
        accept="image/*"
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
            <Image className="h-4 w-4" />
            <span className="ml-1">{isUploading ? "Uploading..." : "Image"}</span>
          </span>
        </Button>
      </label>
    </div>
  );
};