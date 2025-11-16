import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Heart, Star, Flame, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrowdEnergyVisualizerProps {
  energy: number; // 0-100
  crowdResponse: "ecstatic" | "enthusiastic" | "engaged" | "mixed" | "disappointed";
  attendance: number;
  className?: string;
}

const getEnergyColor = (energy: number) => {
  if (energy >= 80) return "from-orange-500 to-red-500";
  if (energy >= 60) return "from-yellow-400 to-orange-400";
  if (energy >= 40) return "from-blue-400 to-cyan-400";
  if (energy >= 20) return "from-gray-400 to-slate-400";
  return "from-gray-600 to-gray-500";
};

const getEnergyIcon = (energy: number) => {
  if (energy >= 80) return Flame;
  if (energy >= 60) return Zap;
  if (energy >= 40) return Star;
  if (energy >= 20) return Heart;
  return Users;
};

const getCrowdEmojis = (response: string) => {
  switch (response) {
    case "ecstatic": return ["🔥", "🎸", "🎤", "⚡", "🌟"];
    case "enthusiastic": return ["🎉", "👏", "🙌", "💫", "✨"];
    case "engaged": return ["👍", "😊", "🎵", "🎶", "😎"];
    case "mixed": return ["😐", "🤔", "😕", "👀", "🫤"];
    case "disappointed": return ["😞", "😔", "👎", "😑", "💤"];
    default: return ["👥", "🎭", "🎪"];
  }
};

export const CrowdEnergyVisualizer = ({
  energy,
  crowdResponse,
  attendance,
  className
}: CrowdEnergyVisualizerProps) => {
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number; y: number }>>([]);
  const [pulseCount, setPulseCount] = useState(0);
  
  const EnergyIcon = getEnergyIcon(energy);
  const emojis = getCrowdEmojis(crowdResponse);

  // Generate crowd particles based on energy
  useEffect(() => {
    if (energy >= 50) {
      const interval = setInterval(() => {
        const newParticle = {
          id: Date.now() + Math.random(),
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
          x: Math.random() * 100,
          y: Math.random() * 100
        };
        
        setParticles(prev => [...prev.slice(-20), newParticle]);
      }, energy >= 80 ? 500 : 1000);

      return () => clearInterval(interval);
    }
  }, [energy, emojis]);

  // Pulse effect on high energy
  useEffect(() => {
    if (energy >= 70) {
      const interval = setInterval(() => {
        setPulseCount(c => c + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [energy]);

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-card p-6", className)}>
      {/* Background gradient based on energy */}
      <div 
        className={cn(
          "absolute inset-0 opacity-20 bg-gradient-to-br",
          getEnergyColor(energy)
        )}
      />

      {/* Crowd particles */}
      <AnimatePresence>
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            initial={{ 
              opacity: 0, 
              scale: 0, 
              x: `${particle.x}%`, 
              y: "100%" 
            }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              scale: [0, 1.5, 1.5, 0],
              y: "-20%"
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute text-2xl pointer-events-none"
            style={{ left: 0, top: 0 }}
          >
            {particle.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ 
                scale: energy >= 70 ? [1, 1.2, 1] : 1,
                rotate: energy >= 80 ? [0, 5, -5, 0] : 0
              }}
              transition={{ duration: 1, repeat: energy >= 70 ? Infinity : 0 }}
              className={cn(
                "p-3 rounded-full bg-gradient-to-br",
                getEnergyColor(energy)
              )}
            >
              <EnergyIcon className="h-6 w-6 text-white" />
            </motion.div>
            <div>
              <h3 className="font-semibold text-lg">Crowd Energy</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {crowdResponse} ({attendance} people)
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
              {Math.round(energy)}%
            </div>
          </div>
        </div>

        {/* Energy bar */}
        <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full bg-gradient-to-r rounded-full",
              getEnergyColor(energy)
            )}
            initial={{ width: 0 }}
            animate={{ width: `${energy}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          
          {/* Pulse effect on high energy */}
          {energy >= 70 && (
            <motion.div
              key={pulseCount}
              className={cn(
                "absolute inset-0 bg-gradient-to-r rounded-full",
                getEnergyColor(energy)
              )}
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 1 }}
            />
          )}
        </div>

        {/* Energy level description */}
        <div className="mt-3 text-sm text-center">
          {energy >= 80 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-orange-500 font-semibold"
            >
              <Sparkles className="h-4 w-4" />
              The crowd is absolutely ON FIRE!
              <Sparkles className="h-4 w-4" />
            </motion.div>
          )}
          {energy >= 60 && energy < 80 && (
            <span className="text-yellow-600 font-medium">
              High energy - the crowd is loving this!
            </span>
          )}
          {energy >= 40 && energy < 60 && (
            <span className="text-blue-600">
              Good vibes - steady engagement
            </span>
          )}
          {energy >= 20 && energy < 40 && (
            <span className="text-muted-foreground">
              Moderate interest - room to improve
            </span>
          )}
          {energy < 20 && (
            <span className="text-destructive">
              Low energy - need to win them back
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
