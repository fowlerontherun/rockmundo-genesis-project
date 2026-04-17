import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { usePartyMembers } from "@/hooks/useParties";
import { Crown, Star, User } from "lucide-react";

const roleIcon = {
  founder: Crown,
  officer: Star,
  member: User,
};

export function PartyMembersTab({ partyId }: { partyId: string }) {
  const { data: members, isLoading } = usePartyMembers(partyId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading members…</p>;
  if (!members || members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((m) => {
          const Icon = roleIcon[m.role as keyof typeof roleIcon] ?? User;
          const profile = (m as any).profile;
          return (
            <div key={m.id} className="flex items-center justify-between p-2 rounded-md border border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{(profile?.display_name ?? "?").slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{profile?.display_name ?? profile?.username ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                <Icon className="h-3 w-3 mr-1" />
                {m.role}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
