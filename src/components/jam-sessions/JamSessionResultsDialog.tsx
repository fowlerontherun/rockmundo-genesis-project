import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Zap, Music, Star, Gift, Users, TrendingUp, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ParticipantOutcome {
  participant_id: string;
  xp_earned: number;
  skill_slug: string;
  skill_xp_gained: number;
  chemistry_gained: number;
  performance_rating: number;
  received_song: boolean;
}

interface JamSessionResults {
  session_id: string;
  total_xp_awarded: number;
  duration_minutes: number;
  synergy_score: number;
  mood_score: number;
  gifted_song_id: string | null;
  outcomes: ParticipantOutcome[];
}

interface JamSessionResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: JamSessionResults | null;
}

// Convert skill slug to readable name
const formatSkillName = (slug: string): string => {
  if (!slug) return "Unknown Skill";
  
  // Remove prefix and tier
  const parts = slug.split('_');
  if (parts.length >= 3) {
    // Skip "instruments" and tier, capitalize rest
    return parts.slice(2).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  return slug;
};

export const JamSessionResultsDialog = ({
  open,
  onOpenChange,
  results,
}: JamSessionResultsDialogProps) => {
  if (!results) return null;

  const hasGiftedSong = !!results.gifted_song_id;
  const songRecipient = results.outcomes.find(o => o.received_song);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Jam Session Complete!
          </DialogTitle>
          <DialogDescription>
            {results.duration_minutes} minute session • {results.outcomes.length} participants
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-3 text-center">
                <Zap className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold">{results.total_xp_awarded}</p>
                <p className="text-xs text-muted-foreground">Total XP</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="p-3 text-center">
                <Users className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <p className="text-lg font-bold">{results.synergy_score}%</p>
                <p className="text-xs text-muted-foreground">Synergy</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-3 text-center">
                <Star className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <p className="text-lg font-bold">{results.mood_score}%</p>
                <p className="text-xs text-muted-foreground">Mood</p>
              </CardContent>
            </Card>
          </div>

          {/* Gifted Song Alert */}
          <AnimatePresence>
            {hasGiftedSong && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, type: "spring" }}
              >
                <Card className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-500/20 rounded-full">
                        <Gift className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-yellow-600">Song Created!</h4>
                        <p className="text-sm text-muted-foreground">
                          The creative energy produced a new demo song!
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <Separator />

          {/* Participant Outcomes */}
          <div>
            <h4 className="text-sm font-medium mb-2">Participant Rewards</h4>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {results.outcomes.map((outcome, idx) => (
                  <motion.div
                    key={outcome.participant_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Player {idx + 1}
                        </Badge>
                        {outcome.received_song && (
                          <Badge className="bg-yellow-500/20 text-yellow-600 text-xs">
                            <Gift className="h-3 w-3 mr-1" />
                            Song!
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {outcome.performance_rating}% perf
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-primary" />
                        <span>+{outcome.xp_earned} XP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span>+{outcome.skill_xp_gained} Skill</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Music className="h-3 w-3 text-purple-500" />
                        <span>+{outcome.chemistry_gained} Chem</span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">
                        Skill: {formatSkillName(outcome.skill_slug)}
                      </p>
                      <Progress 
                        value={outcome.performance_rating} 
                        className="h-1 mt-1" 
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
