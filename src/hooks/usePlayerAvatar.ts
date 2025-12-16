import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface AvatarConfig {
  id?: string;
  profile_id?: string;
  
  // Body - Basic
  skin_tone: string;
  body_type: 'slim' | 'average' | 'muscular' | 'heavy';
  height: number;
  gender: string;
  
  // Body - Advanced
  weight: number;
  muscle_definition: number;
  shoulder_width: number;
  hip_width: number;
  torso_length: number;
  arm_length: number;
  leg_length: number;
  age_appearance: 'young' | 'adult' | 'mature';
  
  // Hair
  hair_style_key: string;
  hair_color: string;
  
  // Face - Structure
  face_width: number;
  face_length: number;
  jaw_shape: 'round' | 'square' | 'pointed' | 'oval';
  cheekbone: number;
  chin_prominence: number;
  
  // Face - Eyes
  eye_style: string;
  eye_color: string;
  eye_size: number;
  eye_spacing: number;
  eye_tilt: number;
  
  // Face - Eyebrows
  eyebrow_style: 'thin' | 'normal' | 'thick' | 'arched' | 'straight';
  eyebrow_color: string;
  eyebrow_thickness: number;
  
  // Face - Nose
  nose_style: string;
  nose_width: number;
  nose_length: number;
  nose_bridge: number;
  
  // Face - Mouth
  mouth_style: string;
  lip_fullness: number;
  lip_width: number;
  lip_color: string;
  
  // Face - Ears
  ear_size: number;
  ear_angle: number;
  
  // Face - Extras
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
  // Body - Basic
  skin_tone: '#e0ac69',
  body_type: 'average',
  height: 1.0,
  gender: 'male',
  
  // Body - Advanced
  weight: 1.0,
  muscle_definition: 0.5,
  shoulder_width: 1.0,
  hip_width: 1.0,
  torso_length: 1.0,
  arm_length: 1.0,
  leg_length: 1.0,
  age_appearance: 'adult',
  
  // Hair
  hair_style_key: 'messy',
  hair_color: '#2d1a0a',
  
  // Face - Structure
  face_width: 1.0,
  face_length: 1.0,
  jaw_shape: 'round',
  cheekbone: 0.5,
  chin_prominence: 0.5,
  
  // Face - Eyes
  eye_style: 'default',
  eye_color: '#2d1a0a',
  eye_size: 1.0,
  eye_spacing: 1.0,
  eye_tilt: 0.0,
  
  // Face - Eyebrows
  eyebrow_style: 'normal',
  eyebrow_color: '#1a1a1a',
  eyebrow_thickness: 1.0,
  
  // Face - Nose
  nose_style: 'default',
  nose_width: 1.0,
  nose_length: 1.0,
  nose_bridge: 0.5,
  
  // Face - Mouth
  mouth_style: 'default',
  lip_fullness: 1.0,
  lip_width: 1.0,
  lip_color: '#c4777f',
  
  // Face - Ears
  ear_size: 1.0,
  ear_angle: 0.0,
  
  // Face - Extras
  beard_style: null,
  tattoo_style: null,
  scar_style: null,
  
  // Clothing
  shirt_id: null,
  shirt_color: '#2d0a0a',
  pants_id: null,
  pants_color: '#1a1a1a',
  jacket_id: null,
  jacket_color: null,
  shoes_id: null,
  shoes_color: '#1a1a1a',
  
  // Accessories
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

      // Map all DB fields to our interface with defaults
      return {
        id: data.id,
        profile_id: data.profile_id,
        // Body - Basic
        skin_tone: data.skin_tone || defaultConfig.skin_tone,
        body_type: (data.body_type as AvatarConfig['body_type']) || defaultConfig.body_type,
        height: data.height || defaultConfig.height,
        gender: data.gender || defaultConfig.gender,
        // Body - Advanced
        weight: data.weight ?? defaultConfig.weight,
        muscle_definition: data.muscle_definition ?? defaultConfig.muscle_definition,
        shoulder_width: data.shoulder_width ?? defaultConfig.shoulder_width,
        hip_width: data.hip_width ?? defaultConfig.hip_width,
        torso_length: data.torso_length ?? defaultConfig.torso_length,
        arm_length: data.arm_length ?? defaultConfig.arm_length,
        leg_length: data.leg_length ?? defaultConfig.leg_length,
        age_appearance: (data.age_appearance as AvatarConfig['age_appearance']) || defaultConfig.age_appearance,
        // Hair
        hair_style_key: data.hair_style_key || defaultConfig.hair_style_key,
        hair_color: data.hair_color || defaultConfig.hair_color,
        // Face - Structure
        face_width: data.face_width ?? defaultConfig.face_width,
        face_length: data.face_length ?? defaultConfig.face_length,
        jaw_shape: (data.jaw_shape as AvatarConfig['jaw_shape']) || defaultConfig.jaw_shape,
        cheekbone: data.cheekbone ?? defaultConfig.cheekbone,
        chin_prominence: data.chin_prominence ?? defaultConfig.chin_prominence,
        // Face - Eyes
        eye_style: data.eye_style || defaultConfig.eye_style,
        eye_color: data.eye_color || defaultConfig.eye_color,
        eye_size: data.eye_size ?? defaultConfig.eye_size,
        eye_spacing: data.eye_spacing ?? defaultConfig.eye_spacing,
        eye_tilt: data.eye_tilt ?? defaultConfig.eye_tilt,
        // Face - Eyebrows
        eyebrow_style: (data.eyebrow_style as AvatarConfig['eyebrow_style']) || defaultConfig.eyebrow_style,
        eyebrow_color: data.eyebrow_color || defaultConfig.eyebrow_color,
        eyebrow_thickness: data.eyebrow_thickness ?? defaultConfig.eyebrow_thickness,
        // Face - Nose
        nose_style: data.nose_style || defaultConfig.nose_style,
        nose_width: data.nose_width ?? defaultConfig.nose_width,
        nose_length: data.nose_length ?? defaultConfig.nose_length,
        nose_bridge: data.nose_bridge ?? defaultConfig.nose_bridge,
        // Face - Mouth
        mouth_style: data.mouth_style || defaultConfig.mouth_style,
        lip_fullness: data.lip_fullness ?? defaultConfig.lip_fullness,
        lip_width: data.lip_width ?? defaultConfig.lip_width,
        lip_color: data.lip_color || defaultConfig.lip_color,
        // Face - Ears
        ear_size: data.ear_size ?? defaultConfig.ear_size,
        ear_angle: data.ear_angle ?? defaultConfig.ear_angle,
        // Face - Extras
        beard_style: data.beard_style || null,
        tattoo_style: data.tattoo_style || null,
        scar_style: data.scar_style || null,
        // Clothing
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
        // Body - Basic
        skin_tone: config.skin_tone,
        body_type: config.body_type,
        height: config.height,
        gender: config.gender,
        // Body - Advanced
        weight: config.weight,
        muscle_definition: config.muscle_definition,
        shoulder_width: config.shoulder_width,
        hip_width: config.hip_width,
        torso_length: config.torso_length,
        arm_length: config.arm_length,
        leg_length: config.leg_length,
        age_appearance: config.age_appearance,
        // Hair
        hair_style_key: config.hair_style_key,
        hair_color: config.hair_color,
        // Face - Structure
        face_width: config.face_width,
        face_length: config.face_length,
        jaw_shape: config.jaw_shape,
        cheekbone: config.cheekbone,
        chin_prominence: config.chin_prominence,
        // Face - Eyes
        eye_style: config.eye_style,
        eye_color: config.eye_color,
        eye_size: config.eye_size,
        eye_spacing: config.eye_spacing,
        eye_tilt: config.eye_tilt,
        // Face - Eyebrows
        eyebrow_style: config.eyebrow_style,
        eyebrow_color: config.eyebrow_color,
        eyebrow_thickness: config.eyebrow_thickness,
        // Face - Nose
        nose_style: config.nose_style,
        nose_width: config.nose_width,
        nose_length: config.nose_length,
        nose_bridge: config.nose_bridge,
        // Face - Mouth
        mouth_style: config.mouth_style,
        lip_fullness: config.lip_fullness,
        lip_width: config.lip_width,
        lip_color: config.lip_color,
        // Face - Ears
        ear_size: config.ear_size,
        ear_angle: config.ear_angle,
        // Face - Extras
        beard_style: config.beard_style,
        tattoo_style: config.tattoo_style,
        scar_style: config.scar_style,
        // Clothing
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