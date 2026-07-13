import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, Music, Star, User, UserPlus, Zap } from "lucide-react";
import { usePlayerConnection } from "@/hooks/usePlayerConnections";
import { SafetyActions } from "@/components/social-safety/SafetyActions";
import type { PlayerDiscoveryResult } from "../services/playerDiscovery";

export function PlayerDiscoveryCard({ player, view = "grid", onOpen }: { player: PlayerDiscoveryResult; view?: "grid" | "list"; onOpen?: () => void }) {
  const compact = view === "list";
  const connection = usePlayerConnection(player.id);
  return <Card className="h-full overflow-hidden" aria-label={`${player.characterName}, ${player.match.percentage}% match`}>
    <CardContent className={`p-4 ${compact ? "sm:flex sm:items-start sm:gap-4" : "space-y-3"}`}>
      <div className="flex items-start gap-3">
        <Avatar className="h-14 w-14"><AvatarImage src={player.avatarUrl ?? undefined} /><AvatarFallback><User className="h-7 w-7" /></AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{player.characterName}</h3>
          <p className="text-sm text-muted-foreground">{player.activityState === "hidden" ? "Activity hidden" : player.activityState === "online" ? "Online now" : `Active ${player.activityState}`}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge><Zap className="mr-1 h-3 w-3" />{player.match.percentage}% match</Badge>
          {player.cityName && <Badge variant="outline"><MapPin className="mr-1 h-3 w-3" />{player.cityName}</Badge>}
          {player.primaryInstrument && <Badge variant="secondary"><Music className="mr-1 h-3 w-3" />{player.primaryInstrument}</Badge>}
          <Badge variant="outline"><Star className="mr-1 h-3 w-3" />{player.careerLevel}</Badge>
        </div>
        {player.statusMessage && <p className="line-clamp-2 text-sm text-muted-foreground">{player.statusMessage}</p>}
        <div className="flex flex-wrap gap-1">{[...player.availability, ...player.preferredGenres, ...player.badges].slice(0, 7).map((label) => <Badge key={label} variant="outline" className="text-xs">{label}</Badge>)}</div>
        <ul className="grid gap-1 text-sm text-muted-foreground" aria-label="Match reasons">{player.match.reasons.slice(0, 4).map((reason) => <li key={reason}>• {reason}</li>)}</ul>
        <div className="flex flex-wrap justify-end gap-2">{connection.data === "not_connected" && <Button size="sm" variant="outline" disabled={connection.send.isPending} onClick={() => connection.send.mutate()}><UserPlus className="mr-1 h-4 w-4" />Add friend</Button>}{connection.data === "outgoing_pending" && <Button size="sm" variant="secondary" disabled><Clock className="mr-1 h-4 w-4" />Pending</Button>}{connection.data === "incoming_pending" && <Badge variant="secondary">Request received</Badge>}{connection.data === "friends" && <Badge>Friends</Badge>}<SafetyActions targetProfileId={player.id} targetName={player.characterName} compact /><Button asChild size="sm" onClick={onOpen}><Link to={`/player/${player.id}`}>Open profile</Link></Button></div>
      </div>
    </CardContent>
  </Card>;
}
