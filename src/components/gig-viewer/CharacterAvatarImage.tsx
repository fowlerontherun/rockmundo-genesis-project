import { useState, useEffect } from "react";
import { motion, type Transition } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SpriteLayerCanvas } from "@/components/character-creator/SpriteLayerCanvas";
import type { CharacterSprite, CharacterConfig } from "@/hooks/useCharacterSprites";

interface CharacterAvatarImageProps {
  userId?: string | null;
  avatarUrl?: string | null; // Legacy fallback for regular avatar URLs
  role: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
  intensity: number; // 0-1
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Proportions for full-body display - taller containers
const sizeClasses = {
  sm: 'h-32 w-20',
  md: 'h-48 w-28',
  lg: 'h-64 w-36',
  xl: 'h-80 w-44',
};

// Role-based glow colors for stage presence
const roleGlowColors: Record<string, string> = {
  vocalist: 'from-purple-500/60 via-pink-500/40 to-transparent',
  guitarist: 'from-orange-500/60 via-red-500/40 to-transparent',
  bassist: 'from-blue-500/60 via-indigo-500/40 to-transparent',
  drummer: 'from-emerald-500/60 via-teal-500/40 to-transparent',
  keyboardist: 'from-amber-500/60 via-yellow-500/40 to-transparent',
};

// Animation variants based on role
const getAnimationVariants = (role: string, intensity: number, songSection: string) => {
  const baseSpeed = 0.4 + (intensity * 0.4);
  const bounceAmount = 3 + (intensity * 8);
  
  const isChorus = songSection === 'chorus';
  const isSolo = songSection === 'solo';
  
  switch (role) {
    case 'vocalist':
      return {
        animate: {
          y: [0, -bounceAmount * 1.2, 0],
          rotate: isChorus ? [-2, 2, -2] : [-1, 1, -1],
          scale: isSolo ? [1, 1.02, 1] : 1,
        },
        transition: {
          duration: baseSpeed,
          repeat: Infinity,
          ease: "easeInOut" as const,
        }
      };
    case 'guitarist':
      return {
        animate: {
          y: [0, -bounceAmount * 0.8, 0],
          rotate: isSolo ? [-3, 3, -3] : [-1.5, 1.5, -1.5],
          x: [0, 2, 0, -2, 0],
        },
        transition: {
          duration: baseSpeed * 1.2,
          repeat: Infinity,
          ease: "easeInOut" as const,
        }
      };
    case 'bassist':
      return {
        animate: {
          y: [0, -bounceAmount * 0.6, 0],
          rotate: [-1, 1, -1],
        },
        transition: {
          duration: baseSpeed * 1.5,
          repeat: Infinity,
          ease: "easeInOut" as const,
        }
      };
    case 'drummer':
      return {
        animate: {
          y: [0, -bounceAmount, -bounceAmount * 0.5, -bounceAmount, 0],
          scale: [1, 1.01, 1, 1.01, 1],
        },
        transition: {
          duration: baseSpeed * 0.5,
          repeat: Infinity,
          ease: "linear" as const,
        }
      };
    case 'keyboardist':
      return {
        animate: {
          y: [0, -bounceAmount * 0.4, 0],
          rotate: [-0.5, 0.5, -0.5],
        },
        transition: {
          duration: baseSpeed * 1.8,
          repeat: Infinity,
          ease: "easeInOut" as const,
        }
      };
    default:
      return {
        animate: { y: [0, -bounceAmount * 0.5, 0] },
        transition: { duration: baseSpeed, repeat: Infinity }
      };
  }
};

// Fallback avatar for session musicians (no avatar available)
const FallbackAvatar = ({ role, size }: { role: string; size: string }) => {
  const roleColors: Record<string, string> = {
    vocalist: 'from-purple-600/80 to-purple-900/90',
    guitarist: 'from-orange-600/80 to-red-900/90',
    bassist: 'from-blue-600/80 to-indigo-900/90',
    drummer: 'from-emerald-600/80 to-teal-900/90',
    keyboardist: 'from-amber-600/80 to-orange-900/90',
  };
  
  const roleLabels: Record<string, string> = {
    vocalist: 'Session Vocalist',
    guitarist: 'Session Guitarist',
    bassist: 'Session Bassist',
    drummer: 'Session Drummer',
    keyboardist: 'Session Keys',
  };

  return (
    <div className={`${sizeClasses[size as keyof typeof sizeClasses]} relative`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${roleColors[role] || 'from-gray-600/80 to-gray-900/90'} rounded-lg shadow-lg overflow-hidden`}>
        <svg 
          viewBox="0 0 100 150" 
          className="w-full h-full opacity-60"
          preserveAspectRatio="xMidYMax meet"
        >
          <circle cx="50" cy="25" r="18" fill="black" />
          <ellipse cx="50" cy="75" rx="25" ry="35" fill="black" />
          <rect x="15" y="50" width="70" height="20" rx="10" fill="black" />
        </svg>
      </div>
      <div className="absolute bottom-1 left-0 right-0 text-center">
        <span className="text-[8px] text-white/70 font-medium bg-black/40 px-1 rounded">
          {roleLabels[role] || 'Session'}
        </span>
      </div>
      <div className="absolute inset-0 bg-white/5 rounded-lg" />
    </div>
  );
};

export const CharacterAvatarImage = ({ 
  userId,
  avatarUrl, 
  role, 
  intensity, 
  songSection,
  size = 'lg' 
}: CharacterAvatarImageProps) => {
  const { animate, transition } = getAnimationVariants(role, intensity, songSection);
  
  // Fetch all sprites for rendering
  const { data: sprites } = useQuery({
    queryKey: ['character-sprites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('character_sprite_assets')
        .select('*')
        .order('layer_order');
      if (error) throw error;
      return data as CharacterSprite[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch player's character config if we have a userId
  const { data: characterConfig } = useQuery({
    queryKey: ['player-character-config', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      // Get profile ID first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (!profile) return null;
      
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
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Determine what to render
  const hasCharacterSprites = characterConfig && sprites && 
    (characterConfig.body_sprite_id || characterConfig.rendered_avatar_url);
  
  const glowColor = roleGlowColors[role] || 'from-white/40 via-white/20 to-transparent';

  return (
    <motion.div
      className="relative"
      animate={animate}
      transition={transition}
    >
      {/* Role-based ground glow for stage presence */}
      <div 
        className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-[120%] h-16 blur-xl opacity-80 -z-10`}
        style={{
          background: `radial-gradient(ellipse at center, ${
            role === 'vocalist' ? 'rgba(168,85,247,0.6)' :
            role === 'guitarist' ? 'rgba(249,115,22,0.6)' :
            role === 'bassist' ? 'rgba(59,130,246,0.6)' :
            role === 'drummer' ? 'rgba(16,185,129,0.6)' :
            role === 'keyboardist' ? 'rgba(245,158,11,0.6)' :
            'rgba(255,255,255,0.4)'
          } 0%, transparent 70%)`
        }}
      />
      
      {hasCharacterSprites ? (
        <div className={`${sizeClasses[size]} relative`}>
          {/* Render character using sprite layers */}
          {characterConfig.rendered_avatar_url ? (
            <img
              src={characterConfig.rendered_avatar_url}
              alt={`${role} character`}
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
            />
          ) : (
            <SpriteLayerCanvas
              sprites={sprites}
              config={characterConfig}
              className="drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              size={size}
            />
          )}
          
          {/* Glow effect during high intensity */}
          {intensity > 0.7 && (
            <motion.div
              className="absolute inset-0 bg-primary/20 rounded-lg blur-xl -z-10"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
      ) : avatarUrl ? (
        // Fallback to regular avatar URL (legacy support)
        <div className={`${sizeClasses[size]} relative`}>
          <img 
            src={avatarUrl}
            alt={`${role} avatar`}
            className="w-full h-full object-cover rounded-lg drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
          />
          {intensity > 0.7 && (
            <motion.div
              className="absolute inset-0 bg-primary/20 rounded-lg blur-xl -z-10"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
      ) : (
        <FallbackAvatar role={role} size={size} />
      )}
    </motion.div>
  );
};

// Keep old export name for backward compatibility
export { CharacterAvatarImage as RpmAvatarImage };
