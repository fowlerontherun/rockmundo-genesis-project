import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Zap, Music, Users, Clock, Star, Heart, TrendingUp, 
  Gift, DollarSign, Trophy, Sparkles 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { JamSessionResults } from "@/hooks/useJamSessions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface JamOutcomeReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: JamSessionResults | null;
}

export const JamOutcomeReportDialog = ({
  open,
  onOpenChange,
  results,
}: JamOutcomeReportDialogProps) => {
  // Fetch participant profiles for display names
  const { data: participants = [] } = useQuery({
    queryKey: ["jam-outcome-profiles", results?.session_id],
    queryFn: async () => {
      if (!results?.outcomes) return [];
      const profileIds = results.outcomes.map(o => o.participant_id);
      
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", profileIds);
      
      return data || [];
    },
    enabled: !!results?.outcomes && open,
  });

  // Fetch gifted song details if any
  const { data: giftedSong } = useQuery({
    queryKey: ["gifted-song", results?.gifted_song_id],
    queryFn: async () => {
      if (!results?.gifted_song_id) return null;
      
      const { data } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score")
        .eq("id", results.gifted_song_id)
        .single();
      
      return data;
    },
    enabled: !!results?.gifted_song_id && open,
  });

  if (!results) return null;

  const getProfileDisplay = (participantId: string) => {
    const profile = participants.find(p => p.id === participantId);
    return {
      name: profile?.display_name || profile?.username || "Unknown",
      avatar: profile?.avatar_url,
    };
  };

  const formatSkillSlug = (slug: string) => {
    if (!slug) return "Unknown Skill";
    // Extract instrument name from slug like "instruments_basic_acoustic_guitar"
    const parts = slug.split("_");
    const instrumentParts = parts.slice(2);
    return instrumentParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 90) return "text-yellow-500";
    if (rating >= 75) return "text-green-500";
    if (rating >= 60) return "text-blue-500";
    return "text-muted-foreground";
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 90) return "Outstanding";
    if (rating >= 80) return "Excellent";
    if (rating >= 70) return "Great";
    if (rating >= 60) return "Good";
    return "Decent";
  };

  const songRecipient = results.outcomes.find(o => o.received_song);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Jam Session Complete!
          </DialogTitle>
          <DialogDescription>
            Here's how the session went
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Session Overview */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Zap className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-bold">{results.total_xp_awarded}</p>
                  <p className="text-xs text-muted-foreground">Total XP Awarded</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-cyan-500" />
                  <p className="text-2xl font-bold">{results.synergy_score}%</p>
                  <p className="text-xs text-muted-foreground">Synergy Score</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Heart className="h-6 w-6 mx-auto mb-2 text-pink-500" />
                  <p className="text-2xl font-bold">{results.mood_score}%</p>
                  <p className="text-xs text-muted-foreground">Mood Score</p>
                </CardContent>
              </Card>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Session lasted {results.duration_minutes} minutes</span>
            </div>

            {/* Gifted Song */}
            <AnimatePresence>
              {giftedSong && songRecipient && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Card className="border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/20 rounded-full">
                          <Gift className="h-8 w-8 text-yellow-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-semibold text-yellow-600">Gifted Song!</span>
                          </div>
                          <p className="text-lg font-bold">{giftedSong.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Badge variant="secondary">{giftedSong.genre}</Badge>
                            <span>Quality: {giftedSong.quality_score}/100</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Awarded to {getProfileDisplay(songRecipient.participant_id).name}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Individual Outcomes */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participant Results
              </h3>
              
              {results.outcomes.map((outcome, index) => {
                const { name, avatar } = getProfileDisplay(outcome.participant_id);
                
                return (
                  <motion.div
                    key={outcome.participant_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={avatar || undefined} />
                            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{name}</span>
                                {outcome.received_song && (
                                  <Badge className="bg-yellow-500/20 text-yellow-600">
                                    <Gift className="h-3 w-3 mr-1" />
                                    Song Gifted
                                  </Badge>
                                )}
                              </div>
                              <div className={`text-sm font-medium ${getRatingColor(outcome.performance_rating)}`}>
                                {getRatingLabel(outcome.performance_rating)}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Performance</span>
                                <span>{outcome.performance_rating}%</span>
                              </div>
                              <Progress value={outcome.performance_rating} className="h-1.5" />
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-1.5">
                                <Zap className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium">+{outcome.xp_earned}</span>
                                <span className="text-xs text-muted-foreground">XP</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="font-medium">+{outcome.skill_xp_gained}</span>
                                <span className="text-xs text-muted-foreground">Skill</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Heart className="h-4 w-4 text-pink-500" />
                                <span className="font-medium">+{outcome.chemistry_gained}</span>
                                <span className="text-xs text-muted-foreground">Chem</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Music className="h-3 w-3" />
                              <span>{formatSkillSlug(outcome.skill_slug)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
