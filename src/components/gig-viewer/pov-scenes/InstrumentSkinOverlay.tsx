import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

// MTV2 / Kerrang late-night aesthetic - Hands + Instrument Skin Overlay (H1)
// Designed for layering on top of base POV clips

interface InstrumentSkinOverlayProps {
  instrumentType: 'guitar' | 'bass';
  skinId: string; // Player-owned skin identifier
  skinColor: string; // Primary color of the instrument skin
  sleeveStyle: 'leather' | 'denim' | 'hoodie' | 'bare' | 'band-tee';
  intensity: number;
  isPlaying: boolean;
}

interface SkinConfig {
  body: string;
  neck: string;
  pickguard: string;
}

// Skin color presets for instruments
const GUITAR_SKINS: Record<string, SkinConfig> = {
  'classic-sunburst': { body: '#8B4513', neck: '#DEB887', pickguard: '#FFFFF0' },
  'midnight-black': { body: '#1a1a1a', neck: '#2d2d2d', pickguard: '#000000' },
  'arctic-white': { body: '#f5f5f5', neck: '#DEB887', pickguard: '#ffffff' },
  'cherry-red': { body: '#8B0000', neck: '#DEB887', pickguard: '#1a1a1a' },
  'ocean-blue': { body: '#1e3a5f', neck: '#DEB887', pickguard: '#0a1628' },
  'neon-green': { body: '#00ff41', neck: '#1a1a1a', pickguard: '#000000' },
  'purple-haze': { body: '#4a0080', neck: '#2d2d2d', pickguard: '#1a0033' },
};

const BASS_SKINS: Record<string, SkinConfig> = {
  'natural-wood': { body: '#8B7355', neck: '#DEB887', pickguard: 'transparent' },
  'jet-black': { body: '#0a0a0a', neck: '#1a1a1a', pickguard: '#000000' },
  'vintage-sunburst': { body: '#CD853F', neck: '#DEB887', pickguard: '#8B4513' },
  'blood-red': { body: '#660000', neck: '#2d2d2d', pickguard: '#1a0000' },
  'electric-blue': { body: '#0066cc', neck: '#DEB887', pickguard: '#003366' },
};

const SLEEVE_STYLES = {
  'leather': { color: '#1a1a1a', texture: 'leather-grain', cuff: '#333333' },
  'denim': { color: '#4a5568', texture: 'denim-weave', cuff: '#2d3748' },
  'hoodie': { color: '#374151', texture: 'cotton-knit', cuff: '#1f2937' },
  'bare': { color: '#d4a574', texture: 'skin', cuff: 'transparent' },
  'band-tee': { color: '#111827', texture: 'cotton', cuff: '#000000' },
};

export const InstrumentSkinOverlay = memo(({
  instrumentType,
  skinId,
  skinColor,
  sleeveStyle,
  intensity,
  isPlaying,
}: InstrumentSkinOverlayProps) => {
  const skins = instrumentType === 'guitar' ? GUITAR_SKINS : BASS_SKINS;
  const skinConfig: SkinConfig = skins[skinId] || { body: skinColor, neck: '#DEB887', pickguard: '#1a1a1a' };
  const sleeve = SLEEVE_STYLES[sleeveStyle];

  // Hand movement animation based on intensity
  const handAnimation = useMemo(() => ({
    x: isPlaying ? [0, intensity * 3, -intensity * 2, 0] : [0],
    y: isPlaying ? [0, -intensity * 2, intensity * 1.5, 0] : [0],
  }), [intensity, isPlaying]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Transparent base - this overlays on top of base POV */}
      
      {/* Left hand / Fret hand */}
      <motion.div
        className="absolute"
        style={{
          left: '5%',
          bottom: '20%',
          width: '35%',
          height: '45%',
        }}
        animate={handAnimation}
        transition={{
          duration: 0.15 + (1 - intensity) * 0.1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Sleeve */}
        <div
          className="absolute left-0 top-0 w-full h-1/2 rounded-l-lg"
          style={{
            background: `linear-gradient(180deg, ${sleeve.color} 0%, ${sleeve.cuff} 100%)`,
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
        
        {/* Hand silhouette on fretboard */}
        <div
          className="absolute bottom-0 left-1/4 w-3/4 h-1/2"
          style={{
            background: sleeveStyle === 'bare' 
              ? `linear-gradient(135deg, ${sleeve.color} 0%, #c4956a 50%, #b8896a 100%)`
              : 'transparent',
          }}
        >
          {/* Fingers on frets */}
          {[0, 1, 2, 3].map((finger) => (
            <motion.div
              key={finger}
              className="absolute rounded-full"
              style={{
                width: '18%',
                height: '35%',
                left: `${20 + finger * 20}%`,
                bottom: '10%',
                background: sleeveStyle === 'bare'
                  ? 'linear-gradient(180deg, #d4a574 0%, #c4956a 100%)'
                  : 'transparent',
                boxShadow: sleeveStyle === 'bare' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
              }}
              animate={{
                y: isPlaying ? [0, -5 - Math.random() * 5, 0] : [0],
                scale: isPlaying ? [1, 1.05, 1] : [1],
              }}
              transition={{
                duration: 0.2 + finger * 0.05,
                repeat: Infinity,
                delay: finger * 0.03,
              }}
            />
          ))}
        </div>

        {/* Wristband detail */}
        {sleeveStyle !== 'bare' && (
          <div
            className="absolute left-0 bottom-[48%] w-full h-[8%]"
            style={{
              background: 'linear-gradient(90deg, #1a1a1a 0%, #333333 50%, #1a1a1a 100%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          />
        )}
      </motion.div>

      {/* Right hand / Picking/Plucking hand */}
      <motion.div
        className="absolute"
        style={{
          right: '10%',
          bottom: '15%',
          width: '30%',
          height: '40%',
        }}
        animate={{
          x: isPlaying ? [0, intensity * 8, -intensity * 6, intensity * 4, 0] : [0],
          y: isPlaying ? [0, intensity * 3, -intensity * 2, 0] : [0],
          rotate: isPlaying ? [0, intensity * 5, -intensity * 3, 0] : [0],
        }}
        transition={{
          duration: instrumentType === 'bass' ? 0.25 : 0.12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Sleeve */}
        <div
          className="absolute right-0 top-0 w-full h-1/2 rounded-r-lg"
          style={{
            background: `linear-gradient(180deg, ${sleeve.color} 0%, ${sleeve.cuff} 100%)`,
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
        
        {/* Hand with pick/fingers */}
        <div
          className="absolute bottom-0 right-1/4 w-3/4 h-1/2"
          style={{
            background: sleeveStyle === 'bare'
              ? `linear-gradient(135deg, #d4a574 0%, #c4956a 100%)`
              : 'transparent',
          }}
        >
          {/* Pick (for guitar) or fingers (for bass) */}
          {instrumentType === 'guitar' ? (
            <motion.div
              className="absolute right-[20%] bottom-[5%] w-[25%] h-[40%]"
              style={{
                background: 'linear-gradient(135deg, #ff6600 0%, #cc5200 100%)',
                clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
              }}
              animate={{
                rotate: isPlaying ? [0, 15, -10, 0] : [0],
              }}
              transition={{
                duration: 0.1,
                repeat: Infinity,
              }}
            />
          ) : (
            // Bass plucking fingers
            [0, 1].map((finger) => (
              <motion.div
                key={finger}
                className="absolute rounded-full"
                style={{
                  width: '20%',
                  height: '45%',
                  right: `${15 + finger * 25}%`,
                  bottom: '5%',
                  background: sleeveStyle === 'bare'
                    ? 'linear-gradient(180deg, #d4a574 0%, #c4956a 100%)'
                    : 'rgba(212, 165, 116, 0.8)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
                animate={{
                  y: isPlaying ? [0, -8, 0] : [0],
                }}
                transition={{
                  duration: 0.2,
                  repeat: Infinity,
                  delay: finger * 0.1,
                }}
              />
            ))
          )}
        </div>
      </motion.div>

      {/* Instrument body glimpse - shows the custom skin */}
      <div
        className="absolute"
        style={{
          right: '0%',
          bottom: '0%',
          width: '60%',
          height: '50%',
          background: `linear-gradient(135deg, ${skinConfig.body} 0%, ${skinConfig.body}dd 50%, ${skinConfig.body}aa 100%)`,
          clipPath: instrumentType === 'guitar'
            ? 'polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 40%)'
            : 'polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 30%)',
          boxShadow: `
            inset 0 0 30px rgba(0,0,0,0.4),
            0 0 20px rgba(255,255,255,0.1)
          `,
        }}
      >
        {/* Pickguard */}
        {skinConfig.pickguard !== 'transparent' && (
          <div
            className="absolute"
            style={{
              left: '20%',
              top: '20%',
              width: '40%',
              height: '50%',
              background: skinConfig.pickguard,
              clipPath: 'polygon(0% 20%, 100% 0%, 80% 100%, 10% 80%)',
              opacity: 0.9,
            }}
          />
        )}

        {/* Strings highlight */}
        <div className="absolute left-[35%] top-[10%] w-[30%] h-[80%] flex flex-col justify-evenly">
          {Array.from({ length: instrumentType === 'guitar' ? 6 : 4 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-px"
              style={{
                background: `linear-gradient(90deg, transparent 0%, rgba(192,192,192,${0.4 + i * 0.1}) 20%, rgba(255,255,255,${0.6 + i * 0.1}) 50%, rgba(192,192,192,${0.4 + i * 0.1}) 80%, transparent 100%)`,
              }}
              animate={{
                opacity: isPlaying ? [0.5, 1, 0.5] : [0.6],
                scaleY: isPlaying ? [1, 1.5, 1] : [1],
              }}
              transition={{
                duration: 0.05 + i * 0.01,
                repeat: Infinity,
              }}
            />
          ))}
        </div>

        {/* Pickup reflection */}
        <div
          className="absolute"
          style={{
            left: '30%',
            top: '40%',
            width: '25%',
            height: '15%',
            background: 'linear-gradient(180deg, #1a1a1a 0%, #333333 50%, #1a1a1a 100%)',
            borderRadius: '4px',
            boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.1)',
          }}
        />
      </div>

      {/* Neck glimpse with custom skin */}
      <div
        className="absolute"
        style={{
          left: '0%',
          bottom: '25%',
          width: '50%',
          height: '20%',
          background: `linear-gradient(90deg, ${skinConfig.neck} 0%, ${skinConfig.neck}dd 100%)`,
          clipPath: 'polygon(0% 30%, 100% 0%, 100% 100%, 0% 70%)',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)',
        }}
      >
        {/* Fret markers */}
        {[0.2, 0.4, 0.6, 0.8].map((pos, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: `${pos * 100}%`,
              top: '45%',
              background: 'radial-gradient(circle, #f5f5f5 0%, #d4d4d4 100%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          />
        ))}

        {/* Frets */}
        {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((pos, i) => (
          <div
            key={i}
            className="absolute h-full"
            style={{
              left: `${pos * 100}%`,
              width: '2px',
              background: 'linear-gradient(180deg, #c0c0c0 0%, #808080 100%)',
            }}
          />
        ))}
      </div>

      {/* Stage light reflection on instrument - MTV2 overexposed look */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 70% 60%, rgba(255,255,255,${0.1 + intensity * 0.15}) 0%, transparent 50%)`,
          mixBlendMode: 'overlay',
        }}
        animate={{
          opacity: [0.5, 1, 0.7, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Grainy texture overlay for MTV2 aesthetic */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
});

InstrumentSkinOverlay.displayName = 'InstrumentSkinOverlay';
