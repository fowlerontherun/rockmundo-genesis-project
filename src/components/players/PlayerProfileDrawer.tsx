import { Link } from "react-router-dom";
import { Star, Music, MapPin, Users, UserPlus, Clock, Check, ExternalLink, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export type DrawerPlayer = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  fame: number;
  fans: number;
  city_name: string | null;
  bands: { name: string; role: string | null }[];
};

export type DrawerFriendState = "self" | "none" | "friends" | "pending_sent" | "pending_received";

export type MutualFriend = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface Props {
  player: DrawerPlayer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DrawerFriendState;
  friendshipId?: string;
  onAdd: (profileId: string) => void | Promise<void>;
  onAccept: (friendshipId: string) => void | Promise<void>;
  busy?: boolean;
  mutuals?: MutualFriend[];
}

export function PlayerProfileDrawer({
  player,
  open,
  onOpenChange,
  state,
  friendshipId,
  onAdd,
  onAccept,
  busy,
  mutuals = [],
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {player && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-start gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={player.avatar_url ?? undefined} />
                  <AvatarFallback>
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">
                    {player.display_name || player.username}
                  </SheetTitle>
                  <SheetDescription className="truncate">@{player.username}</SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      <Star className="mr-1 h-3 w-3" />
                      {player.fame.toLocaleString()} fame
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Music className="mr-1 h-3 w-3" />
                      Lv {player.level}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Users className="mr-1 h-3 w-3" />
                      {player.fans.toLocaleString()} fans
                    </Badge>
                    {player.city_name && (
                      <Badge variant="outline" className="text-[10px]">
                        <MapPin className="mr-1 h-3 w-3" />
                        {player.city_name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-5 space-y-4">
              {player.bio && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Bio</h3>
                  <p className="text-sm text-muted-foreground">{player.bio}</p>
                </div>
              )}

              {mutuals.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    <Users className="mr-1 inline h-3.5 w-3.5" />
                    {mutuals.length} mutual friend{mutuals.length === 1 ? "" : "s"}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {mutuals.slice(0, 8).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 pr-2"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px]">
                            {(m.display_name || m.username).slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{m.display_name || m.username}</span>
                      </div>
                    ))}
                    {mutuals.length > 8 && (
                      <span className="self-center text-xs text-muted-foreground">+{mutuals.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}


              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Bands</h3>
                {player.bands.length > 0 ? (
                  <ul className="space-y-1.5">
                    {player.bands.map((b, i) => (
                      <li
                        key={`${b.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Music className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{b.name}</span>
                        </span>
                        {b.role && (
                          <span className="text-xs text-muted-foreground">{b.role}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Solo artist</p>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Stats</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Level</div>
                    <div className="text-lg font-bold">{player.level}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Fame</div>
                    <div className="text-lg font-bold">{player.fame.toLocaleString()}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Fans</div>
                    <div className="text-lg font-bold">{player.fans.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                {state === "none" && (
                  <Button onClick={() => onAdd(player.id)} disabled={busy}>
                    <UserPlus className="mr-2 h-4 w-4" /> Send friend request
                  </Button>
                )}
                {state === "pending_sent" && (
                  <Button variant="secondary" disabled>
                    <Clock className="mr-2 h-4 w-4" /> Request sent
                  </Button>
                )}
                {state === "pending_received" && friendshipId && (
                  <Button onClick={() => onAccept(friendshipId)} disabled={busy}>
                    <Check className="mr-2 h-4 w-4" /> Accept friend request
                  </Button>
                )}
                {state === "friends" && (
                  <Button variant="secondary" disabled>
                    <Check className="mr-2 h-4 w-4" /> Already friends
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to={`/player/${player.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" /> View full profile
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
