import { motion } from "framer-motion";

interface InstrumentOverlayProps {
  role: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
}

export const InstrumentOverlay = ({ role }: InstrumentOverlayProps) => {
  // Simple instrument indicators positioned relative to the avatar
  switch (role) {
    case 'vocalist':
      return (
        <motion.div 
          className="absolute -right-2 top-1/3 text-2xl"
          animate={{ 
            rotate: [-10, 10, -10],
            y: [0, -2, 0],
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          🎤
        </motion.div>
      );
    
    case 'guitarist':
      return (
        <motion.div 
          className="absolute -left-4 top-1/2 text-3xl opacity-80"
          animate={{ 
            rotate: [-5, 5, -5],
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          🎸
        </motion.div>
      );
    
    case 'bassist':
      return (
        <motion.div 
          className="absolute -right-4 top-1/2 text-3xl opacity-80"
          animate={{ 
            rotate: [-3, 3, -3],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          🎸
        </motion.div>
      );
    
    case 'drummer':
      return (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          <motion.span 
            className="text-xl"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.25, repeat: Infinity }}
          >
            🥁
          </motion.span>
        </div>
      );
    
    case 'keyboardist':
      return (
        <motion.div 
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-2xl"
          animate={{ 
            y: [0, -1, 0],
          }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          🎹
        </motion.div>
      );
    
    default:
      return null;
  }
};
