import { useState } from "react";
import { motion, type Transition } from "framer-motion";

interface RpmAvatarImageProps {
  avatarUrl: string | null;
  role: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
  intensity: number; // 0-1
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Check if URL is an RPM GLB URL and convert to 2D render URL
function getAvatarImageUrl(url: string): string {
  // Check if it's a ReadyPlayerMe GLB URL
  const rpmMatch = url.match(/models\.readyplayer\.me\/([a-f0-9]+)\.glb/i);
  if (rpmMatch) {
    const avatarId = rpmMatch[1];
    // Use RPM's 2D render API - use transparent background for layering
    return `https://models.readyplayer.me/${avatarId}.png?scene=fullbody-portrait-v1&background=transparent`;
  }
  
  // Check if it's already an RPM PNG URL
  if (url.includes('models.readyplayer.me') && url.includes('.png')) {
    return url;
  }
  
  // For regular avatar URLs (like Supabase storage), use as-is
  // These are usually profile photos/headshots
  return url;
}

const sizeClasses = {
  sm: 'h-24 w-16',
  md: 'h-32 w-20',
  lg: 'h-40 w-24',
  xl: 'h-48 w-28',
};

// Animation variants based on role
const getAnimationVariants = (role: string, intensity: number, songSection: string) => {
  const baseSpeed = 0.4 + (intensity * 0.4); // 0.4-0.8s duration based on intensity
  const bounceAmount = 3 + (intensity * 8); // 3-11px bounce
  
  const isChorus = songSection === 'chorus';
  const isSolo = songSection === 'solo';
  const isIntro = songSection === 'intro';
  
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

// Fallback avatar for session musicians (no RPM avatar available)
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

  // Human silhouette SVG for session musicians
  return (
    <div className={`${sizeClasses[size as keyof typeof sizeClasses]} relative`}>
      {/* Silhouette background */}
      <div className={`absolute inset-0 bg-gradient-to-b ${roleColors[role] || 'from-gray-600/80 to-gray-900/90'} rounded-lg shadow-lg overflow-hidden`}>
        {/* Human silhouette shape */}
        <svg 
          viewBox="0 0 100 150" 
          className="w-full h-full opacity-60"
          preserveAspectRatio="xMidYMax meet"
        >
          {/* Head */}
          <circle cx="50" cy="25" r="18" fill="black" />
          {/* Body */}
          <ellipse cx="50" cy="75" rx="25" ry="35" fill="black" />
          {/* Shoulders */}
          <rect x="15" y="50" width="70" height="20" rx="10" fill="black" />
        </svg>
      </div>
      {/* Role label */}
      <div className="absolute bottom-1 left-0 right-0 text-center">
        <span className="text-[8px] text-white/70 font-medium bg-black/40 px-1 rounded">
          {roleLabels[role] || 'Session'}
        </span>
      </div>
      {/* Glow effect */}
      <div className="absolute inset-0 bg-white/5 rounded-lg" />
    </div>
  );
};

export const RpmAvatarImage = ({ 
  avatarUrl, 
  role, 
  intensity, 
  songSection,
  size = 'lg' 
}: RpmAvatarImageProps) => {
  const { animate, transition } = getAnimationVariants(role, intensity, songSection);
  const [imageError, setImageError] = useState(false);
  
  // Generate image URL from avatar (works with RPM, Supabase storage, or any URL)
  const imageUrl = avatarUrl ? getAvatarImageUrl(avatarUrl) : null;
  
  // Check if this is a regular avatar (not RPM) - we'll style it differently
  const isRegularAvatar = avatarUrl && !avatarUrl.includes('readyplayer.me');
  
  // Show fallback if no URL or image failed to load
  const showFallback = !imageUrl || imageError;

  return (
    <motion.div
      className="relative"
      animate={animate}
      transition={transition}
    >
      {!showFallback ? (
        <div className={`${sizeClasses[size]} relative`}>
          {isRegularAvatar ? (
            // Regular avatar (headshot) - show in a circular frame on top of silhouette
            <div className="relative w-full h-full">
              {/* Silhouette body behind */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-gradient-to-t from-zinc-800 to-zinc-700 rounded-t-2xl opacity-80" />
              {/* Avatar headshot */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[70%] aspect-square rounded-full overflow-hidden border-2 border-white/20 shadow-lg">
                <img 
                  src={imageUrl}
                  alt={`${role} avatar`}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            </div>
          ) : (
            // RPM full-body avatar
            <img 
              src={imageUrl}
              alt={`${role} avatar`}
              className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              onError={() => setImageError(true)}
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
      ) : (
        <FallbackAvatar role={role} size={size} />
      )}
    </motion.div>
  );
};
