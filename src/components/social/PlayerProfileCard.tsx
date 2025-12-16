import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Music, Calendar, Users, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface PlayerProfileCardProps {
  player: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    fame: number;
    level: number;
    total_hours_played?: number;
    created_at: string;
  };
  showViewButton?: boolean;
}

export const PlayerProfileCard = ({ player, showViewButton = true }: PlayerProfileCardProps) => {
  const memberSince = new Date(player.created_at).toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  });

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={player.avatar_url || undefined} />
            <AvatarFallback className="text-lg">
              {(player.display_name || player.username)?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              {player.display_name || player.username}
            </h3>
            <p className="text-sm text-muted-foreground">@{player.username}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {player.fame.toLocaleString()} Fame
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Music className="h-3 w-3" />
                Level {player.level}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Since {memberSince}
            </span>
            {player.total_hours_played && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {Math.round(player.total_hours_played)}h played
              </span>
            )}
          </div>
          {showViewButton && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/player/${player.id}`}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
