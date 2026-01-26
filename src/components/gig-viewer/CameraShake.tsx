import { useState, useEffect, useCallback, ReactNode, memo } from 'react';
import { motion } from 'framer-motion';

interface CameraShakeProps {
  children: ReactNode;
  intensity: number;
  songSection: string;
  isPlaying: boolean;
}

interface ShakeOffset {
  x: number;
  y: number;
  rotate: number;
}

export const CameraShake = memo(({ children, intensity, songSection, isPlaying }: CameraShakeProps) => {
  const [shakeOffset, setShakeOffset] = useState<ShakeOffset>({ x: 0, y: 0, rotate: 0 });
  
  // Calculate shake amount based on section and intensity
  const getShakeAmounts = useCallback(() => {
    const baseShake = {
      micro: { x: 0.5, y: 0.3, rotate: 0.1 },
      energy: { x: 0, y: 0, rotate: 0 },
      look: { x: 0, y: 0, rotate: 0 },
    };
    
    // Increase micro-shake with intensity
    baseShake.micro.x *= (1 + intensity * 0.5);
    baseShake.micro.y *= (1 + intensity * 0.5);
    baseShake.micro.rotate *= (1 + intensity * 0.3);
    
    // Add energy bursts for high-energy sections
    switch (songSection) {
      case 'chorus':
        baseShake.energy = { x: 2 * intensity, y: 1.5 * intensity, rotate: 0.3 * intensity };
        break;
      case 'solo':
        baseShake.energy = { x: 3 * intensity, y: 2 * intensity, rotate: 0.4 * intensity };
        break;
      case 'outro':
        baseShake.energy = { x: 1.5 * intensity, y: 1 * intensity, rotate: 0.2 * intensity };
        break;
      default:
        baseShake.energy = { x: 0.5 * intensity, y: 0.3 * intensity, rotate: 0.1 * intensity };
    }
    
    return baseShake;
  }, [intensity, songSection]);
  
  // Micro-shake - constant subtle movement (handheld feel)
  useEffect(() => {
    if (!isPlaying) {
      setShakeOffset({ x: 0, y: 0, rotate: 0 });
      return;
    }
    
    const interval = setInterval(() => {
      const amounts = getShakeAmounts();
      
      // Combine micro-shake and energy shake
      const microX = (Math.random() - 0.5) * 2 * amounts.micro.x;
      const microY = (Math.random() - 0.5) * 2 * amounts.micro.y;
      const microRotate = (Math.random() - 0.5) * 2 * amounts.micro.rotate;
      
      const energyX = (Math.random() - 0.5) * 2 * amounts.energy.x;
      const energyY = (Math.random() - 0.5) * 2 * amounts.energy.y;
      const energyRotate = (Math.random() - 0.5) * 2 * amounts.energy.rotate;
      
      setShakeOffset({
        x: microX + energyX,
        y: microY + energyY,
        rotate: microRotate + energyRotate,
      });
    }, 50); // 20fps shake updates
    
    return () => clearInterval(interval);
  }, [isPlaying, getShakeAmounts]);
  
  // Occasional larger "look around" movements
  useEffect(() => {
    if (!isPlaying) return;
    
    const lookInterval = setInterval(() => {
      // 15% chance of a look movement every 3 seconds
      if (Math.random() > 0.85) {
        setShakeOffset(prev => ({
          x: prev.x + (Math.random() - 0.5) * 8 * intensity,
          y: prev.y + (Math.random() - 0.5) * 4 * intensity,
          rotate: prev.rotate + (Math.random() - 0.5) * 0.5 * intensity,
        }));
      }
    }, 3000);
    
    return () => clearInterval(lookInterval);
  }, [isPlaying, intensity]);
  
  return (
    <motion.div
      className="w-full h-full"
      animate={{
        x: shakeOffset.x,
        y: shakeOffset.y,
        rotate: shakeOffset.rotate,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        mass: 0.5,
      }}
      style={{
        transformOrigin: 'center center',
      }}
    >
      {children}
    </motion.div>
  );
});

CameraShake.displayName = 'CameraShake';
