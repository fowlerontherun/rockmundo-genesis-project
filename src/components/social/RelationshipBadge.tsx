// Visual badge for relationship type tags
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RelationshipTypeTag } from "@/types/character-relationships";
import {
  Heart, Swords, Users, Star, HandHelping, Handshake,
  HeartCrack, Music, GraduationCap, Briefcase, Sparkles, Eye,
} from "lucide-react";

const TAG_CONFIG: Record<RelationshipTypeTag, {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}> = {
  acquaintance: { label: "Acquaintance", icon: <Users className="h-3 w-3" />, colorClass: "bg-muted text-muted-foreground border-border" },
  friend: { label: "Friend", icon: <Handshake className="h-3 w-3" />, colorClass: "bg-social-trust/15 text-social-trust border-social-trust/30" },
  close_friend: { label: "Close Friend", icon: <Star className="h-3 w-3" />, colorClass: "bg-social-warm/15 text-social-warm border-social-warm/30" },
  best_friend: { label: "Best Friend", icon: <Sparkles className="h-3 w-3" />, colorClass: "bg-social-chemistry/15 text-social-chemistry border-social-chemistry/30" },
  rival: { label: "Rival", icon: <Swords className="h-3 w-3" />, colorClass: "bg-social-jealousy/15 text-social-jealousy border-social-jealousy/30" },
  nemesis: { label: "Nemesis", icon: <Swords className="h-3 w-3" />, colorClass: "bg-social-tension/15 text-social-tension border-social-tension/30" },
  partner: { label: "Partner", icon: <Heart className="h-3 w-3" />, colorClass: "bg-social-love/15 text-social-love border-social-love/30" },
  ex_partner: { label: "Ex", icon: <HeartCrack className="h-3 w-3" />, colorClass: "bg-social-drama/15 text-social-drama border-social-drama/30" },
  bandmate: { label: "Bandmate", icon: <Music className="h-3 w-3" />, colorClass: "bg-primary/15 text-primary border-primary/30" },
  mentor: { label: "Mentor", icon: <GraduationCap className="h-3 w-3" />, colorClass: "bg-social-loyalty/15 text-social-loyalty border-social-loyalty/30" },
  protege: { label: "Protégé", icon: <GraduationCap className="h-3 w-3" />, colorClass: "bg-social-loyalty/15 text-social-loyalty border-social-loyalty/30" },
  business_contact: { label: "Business", icon: <Briefcase className="h-3 w-3" />, colorClass: "bg-muted text-foreground border-border" },
  fan: { label: "Fan", icon: <Eye className="h-3 w-3" />, colorClass: "bg-social-attraction/15 text-social-attraction border-social-attraction/30" },
  collaborator: { label: "Collaborator", icon: <HandHelping className="h-3 w-3" />, colorClass: "bg-primary/15 text-primary border-primary/30" },
};

interface RelationshipBadgeProps {
  tag: RelationshipTypeTag;
  size?: "sm" | "md";
  className?: string;
}

export function RelationshipBadge({ tag, size = "sm", className }: RelationshipBadgeProps) {
  const config = TAG_CONFIG[tag];
  if (!config) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium border",
        config.colorClass,
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        className,
      )}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

interface RelationshipTagListProps {
  tags: RelationshipTypeTag[];
  maxVisible?: number;
  size?: "sm" | "md";
  className?: string;
}

export function RelationshipTagList({ tags, maxVisible = 4, size = "sm", className }: RelationshipTagListProps) {
  const visible = tags.slice(0, maxVisible);
  const overflow = tags.length - maxVisible;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visible.map((tag) => (
        <RelationshipBadge key={tag} tag={tag} size={size} />
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
          +{overflow}
        </Badge>
      )}
    </div>
  );
}
