// Character Relationship Profile — Detailed view of a relationship with another entity
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { RelationshipTagList } from "./RelationshipBadge";
import { motion } from "framer-motion";
import type { CharacterRelationship, RelationshipInteraction, RelationshipTypeTag } from "@/types/character-relationships";
import {
  Heart, Shield, Sparkles, Users, Eye, Flame, Crown, Globe, Lock,
  MessageSquare, Gift, Swords, Music, Calendar, Star, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

interface CharacterRelationshipProfileProps {
  relationship: CharacterRelationship;
  interactions?: RelationshipInteraction[];
  onInteraction?: (type: string) => void;
  className?: string;
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; class: string }> = {
    public: { icon: <Globe className="h-3 w-3" />, label: "Public", class: "text-social-trust border-social-trust/30" },
    friends_only: { icon: <Users className="h-3 w-3" />, label: "Friends Only", class: "text-social-warm border-social-warm/30" },
    private: { icon: <Lock className="h-3 w-3" />, label: "Private", class: "text-muted-foreground border-border" },
    leaked: { icon: <Eye className="h-3 w-3" />, label: "LEAKED", class: "text-social-drama border-social-drama/30 animate-pulse" },
  };
  const c = config[visibility] ?? config.private;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px]", c.class)}>
      {c.icon}{c.label}
    </Badge>
  );
}

// Determine visual tone based on relationship state
function getRelationshipTone(rel: CharacterRelationship) {
  if (rel.affection_score >= 60 && rel.trust_score >= 60) return "warm";
  if (rel.affection_score <= -30 || rel.trust_score <= 20) return "hostile";
  if (rel.jealousy_score >= 60) return "tense";
  if (rel.attraction_score >= 70) return "romantic";
  return "neutral";
}

const TONE_STYLES = {
  warm: "border-social-warm/20 shadow-[0_0_15px_hsl(var(--social-warm)/0.1)]",
  hostile: "border-social-tension/20 shadow-[0_0_15px_hsl(var(--social-tension)/0.1)]",
  tense: "border-social-jealousy/20 shadow-[0_0_15px_hsl(var(--social-jealousy)/0.1)]",
  romantic: "border-social-love/20 shadow-[0_0_15px_hsl(var(--social-love)/0.1)]",
  neutral: "border-border/50",
};

const QUICK_ACTIONS = [
  { id: "casual_chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "gift", label: "Gift", icon: <Gift className="h-4 w-4" /> },
  { id: "collaboration", label: "Collab", icon: <Music className="h-4 w-4" /> },
  { id: "flirt", label: "Flirt", icon: <Heart className="h-4 w-4" /> },
  { id: "competition", label: "Challenge", icon: <Swords className="h-4 w-4" /> },
  { id: "deep_conversation", label: "Deep Talk", icon: <Sparkles className="h-4 w-4" /> },
];

export function CharacterRelationshipProfile({
  relationship,
  interactions = [],
  onInteraction,
  className,
}: CharacterRelationshipProfileProps) {
  const tone = getRelationshipTone(relationship);
  const rel = relationship;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-4", className)}
    >
      {/* Header Card */}
      <Card className={cn("overflow-hidden transition-all duration-500", TONE_STYLES[tone])}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold font-oswald flex items-center gap-2">
                {rel.entity_b_name}
                {rel.affection_score >= 80 && <Star className="h-5 w-5 text-social-warm fill-social-warm" />}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{rel.entity_b_type}</Badge>
                <VisibilityBadge visibility={rel.visibility} />
                {rel.last_interaction_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Last seen: {format(new Date(rel.last_interaction_at), "MMM d")}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>

          {/* Relationship Tags */}
          <div className="pt-2">
            <RelationshipTagList tags={rel.relationship_types} size="md" />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* 5 Emotional Metrics */}
          <div className="grid grid-cols-5 gap-3">
            <ScoreGauge
              value={rel.affection_score}
              min={-100}
              max={100}
              label="Affection"
              color="social-love"
              variant="ring"
              size="md"
            />
            <ScoreGauge
              value={rel.trust_score}
              label="Trust"
              color="social-trust"
              variant="ring"
              size="md"
            />
            <ScoreGauge
              value={rel.attraction_score}
              label="Attraction"
              color="social-attraction"
              variant="ring"
              size="md"
            />
            <ScoreGauge
              value={rel.loyalty_score}
              label="Loyalty"
              color="social-loyalty"
              variant="ring"
              size="md"
            />
            <ScoreGauge
              value={rel.jealousy_score}
              label="Jealousy"
              color="social-jealousy"
              variant="ring"
              size="md"
            />
          </div>

          <Separator className="bg-border/50" />

          {/* Quick Actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Interactions
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2 gap-1 text-xs hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => onInteraction?.(action.id)}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interaction History Timeline */}
      {interactions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Interaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-3">
              <div className="relative space-y-0">
                {/* Vertical timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                {interactions.slice(0, 30).map((interaction, i) => (
                  <motion.div
                    key={interaction.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex gap-3 py-2 relative"
                  >
                    <div className={cn(
                      "mt-1 h-[10px] w-[10px] rounded-full border-2 border-border bg-card z-10 flex-shrink-0",
                      interaction.affection_change > 0 ? "border-social-warm bg-social-warm/30" :
                      interaction.affection_change < 0 ? "border-social-tension bg-social-tension/30" :
                      "border-muted-foreground",
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium capitalize truncate">
                          {interaction.interaction_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {format(new Date(interaction.created_at), "MMM d")}
                        </span>
                      </div>
                      {interaction.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{interaction.description}</p>
                      )}
                      <div className="flex gap-1.5 mt-0.5">
                        {interaction.affection_change !== 0 && (
                          <span className={cn("text-[10px] font-oswald",
                            interaction.affection_change > 0 ? "text-social-love" : "text-social-tension"
                          )}>
                            ❤️ {interaction.affection_change > 0 ? "+" : ""}{interaction.affection_change}
                          </span>
                        )}
                        {interaction.trust_change !== 0 && (
                          <span className={cn("text-[10px] font-oswald",
                            interaction.trust_change > 0 ? "text-social-trust" : "text-social-tension"
                          )}>
                            🛡 {interaction.trust_change > 0 ? "+" : ""}{interaction.trust_change}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
