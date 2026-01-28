import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface CharacterSprite {
  id: string;
  category: string;
  subcategory: string | null;
  name: string;
  asset_url: string;
  layer_order: number;
  anchor_x: number;
  anchor_y: number;
  supports_recolor: boolean;
  color_variants: string[];
  is_premium: boolean;
  price: number;
  gender_filter: string[];
  body_type_filter: string[];
  is_default: boolean;
}

export interface CharacterConfig {
  body_sprite_id: string | null;
  eyes_sprite_id: string | null;
  nose_sprite_id: string | null;
  mouth_sprite_id: string | null;
  hair_sprite_id: string | null;
  jacket_sprite_id: string | null;
  shirt_sprite_id: string | null;
  trousers_sprite_id: string | null;
  shoes_sprite_id: string | null;
  hat_sprite_id: string | null;
  glasses_sprite_id: string | null;
  facial_hair_sprite_id: string | null;
  selected_skin_tone: string;
  rendered_avatar_url: string | null;
}

export type SpriteCategory = 
  | 'body' 
  | 'eyes' 
  | 'nose' 
  | 'mouth' 
  | 'hair' 
  | 'jacket' 
  | 'shirt' 
  | 'trousers' 
  | 'shoes' 
  | 'hat' 
  | 'glasses' 
  | 'facial_hair';

// Skin tone filter presets (CSS filters applied to body sprite)
export const SKIN_TONES = [
  { id: 'very_light', name: 'Very Light', filter: 'brightness(1.15) saturate(0.9)' },
  { id: 'light', name: 'Light', filter: 'brightness(1.05) saturate(0.95)' },
  { id: 'light_medium', name: 'Light Medium', filter: 'brightness(1.0) saturate(1.0)' },
  { id: 'medium', name: 'Medium', filter: 'sepia(0.15) saturate(1.1) brightness(0.95)' },
  { id: 'olive', name: 'Olive', filter: 'sepia(0.2) hue-rotate(-10deg) saturate(1.1) brightness(0.9)' },
  { id: 'tan', name: 'Tan', filter: 'sepia(0.3) saturate(1.2) brightness(0.85)' },
  { id: 'brown', name: 'Brown', filter: 'sepia(0.4) saturate(1.3) brightness(0.75)' },
  { id: 'dark_brown', name: 'Dark Brown', filter: 'sepia(0.5) saturate(1.4) brightness(0.6)' },
  { id: 'deep', name: 'Deep', filter: 'sepia(0.6) saturate(1.5) brightness(0.45)' },
];

export const useCharacterSprites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all available sprites grouped by category (aligned-only)
  const { data: sprites, isLoading: spritesLoading } = useQuery({
    queryKey: ['character-sprites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('character_sprite_assets')
        .select('*')
        .ilike('subcategory', 'aligned%')  // Only aligned template assets
        .order('category')
        .order('name');
      
      if (error) throw error;
      return data as CharacterSprite[];
    },
  });

  // Fetch player's current sprite config
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['character-config', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from('player_avatar_config')
        .select(`
          body_sprite_id,
          eyes_sprite_id,
          nose_sprite_id,
          mouth_sprite_id,
          hair_sprite_id,
          jacket_sprite_id,
          shirt_sprite_id,
          trousers_sprite_id,
          shoes_sprite_id,
          hat_sprite_id,
          glasses_sprite_id,
          facial_hair_sprite_id,
          selected_skin_tone,
          rendered_avatar_url
        `)
        .eq('profile_id', profile.id)
        .maybeSingle();
      
      if (error) throw error;
      
      return data as CharacterConfig | null;
    },
    enabled: !!profile?.id,
  });

  // Get sprites by category
  const getSpritesByCategory = (category: SpriteCategory, gender?: 'male' | 'female') => {
    if (!sprites) return [];
    
    return sprites.filter(s => {
      if (s.category !== category) return false;
      if (gender && !s.gender_filter.includes(gender) && !s.gender_filter.includes('any')) {
        return false;
      }
      return true;
    });
  };

  // Get selected sprite for a category
  const getSelectedSprite = (category: SpriteCategory): CharacterSprite | null => {
    if (!config || !sprites) return null;
    
    const spriteIdKey = `${category}_sprite_id` as keyof CharacterConfig;
    const spriteId = config[spriteIdKey];
    
    if (!spriteId) return null;
    return sprites.find(s => s.id === spriteId) || null;
  };

  // Save character config
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: Partial<CharacterConfig>) => {
      if (!profile?.id) throw new Error('Not authenticated');

      // Check if config exists
      const { data: existing } = await supabase
        .from('player_avatar_config')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('player_avatar_config')
          .update({
            ...newConfig,
            // Invalidate render cache when config changes
            rendered_avatar_url: null,
            render_hash: null,
          })
          .eq('profile_id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('player_avatar_config')
          .insert({
            profile_id: profile.id,
            ...newConfig,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-config'] });
      toast.success('Character saved!');
    },
    onError: (error) => {
      toast.error('Failed to save character: ' + error.message);
    },
  });

  // Select a sprite for a category
  const selectSprite = (category: SpriteCategory, spriteId: string | null) => {
    const updateKey = `${category}_sprite_id`;
    saveConfigMutation.mutate({ [updateKey]: spriteId } as Partial<CharacterConfig>);
  };

  // Set skin tone
  const setSkinTone = (toneId: string) => {
    saveConfigMutation.mutate({ selected_skin_tone: toneId });
  };

  return {
    sprites,
    config,
    isLoading: spritesLoading || configLoading,
    getSpritesByCategory,
    getSelectedSprite,
    selectSprite,
    setSkinTone,
    saveConfig: saveConfigMutation.mutate,
    isSaving: saveConfigMutation.isPending,
    skinTones: SKIN_TONES,
  };
};
