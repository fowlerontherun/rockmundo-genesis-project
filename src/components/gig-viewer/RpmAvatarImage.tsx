import { motion, type Transition } from "framer-motion";

interface RpmAvatarImageProps {
  avatarUrl: string | null;
  role: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
  intensity: number; // 0-1
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Convert RPM .glb URL to 2D render URL
function getRpm2DImageUrl(glbUrl: string): string {
  // Extract avatar ID from URL
  // URL format: https://models.readyplayer.me/{avatarId}.glb
  const match = glbUrl.match(/models\.readyplayer\.me\/([^.]+)\.glb/);
  if (!match) return glbUrl;
  
  const avatarId = match[1];
  // Use RPM's 2D render API with fullbody pose
  return `https://models.readyplayer.me/${avatarId}.png?camera=fullbody&quality=high&pose=power-stance`;
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
          ease: "easeInOut",
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
          ease: "easeInOut",
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
          ease: "easeInOut",
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
          ease: "linear",
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
          ease: "easeInOut",
        }
      };
    default:
      return {
        animate: { y: [0, -bounceAmount * 0.5, 0] },
        transition: { duration: baseSpeed, repeat: Infinity }
      };
  }
};

// Fallback avatar for when no RPM avatar is available
const FallbackAvatar = ({ role, size }: { role: string; size: string }) => {
  const roleColors: Record<string, string> = {
    vocalist: 'from-purple-500 to-pink-500',
    guitarist: 'from-orange-500 to-red-500',
    bassist: 'from-blue-500 to-indigo-500',
    drummer: 'from-green-500 to-teal-500',
    keyboardist: 'from-yellow-500 to-orange-500',
  };
  
  const roleEmojis: Record<string, string> = {
    vocalist: '🎤',
    guitarist: '🎸',
    bassist: '🎸',
    drummer: '🥁',
    keyboardist: '🎹',
  };

  return (
    <div className={`${sizeClasses[size as keyof typeof sizeClasses]} bg-gradient-to-b ${roleColors[role] || 'from-gray-500 to-gray-700'} rounded-lg flex items-center justify-center text-3xl shadow-lg`}>
      {roleEmojis[role] || '🎵'}
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
  
  // Generate 2D image URL from RPM avatar
  const imageUrl = avatarUrl ? getRpm2DImageUrl(avatarUrl) : null;

  return (
    <motion.div
      className="relative"
      animate={animate}
      transition={transition}
    >
      {imageUrl ? (
        <div className={`${sizeClasses[size]} relative`}>
          <img 
            src={imageUrl}
            alt={`${role} avatar`}
            className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
            onError={(e) => {
              // If image fails to load, hide it (fallback will show)
              (e.target as HTMLImageElement).style.display = 'none';
            }}
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
