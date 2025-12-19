import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Upload, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LabelLogoUploadProps {
  logoUrl: string | null;
  onLogoChange: (url: string | null) => void;
  labelName?: string;
  disabled?: boolean;
}

export function LabelLogoUpload({ logoUrl, onLogoChange, labelName, disabled }: LabelLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `label-logo-${Date.now()}.${fileExt}`;
      const filePath = `label-logos/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      onLogoChange(urlData.publicUrl);
      toast({
        title: "Logo uploaded",
        description: "Your label logo has been uploaded successfully.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    onLogoChange(null);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16 border-2 border-border">
        <AvatarImage src={logoUrl || undefined} alt={labelName || "Label logo"} />
        <AvatarFallback className="bg-muted">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className={cn(isUploading && "opacity-50")}
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "Uploading..." : logoUrl ? "Change" : "Upload Logo"}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Max 2MB, JPG/PNG/GIF</p>
      </div>
    </div>
  );
}