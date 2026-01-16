import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { sendFriendRequest } from "@/integrations/supabase/friends";
import {
  Star,
  Users,
  Calendar,
  UserPlus,
  Check,
  Clock,
  Music,
  Mic,
  Zap,
} from "lucide-react";

interface MemberWithProfile {
  id: string;
  user_id: string | null;
  profiles: {
    user_id: string;
    display_name: string | null;
    username: string;
    avatar_url: string | null;
    level: number | null;
  } | null;
  instrument_role: string;
  vocal_role: string | null;
  role: string;
}

interface BandMemberDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberWithProfile | null;
  currentProfileId: string | null;
}

const SKILL_ICONS: Record<string, React.ReactNode> = {
  vocals: <Mic className="h-4 w-4" />,
  guitar: <Music className="h-4 w-4" />,
  bass: <Music className="h-4 w-4" />,
  drums: <Music className="h-4 w-4" />,
  songwriting: <Music className="h-4 w-4" />,
  performance: <Zap className="h-4 w-4" />,
};

export function BandMemberDetailDialog({
  open,
  onOpenChange,
  member,
  currentProfileId,
}: BandMemberDetailDialogProps) {
  const { toast } = useToast();
  const [sendingRequest, setSendingRequest] = useState(false);

  const userId = member?.user_id ?? member?.profiles?.user_id;

  // Fetch full profile with city name
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["member-profile-detail", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, cities(name)")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && Boolean(userId),
  });

  // Fetch skills
  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ["member-skills", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("skill_progress")
        .select("skill_slug, current_level, current_xp")
        .eq("profile_id", profile.id)
        .order("current_level", { ascending: false })
        .limit(6);

      if (error) throw error;
      return data ?? [];
    },
    enabled: open && Boolean(profile?.id),
  });

  // Fetch today's schedule
  const { data: schedule } = useQuery({
    queryKey: ["member-schedule", userId],
    queryFn: async () => {
      if (!userId) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("player_scheduled_activities")
        .select("id, activity_type, scheduled_start, scheduled_end")
        .eq("user_id", userId)
        .gte("scheduled_start", today.toISOString())
        .lt("scheduled_start", tomorrow.toISOString())
        .order("scheduled_start", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data ?? [];
    },
    enabled: open && Boolean(userId),
  });

  // Check friendship status
  const { data: friendshipStatus, refetch: refetchFriendship } = useQuery({
    queryKey: ["friendship-status", currentProfileId, profile?.id],
    queryFn: async () => {
      if (!currentProfileId || !profile?.id) return null;
      if (currentProfileId === profile.id) return { isSelf: true, status: null, id: null };

      const { data, error } = await supabase
        .from("friendships")
        .select("id, status")
        .or(
          `and(requestor_id.eq.${currentProfileId},addressee_id.eq.${profile.id}),and(requestor_id.eq.${profile.id},addressee_id.eq.${currentProfileId})`
        )
        .maybeSingle();

      if (error) throw error;
      return data ? { ...data, isSelf: false } : { isSelf: false, status: null, id: null };
    },
    enabled: open && Boolean(currentProfileId) && Boolean(profile?.id),
  });

  const handleSendFriendRequest = async () => {
    if (!currentProfileId || !profile?.id) return;

    setSendingRequest(true);
    try {
      await sendFriendRequest({
        requestorProfileId: currentProfileId,
        addresseeProfileId: profile.id,
      });
      toast({
        title: "Friend request sent!",
        description: `Request sent to ${profile.display_name || profile.username}`,
      });
      refetchFriendship();
    } catch (error) {
      toast({
        title: "Failed to send request",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatSkillName = (slug: string) => {
    return slug
      .replace(/_/g, " ")
      .replace(/instruments basic /g, "")
      .replace(/instruments advanced /g, "")
      .replace(/^./, (c) => c.toUpperCase());
  };

  const displayName =
    profile?.display_name ||
    member?.profiles?.display_name ||
    profile?.username ||
    member?.profiles?.username ||
    "Unknown";

  const isSelf = friendshipStatus?.isSelf;
  const isFriend = friendshipStatus?.status === "accepted";
  const isPending = friendshipStatus?.status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Member Details</DialogTitle>
        </DialogHeader>

        {/* Profile Header */}
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage
              src={profile?.avatar_url ?? member?.profiles?.avatar_url ?? undefined}
              alt={displayName}
            />
            <AvatarFallback className="text-lg">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{displayName}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                Level {profile?.level ?? member?.profiles?.level ?? 1}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                Fame {profile?.fame?.toLocaleString() ?? 0}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {profile?.fans?.toLocaleString() ?? 0} fans
              </span>
            </div>
            {(profile as any)?.cities?.name && (
              <p className="text-sm text-muted-foreground mt-1">
                📍 {(profile as any).cities.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">
            {member?.instrument_role || member?.vocal_role || member?.role}
          </Badge>
        </div>

        <Separator />

        {/* Skills Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            {skillsLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : skills && skills.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {skills.map((skill) => (
                  <div
                    key={skill.skill_slug}
                    className="flex flex-col items-center p-3 rounded-lg bg-muted/50 text-center"
                  >
                    {SKILL_ICONS[skill.skill_slug.split("_").pop() ?? ""] ?? (
                      <Music className="h-4 w-4" />
                    )}
                    <span className="text-xs text-muted-foreground mt-1 truncate w-full">
                      {formatSkillName(skill.skill_slug)}
                    </span>
                    <span className="text-lg font-bold">{skill.current_level}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No skills data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Schedule Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schedule && schedule.length > 0 ? (
              <div className="space-y-2">
                {schedule.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.activity_type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(activity.scheduled_start)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activities scheduled today
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isSelf ? (
            <Button variant="outline" className="flex-1" disabled>
              This is you
            </Button>
          ) : isFriend ? (
            <Button variant="outline" className="flex-1" disabled>
              <Check className="mr-2 h-4 w-4" />
              Already friends
            </Button>
          ) : isPending ? (
            <Button variant="outline" className="flex-1" disabled>
              <Clock className="mr-2 h-4 w-4" />
              Request pending
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={handleSendFriendRequest}
              disabled={sendingRequest || !currentProfileId}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {sendingRequest ? "Sending..." : "Send Friend Request"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
