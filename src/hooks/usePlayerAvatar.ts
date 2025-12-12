import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface AvatarConfig {
  id?: string;
  profile_id?: string;
  hair_style_id: string | null;
  hair_color: string;
  skin_tone: string;
  face_type_id: string | null;
  eye_style: string;
  nose_style: string;
  mouth_style: string;
  beard_style: string | null;
  body_type: 'slim' | 'average' | 'muscular' | 'heavy';
  height: number;
  shirt_id: string | null;
  pants_id: string | null;
  jacket_id: string | null;
  shoes_id: string | null;
  accessory_1_id: string | null;
  accessory_2_id: string | null;
}

const defaultConfig: Omit<AvatarConfig, 'id' | 'profile_id'> = {
  hair_style_id: null,
  hair_color: '#2d1a0a',
  skin_tone: '#e0ac69',
  face_type_id: null,
  eye_style: 'default',
  nose_style: 'default',
  mouth_style: 'default',
  beard_style: null,
  body_type: 'average',
  height: 1.0,
  shirt_id: null,
  pants_id: null,
  jacket_id: null,
  shoes_id: null,
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
        .select('id')
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

      // Map DB fields to our interface
      return {
        id: data.id,
        profile_id: data.profile_id,
        skin_tone: data.skin_tone || '#e0ac69',
        body_type: (data.body_type as AvatarConfig['body_type']) || 'average',
        height: data.height || 1.0,
        hair_style_id: null,
        hair_color: '#2d1a0a',
        face_type_id: null,
        eye_style: 'default',
        nose_style: 'default',
        mouth_style: 'default',
        beard_style: null,
        shirt_id: null,
        pants_id: null,
        jacket_id: null,
        shoes_id: null,
        accessory_1_id: null,
        accessory_2_id: null,
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

      const dbConfig = {
        skin_tone: config.skin_tone,
        body_type: config.body_type,
        height: config.height,
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

  return {
    avatarConfig,
    isLoading,
    hairStyles,
    clothingItems,
    faceOptions,
    ownedSkins,
    saveConfig: saveConfigMutation.mutate,
    isSaving: saveConfigMutation.isPending,
    purchaseSkin: purchaseSkinMutation.mutate,
    isPurchasing: purchaseSkinMutation.isPending,
    isItemOwned,
    defaultConfig,
  };
};
