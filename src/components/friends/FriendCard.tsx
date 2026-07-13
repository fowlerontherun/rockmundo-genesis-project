import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Users } from "lucide-react";
import type { FriendSummary } from "@/integrations/supabase/playerConnections";

export function FriendCard({ friend, context, disabled, onAccept, onDecline, onCancel, onRemove, onAdd }: { friend: FriendSummary; context: "friend" | "incoming" | "outgoing" | "suggestion"; disabled?: boolean; onAccept?: () => void; onDecline?: () => void; onCancel?: () => void; onRemove?: () => void; onAdd?: () => void }) {
  return <Card aria-label={`${friend.characterName} friendship card`}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3"><Avatar><AvatarImage src={friend.avatarUrl ?? undefined} /><AvatarFallback><User className="h-5 w-5" /></AvatarFallback></Avatar><div className="min-w-0"><Link to={`/player/${friend.id}`} className="font-semibold hover:underline">{friend.characterName}</Link><p className="text-sm text-muted-foreground">{[friend.bandName, friend.primaryRole, friend.cityName].filter(Boolean).join(" • ") || "Public profile summary"}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline"><Users className="mr-1 h-3 w-3" />{friend.mutualFriendCount} mutual friends</Badge>{friend.friendshipDate && <Badge variant="secondary">Friends since {new Date(friend.friendshipDate).toLocaleDateString()}</Badge>}</div></div></div>
    <div className="flex flex-wrap gap-2 sm:justify-end"><Button asChild variant="outline" size="sm"><Link to={`/player/${friend.id}`}>Open profile</Link></Button>{context === "incoming" && <><Button size="sm" disabled={disabled} onClick={onAccept}>Accept</Button><Button size="sm" variant="outline" disabled={disabled} onClick={onDecline}>Decline</Button></>}{context === "outgoing" && <Button size="sm" variant="outline" disabled={disabled} onClick={onCancel}>Cancel request</Button>}{context === "friend" && <Button size="sm" variant="destructive" disabled={disabled} onClick={onRemove}>Remove friend</Button>}{context === "suggestion" && <Button size="sm" disabled={disabled} onClick={onAdd}>Add friend</Button>}</div>
  </CardContent></Card>;
}
