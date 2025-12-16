import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface AvatarConfig {
  id?: string;
  profile_id?: string;
  // Body
  skin_tone: string;
  body_type: 'slim' | 'average' | 'muscular' | 'heavy';
  height: number;
  gender: string;
  // Hair
  hair_style_key: string;
  hair_color: string;
  // Face
  eye_style: string;
  nose_style: string;
  mouth_style: string;
  beard_style: string | null;
  tattoo_style: string | null;
  scar_style: string | null;
  // Clothing
  shirt_id: string | null;
  shirt_color: string;
  pants_id: string | null;
  pants_color: string;
  jacket_id: string | null;
  jacket_color: string | null;
  shoes_id: string | null;
  shoes_color: string;
  // Accessories
  accessory_1_id: string | null;
  accessory_2_id: string | null;
}

export const defaultConfig: Omit<AvatarConfig, 'id' | 'profile_id'> = {
  skin_tone: '#e0ac69',
  body_type: 'average',
  height: 1.0,
  gender: 'male',
  hair_style_key: 'messy',
  hair_color: '#2d1a0a',
  eye_style: 'default',
  nose_style: 'default',
  mouth_style: 'default',
  beard_style: null,
  tattoo_style: null,
  scar_style: null,
  shirt_id: null,
  shirt_color: '#2d0a0a',
  pants_id: null,
  pants_color: '#1a1a1a',
  jacket_id: null,
  jacket_color: null,
  shoes_id: null,
  shoes_color: '#1a1a1a',
  accessory_1_id: null,
  accessory_2_id: null,
};

export const usePlayerAvatar = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, cash')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: avatarConfig, isLoading } = useQuery({
    queryKey: ['player-avatar-config', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from('player_avatar_config')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { ...defaultConfig, profile_id: profile.id } as AvatarConfig;
      }

      // Map all DB fields to our interface
      return {
        id: data.id,
        profile_id: data.profile_id,
        skin_tone: data.skin_tone || defaultConfig.skin_tone,
        body_type: (data.body_type as AvatarConfig['body_type']) || defaultConfig.body_type,
        height: data.height || defaultConfig.height,
        gender: data.gender || defaultConfig.gender,
        hair_style_key: data.hair_style_key || defaultConfig.hair_style_key,
        hair_color: data.hair_color || defaultConfig.hair_color,
        eye_style: data.eye_style || defaultConfig.eye_style,
        nose_style: data.nose_style || defaultConfig.nose_style,
        mouth_style: data.mouth_style || defaultConfig.mouth_style,
        beard_style: data.beard_style || null,
        tattoo_style: data.tattoo_style || null,
        scar_style: data.scar_style || null,
        shirt_id: data.shirt_id || null,
        shirt_color: data.shirt_color || defaultConfig.shirt_color,
        pants_id: data.pants_id || null,
        pants_color: data.pants_color || defaultConfig.pants_color,
        jacket_id: data.jacket_id || null,
        jacket_color: data.jacket_color || null,
        shoes_id: data.shoes_id || null,
        shoes_color: data.shoes_color || defaultConfig.shoes_color,
        accessory_1_id: data.accessory_1_id || null,
        accessory_2_id: data.accessory_2_id || null,
      } as AvatarConfig;
    },
    enabled: !!profile?.id,
  });

  const { data: hairStyles } = useQuery({
    queryKey: ['avatar-hair-styles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_hair_styles')
        .select('*')
        .order('price', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: clothingItems } = useQuery({
    queryKey: ['avatar-clothing-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_clothing_items')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: faceOptions } = useQuery({
    queryKey: ['avatar-face-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_face_options')
        .select('*')
        .order('feature_type', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: ownedSkins } = useQuery({
    queryKey: ['player-owned-skins', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('player_owned_skins')
        .select('*')
        .eq('profile_id', profile.id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (config: Partial<AvatarConfig>) => {
      if (!profile?.id) throw new Error('Not authenticated');

      // Save ALL config fields to database
      const dbConfig = {
        skin_tone: config.skin_tone,
        body_type: config.body_type,
        height: config.height,
        gender: config.gender,
        hair_style_key: config.hair_style_key,
        hair_color: config.hair_color,
        eye_style: config.eye_style,
        nose_style: config.nose_style,
        mouth_style: config.mouth_style,
        beard_style: config.beard_style,
        tattoo_style: config.tattoo_style,
        scar_style: config.scar_style,
        shirt_id: config.shirt_id,
        shirt_color: config.shirt_color,
        pants_id: config.pants_id,
        pants_color: config.pants_color,
        jacket_id: config.jacket_id,
        jacket_color: config.jacket_color,
        shoes_id: config.shoes_id,
        shoes_color: config.shoes_color,
        accessory_1_id: config.accessory_1_id,
        accessory_2_id: config.accessory_2_id,
      };

      const { data: existing } = await supabase
        .from('player_avatar_config')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('player_avatar_config')
          .update(dbConfig)
          .eq('profile_id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('player_avatar_config')
          .insert({ ...dbConfig, profile_id: profile.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-avatar-config'] });
      toast.success('Avatar saved!');
    },
    onError: (error) => {
      toast.error('Failed to save avatar: ' + error.message);
    },
  });

  const purchaseSkinMutation = useMutation({
    mutationFn: async ({ itemId, itemType, price }: { itemId: string; itemType: string; price: number }) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('cash')
        .eq('id', profile.id)
        .single();

      if (profileError) throw profileError;
      if ((profileData?.cash || 0) < price) {
        throw new Error('Not enough cash');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cash: (profileData?.cash || 0) - price })
        .eq('id', profile.id);
      if (updateError) throw updateError;

      const { error: insertError } = await supabase
        .from('player_owned_skins')
        .insert({
          profile_id: profile.id,
          item_type: itemType,
          item_id: itemId,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-owned-skins'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Item purchased!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isItemOwned = (itemId: string): boolean => {
    return ownedSkins?.some(skin => skin.item_id === itemId) || false;
  };

  // Helper to get clothing item color
  const getClothingColor = (itemId: string | null, fallback: string): string => {
    if (!itemId || !clothingItems) return fallback;
    const item = clothingItems.find(c => c.id === itemId);
    if (!item?.color_variants) return fallback;
    const colors = item.color_variants as string[];
    return colors[0] || fallback;
  };

  return {
    avatarConfig,
    isLoading,
    hairStyles,
    clothingItems,
    faceOptions,
    ownedSkins,
    profile,
    saveConfig: saveConfigMutation.mutate,
    isSaving: saveConfigMutation.isPending,
    purchaseSkin: purchaseSkinMutation.mutate,
    isPurchasing: purchaseSkinMutation.isPending,
    isItemOwned,
    getClothingColor,
    defaultConfig,
  };
};
