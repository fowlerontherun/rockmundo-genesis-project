import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, Music, GraduationCap, Plane } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getDiscoveryMethodInfo } from "@/utils/mentorDiscovery";
import { formatFocusSkill } from "@/pages/admin/mentors.helpers";

interface DiscoveredMentor {
  id: string;
  name: string;
  specialty: string;
  lore_biography: string;
  focus_skill: string;
  city?: {
    name: string;
    country: string;
  };
}

interface MasterDiscoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentor: DiscoveredMentor | null;
  discoveryMethod: string;
  onNavigateToEducation?: () => void;
}

export const MasterDiscoveryModal = ({
  open,
  onOpenChange,
  mentor,
  discoveryMethod,
  onNavigateToEducation
}: MasterDiscoveryModalProps) => {
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    if (open) {
      // Trigger reveal animation after modal opens
      const timer = setTimeout(() => setShowReveal(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowReveal(false);
    }
  }, [open]);

  if (!mentor) return null;

  const methodInfo = getDiscoveryMethodInfo(discoveryMethod);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <AnimatePresence mode="wait">
          {showReveal ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="space-y-4"
            >
              <DialogHeader className="text-center">
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center mb-4"
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border-2 border-primary/50">
                      <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                    {/* Sparkle effects */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                      transition={{ delay: 0.4, duration: 1, repeat: 2 }}
                      className="absolute -top-2 -right-2 text-2xl"
                    >
                      ✨
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                      transition={{ delay: 0.6, duration: 1, repeat: 2 }}
                      className="absolute -bottom-1 -left-3 text-xl"
                    >
                      ⭐
                    </motion.div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Badge variant="secondary" className="mb-2 text-xs">
                    <span className="mr-1">{methodInfo.icon}</span>
                    {methodInfo.label}
                  </Badge>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Legendary Master Discovered!
                  </DialogTitle>
                </motion.div>
              </DialogHeader>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                {/* Master Name */}
                <div className="text-center">
                  <h3 className="text-xl font-bold text-foreground">{mentor.name}</h3>
                  <p className="text-sm text-muted-foreground">{mentor.specialty}</p>
                </div>

                {/* Lore Biography */}
                {mentor.lore_biography && (
                  <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-primary/50">
                    <p className="text-sm italic text-muted-foreground">
                      "{mentor.lore_biography}"
                    </p>
                  </div>
                )}

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {mentor.city && (
                    <div className="flex items-center gap-2 bg-card rounded-lg p-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">{mentor.city.name}</p>
                        <p className="text-xs text-muted-foreground">{mentor.city.country}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-card rounded-lg p-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">Teaches</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFocusSkill(mentor.focus_skill)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                  >
                    Continue
                  </Button>
                  {onNavigateToEducation && mentor.city && (
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => {
                        onOpenChange(false);
                        onNavigateToEducation();
                      }}
                    >
                      <Plane className="h-4 w-4" />
                      View Masters
                    </Button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Sparkles className="h-12 w-12 text-primary" />
              </motion.div>
              <p className="mt-4 text-muted-foreground animate-pulse">
                A legend emerges...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
