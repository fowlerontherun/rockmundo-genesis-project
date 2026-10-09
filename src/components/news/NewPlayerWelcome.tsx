import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePlayerConnection } from "@/hooks/usePlayerConnections";
import { useSocialPermission } from "@/hooks/useSocialSafety";

export function NewPlayerWelcome({ playerId, name }: { playerId: string; name: string }) {
  const { profileId } = useActiveProfile();
  const connection = usePlayerConnection(playerId);
  const permission = useSocialPermission(playerId);
  const isSelf = profileId === playerId;
  const restricted = permission.data?.is_interaction_restricted || permission.data?.can_send_friend_request === false;
  const state = connection.data;

  return (
    <article className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 text-sm last:border-0">
      <Link className="font-semibold text-primary hover:underline" to={`/player/${playerId}`}>{name}</Link>
      {isSelf ? <span className="text-xs text-muted-foreground">That's you!</span>
        : (state === "friends") ? <Button asChild size="sm" variant="outline"><Link to={`/social/messages?friend=${playerId}`}>Say hi · Message</Link></Button>
        : (state === "outgoing_pending") ? <span className="text-xs text-muted-foreground">Greeting request sent</span>
        : (state === "incoming_pending") ? <Button asChild size="sm" variant="outline"><Link to={`/player/${playerId}`}>Respond to request</Link></Button>
        : (state === "not_connected" && !restricted) ?
          <Button size="sm" variant="outline" disabled={!profileId || connection.send.isPending || connection.isLoading || permission.isLoading} onClick={() => connection.send.mutate()}>
            {connection.send.isPending ? "Sending…" : "Welcome · Connect"}
          </Button>
        : <Link className="text-xs text-primary underline" to={`/player/${playerId}`}>View player</Link>}
    </article>
  );
}
