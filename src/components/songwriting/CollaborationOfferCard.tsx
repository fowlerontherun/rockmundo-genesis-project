import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, Percent, Music, Users, Check, X, Loader2 } from "lucide-react";
import { useCollaborationInvites } from "@/hooks/useCollaborationInvites";

interface CollaborationOffer {
  id: string;
  project: {
    id: string;
    title: string;
    genres: string[] | null;
    quality_score: number | null;
  };
  inviter_profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  is_band_member: boolean;
  compensation_type: "none" | "flat_fee" | "royalty";
  flat_fee_amount: number | null;
  royalty_percentage: number | null;
  invited_at: string;
}

interface CollaborationOfferCardProps {
  offer: CollaborationOffer;
}

export const CollaborationOfferCard = ({ offer }: CollaborationOfferCardProps) => {
  const { respondToInvitation } = useCollaborationInvites();

  const handleAccept = () => {
    respondToInvitation.mutate({ collaborationId: offer.id, accept: true });
  };

  const handleDecline = () => {
    respondToInvitation.mutate({ collaborationId: offer.id, accept: false });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderCompensation = () => {
    if (offer.is_band_member || offer.compensation_type === "none") {
      return (
        <Badge variant="outline" className="text-primary border-primary">
          <Users className="h-3 w-3 mr-1" />
          Band Collaboration
        </Badge>
      );
    }

    if (offer.compensation_type === "flat_fee") {
      return (
        <Badge variant="secondary" className="text-base font-bold">
          <DollarSign className="h-4 w-4 mr-1" />
          ${offer.flat_fee_amount?.toLocaleString()} Writing Fee
        </Badge>
      );
    }

    if (offer.compensation_type === "royalty") {
      return (
        <Badge variant="secondary" className="text-base font-bold">
          <Percent className="h-4 w-4 mr-1" />
          {offer.royalty_percentage}% Royalty Split
        </Badge>
      );
    }

    return null;
  };

  const estimateEarnings = () => {
    if (offer.compensation_type !== "royalty" || !offer.royalty_percentage) return null;
    
    // Estimate based on quality score
    const qualityScore = offer.project?.quality_score || 50;
    const baseEarnings = qualityScore * 100; // $50-100 estimated
    const yourShare = (baseEarnings * offer.royalty_percentage) / 100;
    
    return (
      <p className="text-xs text-muted-foreground mt-2">
        Estimated earnings: ${yourShare.toFixed(0)} - ${(yourShare * 3).toFixed(0)} per release cycle
      </p>
    );
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={offer.inviter_profile?.avatar_url || undefined} />
              <AvatarFallback>
                {offer.inviter_profile?.username?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">
                {offer.inviter_profile?.username || "Unknown"} invited you
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {formatDate(offer.invited_at)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-accent/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Music className="h-4 w-4 text-primary" />
            <span className="font-medium">{offer.project?.title || "Untitled"}</span>
          </div>
          {offer.project?.genres && offer.project.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {offer.project.genres.map((genre) => (
                <Badge key={genre} variant="outline" className="text-xs">
                  {genre}
                </Badge>
              ))}
            </div>
          )}
          {offer.project?.quality_score && (
            <div className="mt-2 text-xs text-muted-foreground">
              Quality: {offer.project.quality_score}%
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Compensation Offer:</p>
          {renderCompensation()}
          {estimateEarnings()}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDecline}
            disabled={respondToInvitation.isPending}
          >
            {respondToInvitation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                Decline
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleAccept}
            disabled={respondToInvitation.isPending}
          >
            {respondToInvitation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Accept
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
