import { useState, useEffect } from "react";
import { motion, type Transition } from "framer-motion";

interface RpmAvatarImageProps {
  avatarUrl: string | null;
  role: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
  intensity: number; // 0-1
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Extract RPM avatar ID from various URL formats
function extractRpmAvatarId(url: string): string | null {
  // Match GLB format: models.readyplayer.me/<id>.glb
  const glbMatch = url.match(/models\.readyplayer\.me\/([a-f0-9-]+)\.glb/i);
  if (glbMatch) return glbMatch[1];
  
  // Match PNG format: models.readyplayer.me/<id>.png
  const pngMatch = url.match(/models\.readyplayer\.me\/([a-f0-9-]+)\.png/i);
  if (pngMatch) return pngMatch[1];
  
  // Match direct ID format: models.readyplayer.me/<id>
  const idMatch = url.match(/models\.readyplayer\.me\/([a-f0-9-]+)(?:\?|$)/i);
  if (idMatch) return idMatch[1];
  
  return null;
}

// Generate RPM 2D render URLs (primary and fallback)
function getRpmRenderUrls(avatarId: string): { primary: string; fallback: string } {
  return {
    // Primary: fullbody camera with transparent background - larger size for better quality
    primary: `https://models.readyplayer.me/${avatarId}.png?camera=fullbody&background=transparent&size=1024`,
    // Fallback: simpler URL that may work better
    fallback: `https://models.readyplayer.me/${avatarId}.png?size=1024`
  };
}

// Check if URL is an RPM URL
function isRpmUrl(url: string): boolean {
  return url.includes('models.readyplayer.me') || url.includes('readyplayer.me');
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
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [triedFallback, setTriedFallback] = useState(false);
  
  // Determine if this is an RPM avatar and generate appropriate URLs
  const isRpmAvatar = avatarUrl ? isRpmUrl(avatarUrl) : false;
  const rpmAvatarId = avatarUrl ? extractRpmAvatarId(avatarUrl) : null;
  
  // Set up the image URL on mount or when avatarUrl changes
  useEffect(() => {
    if (!avatarUrl) {
      setCurrentUrl(null);
      return;
    }
    
    setImageError(false);
    setTriedFallback(false);
    
    if (rpmAvatarId) {
      // Use the primary RPM render URL
      const urls = getRpmRenderUrls(rpmAvatarId);
      setCurrentUrl(urls.primary);
    } else {
      // Regular avatar URL - use as-is
      setCurrentUrl(avatarUrl);
    }
  }, [avatarUrl, rpmAvatarId]);
  
  // Handle image load error with fallback for RPM avatars
  const handleImageError = () => {
    if (rpmAvatarId && !triedFallback) {
      // Try the fallback URL
      const urls = getRpmRenderUrls(rpmAvatarId);
      setCurrentUrl(urls.fallback);
      setTriedFallback(true);
    } else {
      // Both URLs failed or not an RPM avatar
      setImageError(true);
    }
  };
  
  // Check if this is a regular avatar (not RPM) - we'll style it differently
  const isRegularAvatar = avatarUrl && !isRpmAvatar;
  
  // Show fallback if no URL or image failed to load
  const showFallback = !currentUrl || imageError;

  const glowColor = roleGlowColors[role] || 'from-white/40 via-white/20 to-transparent';

  return (
    <motion.div
      className="relative"
      animate={animate}
      transition={transition}
    >
      {/* Role-based ground glow for stage presence */}
      <div 
        className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-[120%] h-16 bg-gradient-radial ${glowColor} blur-xl opacity-80 -z-10`}
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
      
      {!showFallback ? (
        <div className={`${sizeClasses[size]} relative`}>
          {/* Show full avatar image for both RPM and regular avatars */}
          <img 
            src={currentUrl}
            alt={`${role} avatar`}
            className={`w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] ${
              isRegularAvatar ? 'object-cover rounded-lg' : 'object-contain'
            }`}
            onError={handleImageError}
          />
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
