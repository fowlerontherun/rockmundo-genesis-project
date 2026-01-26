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
  const isPlaying = intensity > 0.3;
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - view from behind the kit */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #06060c 0%, #10101a 40%, #1a1a28 100%)',
        }}
      />
      
      {/* Overexposed stage lights - high contrast MTV2 style */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-48"
        animate={{
          opacity: [0.6, 0.9, 0.6],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 1, repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,200,100,0.4) 30%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <motion.div
        className="absolute top-4 left-1/4 w-32 h-32"
        animate={{
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
        style={{
          background: 'radial-gradient(circle, rgba(255,50,50,0.6) 0%, transparent 60%)',
          filter: 'blur(12px)',
        }}
      />
      <motion.div
        className="absolute top-4 right-1/4 w-32 h-32"
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
        style={{
          background: 'radial-gradient(circle, rgba(50,50,255,0.6) 0%, transparent 60%)',
          filter: 'blur(12px)',
        }}
      />
      
      {/* Band members in front (blurred silhouettes) */}
      <motion.div
        className="absolute top-1/4 left-0 right-0 flex justify-around"
        animate={{ opacity: isLookingAtCrowd ? 0.25 : 0.5 }}
      >
        {/* Vocalist silhouette */}
        <motion.div 
          className="w-18 h-36 bg-black/55 rounded-t-full blur-sm" 
          style={{ transform: 'translateY(24px)' }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        {/* Guitarist silhouette */}
        <motion.div 
          className="w-16 h-32 bg-black/45 rounded-t-full blur-sm"
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
        {/* Bassist silhouette */}
        <motion.div 
          className="w-16 h-32 bg-black/45 rounded-t-full blur-sm"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 0.7, repeat: Infinity }}
        />
      </motion.div>
      
      {/* Crowd visible through the kit */}
      {isLookingAtCrowd && (
        <motion.div
          className="absolute top-8 left-8 right-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
        >
          <div className="flex justify-around">
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-black/60 rounded-full"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 0.25, repeat: Infinity, delay: i * 0.03 }}
                style={{ width: 8 + Math.random() * 5, height: 8 + Math.random() * 5 }}
              />
            ))}
          </div>
          {/* Arms in the air */}
          <div className="flex justify-around mt-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={`arm-${i}`}
                className="w-1.5 h-10 bg-black/50 rounded-full"
                animate={{ 
                  y: [0, -6, 0],
                  rotate: [-8, 8, -8],
                }}
                transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.05 }}
                style={{ transformOrigin: 'bottom center' }}
              />
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Cymbals frame - surrounding the view */}
      <div className="absolute inset-0">
        {/* Hi-hat (left side) - PRIMARY FOCUS */}
        <motion.div
          className="absolute left-6 top-1/4 w-28 h-7"
          animate={{
            y: isFill || isPlaying ? [0, 3, 0] : 0,
            rotate: [-6, -6, -6],
          }}
          transition={{ duration: 0.12, repeat: (isFill || isPlaying) ? Infinity : 0 }}
          style={{
            background: 'linear-gradient(to bottom, #d4af37 0%, #8b7019 50%, #d4af37 100%)',
            borderRadius: '50%',
            boxShadow: '0 3px 12px rgba(212,175,55,0.4)',
          }}
        />
        {/* Hi-hat bottom */}
        <div
          className="absolute left-6 top-[27%] w-28 h-7"
          style={{
            background: 'linear-gradient(to bottom, #a08015 0%, #6b5010 100%)',
            borderRadius: '50%',
          }}
        />
        
        {/* Crash cymbal (right top) */}
        <motion.div
          className="absolute right-10 top-14 w-32 h-8"
          animate={{
            rotate: isFill ? [-12, 12, -12] : [-8, -8, -8],
            scale: isFill ? [1, 1.03, 1] : 1,
          }}
          transition={{ duration: 0.18, repeat: isFill ? Infinity : 0 }}
          style={{
            background: 'linear-gradient(to bottom, #e6c33d 0%, #a08015 50%, #e6c33d 100%)',
            borderRadius: '50%',
            boxShadow: '0 5px 18px rgba(230,195,61,0.5)',
          }}
        />
        
        {/* Ride cymbal (far right) */}
        <div
          className="absolute right-2 top-1/3 w-36 h-9"
          style={{
            background: 'linear-gradient(to bottom, #c9a227 0%, #8b6914 50%, #c9a227 100%)',
            borderRadius: '50%',
            transform: 'rotate(18deg)',
          }}
        />
      </div>
      
      {/* Snare drum - CENTER FOCUS */}
      <motion.div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 w-36 h-24"
        style={{ perspective: '200px' }}
      >
        <motion.div
          className="w-full h-full rounded-full"
          animate={{
            boxShadow: isPlaying 
              ? ['0 0 25px rgba(255,255,255,0.25)', '0 0 40px rgba(255,255,255,0.5)', '0 0 25px rgba(255,255,255,0.25)']
              : '0 0 15px rgba(255,255,255,0.15)',
          }}
          transition={{ duration: 0.08, repeat: isPlaying ? Infinity : 0 }}
          style={{
            background: 'radial-gradient(ellipse at center, #f8f8f8 0%, #e8e8e8 60%, #c8c8c8 100%)',
            transform: 'perspective(200px) rotateX(55deg)',
            border: '3px solid #aaa',
          }}
        />
        {/* Snare wires visible */}
        <div 
          className="absolute bottom-2 left-1/4 right-1/4 h-1"
          style={{
            background: 'repeating-linear-gradient(90deg, #888 0px, #888 1px, transparent 1px, transparent 3px)',
          }}
        />
      </motion.div>
      
      {/* Toms */}
      <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-12">
        {/* Tom 1 (left) */}
        <div
          className="w-28 h-18 rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, #f4f4f4 0%, #d8d8d8 70%, #b0b0b0 100%)',
            transform: 'perspective(200px) rotateX(48deg) translateY(-24px)',
            border: '2px solid #999',
          }}
        />
        
        {/* Tom 2 (right) */}
        <div
          className="w-28 h-18 rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, #f4f4f4 0%, #d8d8d8 70%, #b0b0b0 100%)',
            transform: 'perspective(200px) rotateX(48deg) translateY(-24px)',
            border: '2px solid #999',
          }}
        />
      </div>
      
      {/* Drumsticks with hands - VISIBLE WRISTBANDS AND GLOVES */}
      {/* Left stick */}
      <motion.div
        className="absolute bottom-1/3 left-1/4"
        animate={{
          rotate: isFill ? [25, -15, 25, 35, 25] : [22, 18, 22],
          y: isFill ? [0, -18, 0, -24, 0] : [0, -6, 0],
        }}
        transition={{
          duration: isFill ? 0.12 : 0.22,
          repeat: Infinity,
        }}
        style={{ transformOrigin: 'left center' }}
      >
        {/* Gloved hand */}
        <div
          className="absolute -left-12 -top-4 w-14 h-10"
          style={{
            background: 'linear-gradient(to bottom, #1a1a1a 0%, #2a2a2a 100%)',
            borderRadius: '40% 40% 30% 30%',
            border: '1px solid #333',
          }}
        />
        {/* Wristband - studded leather */}
        <div
          className="absolute -left-16 -top-1 w-8 h-5 rounded"
          style={{
            background: 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
            border: '1px solid #444',
          }}
        >
          <div className="flex justify-around items-center h-full">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            ))}
          </div>
        </div>
        {/* Stick */}
        <div
          className="w-44 h-3.5 rounded-full"
          style={{
            background: 'linear-gradient(to right, #8b7355 0%, #a08060 50%, #8b7355 100%)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}
        />
        {/* Stick tip */}
        <div
          className="absolute right-0 top-0 w-4 h-3.5 rounded-full"
          style={{
            background: 'linear-gradient(to right, #a08060 0%, #c0a080 100%)',
          }}
        />
      </motion.div>
      
      {/* Right stick */}
      <motion.div
        className="absolute bottom-1/3 right-1/4"
        animate={{
          rotate: isFill ? [-25, 15, -25, -35, -25] : [-22, -18, -22],
          y: isFill ? [0, -24, 0, -18, 0] : [0, -6, 0],
        }}
        transition={{
          duration: isFill ? 0.12 : 0.22,
          repeat: Infinity,
          delay: 0.04,
        }}
        style={{ transformOrigin: 'right center' }}
      >
        {/* Gloved hand */}
        <div
          className="absolute -right-12 -top-4 w-14 h-10"
          style={{
            background: 'linear-gradient(to bottom, #1a1a1a 0%, #2a2a2a 100%)',
            borderRadius: '40% 40% 30% 30%',
            border: '1px solid #333',
          }}
        />
        {/* Wristband */}
        <div
          className="absolute -right-16 -top-1 w-8 h-5 rounded"
          style={{
            background: 'linear-gradient(to bottom, #8b0000 0%, #5a0000 100%)',
            border: '1px solid #aa0000',
          }}
        />
        {/* Stick */}
        <div
          className="w-44 h-3.5 rounded-full"
          style={{
            background: 'linear-gradient(to left, #8b7355 0%, #a08060 50%, #8b7355 100%)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}
        />
        {/* Stick tip */}
        <div
          className="absolute left-0 top-0 w-4 h-3.5 rounded-full"
          style={{
            background: 'linear-gradient(to left, #a08060 0%, #c0a080 100%)',
          }}
        />
      </motion.div>
      
      {/* Hit flash effects - overexposed */}
      {intensity > 0.5 && (
        <>
          <motion.div
            className="absolute bottom-28 left-1/2 w-20 h-20 -translate-x-1/2"
            animate={{ opacity: [0, 0.7, 0], scale: [0.7, 1.3, 0.7] }}
            transition={{ duration: 0.08, repeat: Infinity, repeatDelay: 0.15 }}
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
            }}
          />
        </>
      )}
      
      {/* Hi-hat pedal (bottom left) */}
      <motion.div
        className="absolute bottom-3 left-16 w-10 h-18"
        animate={{ y: isPlaying ? [0, 4, 0] : 0 }}
        transition={{ duration: 0.25, repeat: isPlaying ? Infinity : 0 }}
        style={{
          background: 'linear-gradient(to bottom, #3a3a3a 0%, #1a1a1a 100%)',
          borderRadius: '4px',
        }}
      />
      
      {/* Kick drum pedal (bottom center) */}
      <motion.div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-20"
        animate={{ 
          rotateX: isPlaying ? [0, -15, 0] : 0,
        }}
        transition={{ duration: 0.2, repeat: isPlaying ? Infinity : 0 }}
        style={{
          background: 'linear-gradient(to bottom, #444 0%, #222 100%)',
          borderRadius: '4px',
          transformOrigin: 'bottom center',
        }}
      />
    </div>
  );
});

DrummerPOV.displayName = 'DrummerPOV';
