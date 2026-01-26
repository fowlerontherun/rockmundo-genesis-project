import { memo } from 'react';
import { motion } from 'framer-motion';

interface DrummerPOVProps {
  intensity: number;
  songSection: string;
  clipType: string;
}

export const DrummerPOV = memo(({ intensity, songSection, clipType }: DrummerPOVProps) => {
  const isFill = songSection === 'solo' || clipType === 'solo_focus';
  const isLookingAtCrowd = clipType === 'crowd_look';
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - view from behind the kit */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #0a0a15 0%, #151525 40%, #1a1a2e 100%)',
        }}
      />
      
      {/* Band members in front (blurred silhouettes) */}
      <motion.div
        className="absolute top-1/4 left-0 right-0 flex justify-around"
        animate={{ opacity: isLookingAtCrowd ? 0.3 : 0.5 }}
      >
        {/* Vocalist silhouette */}
        <div className="w-16 h-32 bg-black/50 rounded-t-full blur-sm" style={{ transform: 'translateY(20px)' }} />
        {/* Guitarist silhouette */}
        <div className="w-14 h-28 bg-black/40 rounded-t-full blur-sm" />
        {/* Bassist silhouette */}
        <div className="w-14 h-28 bg-black/40 rounded-t-full blur-sm" />
      </motion.div>
      
      {/* Crowd visible through the kit */}
      {isLookingAtCrowd && (
        <motion.div
          className="absolute top-10 left-10 right-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
        >
          <div className="flex justify-around">
            {Array.from({ length: 25 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-black/50 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.04 }}
                style={{ width: 8 + Math.random() * 5, height: 8 + Math.random() * 5 }}
              />
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Cymbals frame */}
      <div className="absolute inset-0">
        {/* Hi-hat (left side) */}
        <motion.div
          className="absolute left-8 top-1/4 w-24 h-6"
          animate={{
            y: isFill ? [0, 2, 0] : 0,
            rotate: [-5, -5, -5],
          }}
          transition={{ duration: 0.15, repeat: isFill ? Infinity : 0 }}
          style={{
            background: 'linear-gradient(to bottom, #c9a227 0%, #8b7019 50%, #c9a227 100%)',
            borderRadius: '50%',
            boxShadow: '0 2px 10px rgba(201,162,39,0.3)',
          }}
        />
        
        {/* Crash cymbal (right top) */}
        <motion.div
          className="absolute right-12 top-16 w-28 h-7"
          animate={{
            rotate: isFill ? [-10, 10, -10] : [-8, -8, -8],
            scale: isFill ? [1, 1.02, 1] : 1,
          }}
          transition={{ duration: 0.2, repeat: isFill ? Infinity : 0 }}
          style={{
            background: 'linear-gradient(to bottom, #d4af37 0%, #996515 50%, #d4af37 100%)',
            borderRadius: '50%',
            boxShadow: '0 4px 15px rgba(212,175,55,0.4)',
          }}
        />
        
        {/* Ride cymbal (far right) */}
        <div
          className="absolute right-4 top-1/3 w-32 h-8"
          style={{
            background: 'linear-gradient(to bottom, #b8860b 0%, #8b6914 50%, #b8860b 100%)',
            borderRadius: '50%',
            transform: 'rotate(15deg)',
          }}
        />
      </div>
      
      {/* Drum heads visible below cymbals */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-8">
        {/* Snare (center) */}
        <motion.div
          className="w-28 h-20 rounded-full"
          animate={{
            boxShadow: intensity > 0.5 
              ? ['0 0 20px rgba(255,255,255,0.2)', '0 0 30px rgba(255,255,255,0.4)', '0 0 20px rgba(255,255,255,0.2)']
              : '0 0 10px rgba(255,255,255,0.1)',
          }}
          transition={{ duration: 0.1, repeat: intensity > 0.5 ? Infinity : 0 }}
          style={{
            background: 'radial-gradient(ellipse at center, #f5f5f5 0%, #e0e0e0 60%, #c0c0c0 100%)',
            transform: 'perspective(200px) rotateX(50deg)',
          }}
        />
        
        {/* Tom 1 (left) */}
        <div
          className="w-24 h-16 rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, #f0f0f0 0%, #d0d0d0 70%, #a0a0a0 100%)',
            transform: 'perspective(200px) rotateX(45deg) translateY(-20px)',
          }}
        />
        
        {/* Tom 2 (right) */}
        <div
          className="w-24 h-16 rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, #f0f0f0 0%, #d0d0d0 70%, #a0a0a0 100%)',
            transform: 'perspective(200px) rotateX(45deg) translateY(-20px)',
          }}
        />
      </div>
      
      {/* Drumsticks */}
      <motion.div
        className="absolute bottom-1/3 left-1/3 w-40 h-3 rounded-full"
        animate={{
          rotate: isFill ? [20, -10, 20, 30, 20] : [20, 15, 20],
          y: isFill ? [0, -15, 0, -20, 0] : [0, -5, 0],
        }}
        transition={{
          duration: isFill ? 0.15 : 0.25,
          repeat: Infinity,
        }}
        style={{
          background: 'linear-gradient(to right, #8b7355 0%, #a08060 50%, #8b7355 100%)',
          transformOrigin: 'left center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        }}
      />
      
      <motion.div
        className="absolute bottom-1/3 right-1/3 w-40 h-3 rounded-full"
        animate={{
          rotate: isFill ? [-20, 10, -20, -30, -20] : [-20, -15, -20],
          y: isFill ? [0, -20, 0, -15, 0] : [0, -5, 0],
        }}
        transition={{
          duration: isFill ? 0.15 : 0.25,
          repeat: Infinity,
          delay: 0.05,
        }}
        style={{
          background: 'linear-gradient(to left, #8b7355 0%, #a08060 50%, #8b7355 100%)',
          transformOrigin: 'right center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        }}
      />
      
      {/* Hit flash effects */}
      {intensity > 0.6 && (
        <>
          <motion.div
            className="absolute bottom-1/3 left-1/2 w-16 h-16 -translate-x-1/2"
            animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 0.2 }}
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)',
            }}
          />
        </>
      )}
      
      {/* Hi-hat pedal (bottom left) */}
      <motion.div
        className="absolute bottom-4 left-20 w-8 h-16"
        animate={{ y: [0, 3, 0] }}
        transition={{ duration: 0.3, repeat: Infinity }}
        style={{
          background: 'linear-gradient(to bottom, #333 0%, #1a1a1a 100%)',
          borderRadius: '4px',
        }}
      />
    </div>
  );
});

DrummerPOV.displayName = 'DrummerPOV';
