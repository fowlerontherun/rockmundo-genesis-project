import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Music, User } from "lucide-react";
import { PresenceIndicator } from "@/components/presence/PresenceIndicator";

interface PlayerProfileHeaderProps {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  cityName?: string | null;
  currentBand?: { id: string; name: string } | null;
  mainRole?: string | null;
  fame?: number | null;
  careerLevel?: number | null;
  presence?: any;
  isOwnProfile?: boolean;
  actions?: React.ReactNode;
}

export function PlayerProfileHeader({ name, username, avatarUrl, cityName, currentBand, mainRole, fame, careerLevel, presence, isOwnProfile, actions }: PlayerProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-start md:p-6">
      <Avatar className="h-24 w-24 border-2 border-primary/30">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{name}</h1>
              {presence && <PresenceIndicator state={presence} />}
              {isOwnProfile && <Badge variant="secondary">Your profile</Badge>}
            </div>
            {username && username !== name && <p className="text-sm text-muted-foreground">@{username}</p>}
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {currentBand && <Link to={`/band/${currentBand.id}`} className="inline-flex items-center gap-1 hover:underline"><Music className="h-3 w-3" />{currentBand.name}</Link>}
          {mainRole && <Badge variant="outline">{mainRole}</Badge>}
          {careerLevel != null && <Badge variant="outline">Career level {careerLevel}</Badge>}
          {fame != null && <Badge variant="outline">Fame {fame.toLocaleString()}</Badge>}
          {cityName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{cityName}</span>}
        </div>
      </div>
    </div>
  );
}

export function FutureProfileActions() {
  return (
    <>
      {['Message', 'Invite to activity', 'Offer job', 'Send item', 'Send money', 'Report', 'Block'].map((label) => (
        <Button key={label} size="sm" variant="outline" disabled title="Coming in a future social PR">{label}</Button>
      ))}
    </>
  );
}
