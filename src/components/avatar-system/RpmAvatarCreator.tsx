import { useState } from "react";
import { AvatarCreator, AvatarCreatorConfig, AvatarExportedEvent } from '@readyplayerme/react-avatar-creator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, User, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

interface RpmAvatarCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAvatarCreated?: (url: string) => void;
}

// RPM Avatar Creator configuration for full-body avatars
const avatarConfig: AvatarCreatorConfig = {
  clearCache: true,
  bodyType: 'fullbody',
  quickStart: false,
  language: 'en',
};

// Add texture optimization parameters to avatar URL
export const optimizeAvatarUrl = (url: string): string => {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  // Request optimized textures to reduce GPU load
  return `${url}${separator}textureAtlas=512&textureSizeLimit=512&morphTargets=none`;
};

export const RpmAvatarCreator = ({ 
  open, 
  onOpenChange, 
  onAvatarCreated 
}: RpmAvatarCreatorProps) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const handleAvatarExported = async (event: AvatarExportedEvent) => {
    const avatarUrl = event.data.url;
    console.log('[RpmAvatarCreator] Avatar exported:', avatarUrl);
    
    // Optimize the URL for better performance
    const optimizedUrl = optimizeAvatarUrl(avatarUrl);
    setCreatedUrl(optimizedUrl);
    
    // Save to database
    if (user) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ rpm_avatar_url: optimizedUrl })
          .eq('user_id', user.id);
        
        if (error) throw error;
        
        toast.success("Avatar saved successfully!");
        onAvatarCreated?.(optimizedUrl);
        onOpenChange(false);
      } catch (error) {
        console.error('[RpmAvatarCreator] Failed to save avatar:', error);
        toast.error("Failed to save avatar");
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Create Your 3D Avatar
          </DialogTitle>
          <DialogDescription>
            Design your full-body avatar that will appear in gigs and performances
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 h-full min-h-[500px]">
          {saving ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Saving your avatar...</p>
            </div>
          ) : createdUrl ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Check className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium">Avatar Created!</p>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          ) : (
            <AvatarCreator
              subdomain="rockmundo"
              config={avatarConfig}
              style={{ width: '100%', height: '100%', border: 'none' }}
              onAvatarExported={handleAvatarExported}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RpmAvatarCreator;
