import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, HeartCrack, Crown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Marriage } from "@/hooks/useMarriage";
import { formatDistanceToNow } from "date-fns";

interface MarriageStatusCardProps {
  marriage: Marriage;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  isPartnerA: boolean;
  onDivorce?: () => void;
  onAcceptProposal?: () => void;
  onDeclineProposal?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  proposed: { label: "Proposal Pending", color: "bg-social-attraction/20 text-social-attraction border-social-attraction/30", icon: <Heart className="h-3.5 w-3.5" /> },
  accepted: { label: "Accepted", color: "bg-social-love/20 text-social-love border-social-love/30", icon: <Heart className="h-3.5 w-3.5" /> },
  active: { label: "Married", color: "bg-social-love/20 text-social-love border-social-love/30", icon: <Crown className="h-3.5 w-3.5" /> },
  separated: { label: "Separated", color: "bg-social-tension/20 text-social-tension border-social-tension/30", icon: <HeartCrack className="h-3.5 w-3.5" /> },
  divorced: { label: "Divorced", color: "bg-muted text-muted-foreground border-border", icon: <HeartCrack className="h-3.5 w-3.5" /> },
};

export function MarriageStatusCard({
  marriage,
  partnerName,
  partnerAvatarUrl,
  isPartnerA,
  onDivorce,
  onAcceptProposal,
  onDeclineProposal,
  className,
}: MarriageStatusCardProps) {
  const config = STATUS_CONFIG[marriage.status] ?? STATUS_CONFIG.active;
  const isProposal = marriage.status === "proposed";
  const isRecipient = isProposal && !isPartnerA;

  return (
    <Card className={cn(
      "border transition-all duration-300",
      marriage.status === "active" && "border-social-love/30 shadow-[0_0_16px_hsl(var(--social-love)/0.1)]",
      className,
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {config.icon}
          Marriage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-social-love/30">
              <AvatarImage src={partnerAvatarUrl ?? undefined} />
              <AvatarFallback className="bg-social-love/10 text-social-love text-xs">
                {partnerName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{partnerName}</p>
              <p className="text-xs text-muted-foreground">
                {marriage.started_at
                  ? `Married ${formatDistanceToNow(new Date(marriage.started_at), { addSuffix: true })}`
                  : marriage.proposed_at
                  ? `Proposed ${formatDistanceToNow(new Date(marriage.proposed_at), { addSuffix: true })}`
                  : ""}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", config.color)}>
            {config.label}
          </Badge>
        </div>

        {marriage.wedding_date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Wedding: {new Date(marriage.wedding_date).toLocaleDateString()}
          </div>
        )}

        {isRecipient && (
          <div className="flex gap-2">
            <Button size="sm" onClick={onAcceptProposal} className="bg-social-love hover:bg-social-love/90 text-white flex-1">
              Accept 💍
            </Button>
            <Button size="sm" variant="outline" onClick={onDeclineProposal} className="flex-1">
              Decline
            </Button>
          </div>
        )}

        {marriage.status === "active" && onDivorce && (
          <Button size="sm" variant="ghost" onClick={onDivorce} className="text-destructive hover:text-destructive w-full text-xs">
            <HeartCrack className="h-3.5 w-3.5 mr-1" /> Initiate Divorce
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
