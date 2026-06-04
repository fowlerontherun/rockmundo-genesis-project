import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Mail, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-context";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function CharacterUnreadWidget() {
  const { user } = useAuth();
  const { characters, switchCharacter } = useCharacterSlots();
  const { toast } = useToast();

  const characterIds = characters.map((c) => c.id);

  const { data: inboxCounts } = useQuery({
    queryKey: ["per-character-inbox-unread", user?.id, characterIds.join(",")],
    enabled: !!user?.id && characters.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      let sharedCount = 0;
      const { data, error } = await supabase
        .from("player_inbox")
        .select("metadata")
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .eq("is_archived", false);
      if (error) throw error;
      (data ?? []).forEach((row: any) => {
        const pid = row?.metadata?.profile_id as string | undefined;
        if (!pid) {
          sharedCount += 1;
        } else {
          counts[pid] = (counts[pid] || 0) + 1;
        }
      });
      return { perCharacter: counts, shared: sharedCount };
    },
  });

  const { data: dmCounts } = useQuery({
    queryKey: ["per-character-dm-unread", characterIds.join(",")],
    enabled: characterIds.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const { data, error } = await (supabase as any)
        .from("direct_messages")
        .select("recipient_profile_id")
        .in("recipient_profile_id", characterIds)
        .is("read_at", null);
      if (error) throw error;
      (data ?? []).forEach((row: any) => {
        const pid = row?.recipient_profile_id;
        if (pid) counts[pid] = (counts[pid] || 0) + 1;
      });
      return counts;
    },
  });

  if (characters.length <= 1) return null;

  const handleSwitch = async (profileId: string, isActive: boolean) => {
    if (isActive) return;
    try {
      await switchCharacter.mutateAsync(profileId);
      toast({ title: "Switching character", description: "Reloading..." });
      window.location.reload();
    } catch {
      toast({ title: "Error", description: "Failed to switch character", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Unread by character
          {inboxCounts && inboxCounts.shared > 0 && (
            <Badge variant="outline" className="text-[10px] ml-auto">
              {inboxCounts.shared} shared
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {characters.map((char) => {
          const inbox = inboxCounts?.perCharacter[char.id] || 0;
          const dm = dmCounts?.[char.id] || 0;
          const total = inbox + dm;
          return (
            <div
              key={char.id}
              className="flex items-center gap-2 p-2 rounded-md border bg-card/50 hover:bg-accent/50 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={char.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {(char.display_name || char.username || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">
                    {char.display_name || char.username || "Unnamed"}
                  </span>
                  {char.is_active && (
                    <Badge className="text-[9px] px-1 py-0 bg-primary/20 text-primary border-primary/30">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Mail className="h-2.5 w-2.5" />
                    {inbox}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {dm}
                  </span>
                </div>
              </div>
              {total > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5 min-w-[20px] flex items-center justify-center">
                  {total > 99 ? "99+" : total}
                </Badge>
              )}
              {char.is_active ? (
                <Button size="sm" variant="ghost" asChild className="h-7 text-xs">
                  <Link to="/inbox">Open</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleSwitch(char.id, false)}
                  disabled={switchCharacter.isPending}
                >
                  Switch
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
