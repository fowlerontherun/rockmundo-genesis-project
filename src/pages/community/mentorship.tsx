import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import { GoalTracker } from "@/components/community";
import type { MentorshipGoal, GoalCheckIn } from "@/components/community";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Search,
  Users,
  Clock,
  Sparkles,
  Target,
  ArrowRight,
  Handshake,
} from "lucide-react";

const EXPERIENCE_LABELS: Record<string, string> = {
  emerging: "Emerging guide",
  intermediate: "Seasoned strategist",
  advanced: "Expert mentor",
  veteran: "Legendary architect",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  open: "Open to new mentees",
  limited: "Limited slots",
  waitlist: "Join the waitlist",
  closed: "Currently full",
};

const MATCH_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  active: "default",
  paused: "outline",
  completed: "outline",
  declined: "destructive",
};

const MATCH_STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: "Awaiting mentor confirmation",
  active: "Weekly cadence locked in",
  paused: "Temporarily on hold",
  completed: "Goal arc completed",
  declined: "Request declined",
};

const EXPERIENCE_FILTERS = [
  { value: "all", label: "All experience" },
  { value: "emerging", label: "Emerging" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "veteran", label: "Veteran" },
];

const AVAILABILITY_FILTERS = [
  { value: "all", label: "Any availability" },
  { value: "open", label: "Open" },
  { value: "limited", label: "Limited" },
  { value: "waitlist", label: "Waitlist" },
  { value: "closed", label: "Closed" },
];

type MentorshipProfileRow = Database["public"]["Tables"]["community_mentorship_profiles"]["Row"];
type MentorshipMatchRow = Database["public"]["Tables"]["community_mentorship_matches"]["Row"];
type MentorshipGoalRow = Database["public"]["Tables"]["community_mentorship_goals"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type MentorshipProfileWithProfile = MentorshipProfileRow & {
  profile?: Pick<ProfileRow, "id" | "display_name" | "username" | "avatar_url" | "bio" | "current_city_id">;
};

type MentorshipMatchWithProfiles = MentorshipMatchRow & {
  mentor_profile?: Pick<ProfileRow, "id" | "display_name" | "username" | "avatar_url">;
  mentee_profile?: Pick<ProfileRow, "id" | "display_name" | "username" | "avatar_url">;
};

function parseMetrics(metrics: MentorshipGoalRow["metrics"]): MentorshipGoal["metrics"] {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return undefined;
  }

  const entries = Object.entries(metrics as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .slice(0, 6);

  if (entries.length === 0) {
    return undefined;
  }

  return entries.reduce<Record<string, number | string>>((acc, [key, value]) => {
    acc[key] = value as number | string;
    return acc;
  }, {});
}

function parseCheckIns(goal: MentorshipGoalRow): GoalCheckIn[] {
  const rawCheckIns = Array.isArray(goal.check_ins) ? (goal.check_ins as Array<Record<string, unknown>>) : [];

  const parsed = rawCheckIns
    .map((entry, index) => {
      const timestampCandidate =
        (typeof entry.timestamp === "string" && entry.timestamp) ||
        (typeof entry.date === "string" && entry.date) ||
        goal.last_check_in ||
        goal.updated_at;

      if (!timestampCandidate) {
        return null;
      }

      return {
        id: (typeof entry.id === "string" && entry.id) || `${goal.id}-check-${index}`,
        timestamp: timestampCandidate,
        progress: typeof entry.progress === "number" ? entry.progress : goal.progress ?? 0,
        note: typeof entry.note === "string" ? entry.note : undefined,
        sentiment: typeof entry.sentiment === "string" ? (entry.sentiment as GoalCheckIn["sentiment"]) : undefined,
      } satisfies GoalCheckIn;
    })
    .filter((item): item is GoalCheckIn => Boolean(item));

  return parsed.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export default function CommunityMentorshipPage() {
  const { profile } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [experienceFilter, setExperienceFilter] = useState<string>("all");
  const [focusFilter, setFocusFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("all");

  const { data: mentorshipProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["community_mentorship_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_mentorship_profiles")
        .select(
          "*, profile:profiles(id, display_name, username, avatar_url, bio, current_city_id)"
        )
        .eq("is_open_to_mentor", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MentorshipProfileWithProfile[];
    },
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ["community_mentorship_matches", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as MentorshipMatchWithProfiles[];

      const { data, error } = await supabase
        .from("community_mentorship_matches")
        .select(
          `*,
          mentor_profile:profiles!community_mentorship_matches_mentor_profile_id_fkey(id, display_name, username, avatar_url),
          mentee_profile:profiles!community_mentorship_matches_mentee_profile_id_fkey(id, display_name, username, avatar_url)`
        )
        .or(`mentor_profile_id.eq.${profile.id},mentee_profile_id.eq.${profile.id}`)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MentorshipMatchWithProfiles[];
    },
    enabled: Boolean(profile?.id),
  });

  const matchIds = useMemo(() => matches.map((match) => match.id), [matches]);

  const goalsQuery = useQuery({
    queryKey: ["community_mentorship_goals", matchIds.sort().join(",")],
    queryFn: async () => {
      if (matchIds.length === 0) return [] as MentorshipGoalRow[];
      const { data, error } = await supabase
        .from("community_mentorship_goals")
        .select("*")
        .in("match_id", matchIds);

      if (error) throw error;
      return (data ?? []) as MentorshipGoalRow[];
    },
    enabled: matchIds.length > 0,
  });

  const mentorshipGoals = useMemo<MentorshipGoal[]>(() => {
    if (!goalsQuery.data) return [];

    return goalsQuery.data.map((goal) => ({
      id: goal.id,
      matchId: goal.match_id,
      title: goal.title,
      description: goal.description,
      status: goal.status as MentorshipGoal["status"],
      progress: goal.progress ?? 0,
      targetDate: goal.target_date,
      focusAreas: goal.focus_areas ?? undefined,
      metrics: parseMetrics(goal.metrics),
      lastCheckIn: goal.last_check_in,
      checkIns: parseCheckIns(goal),
      supportNotes: goal.support_notes ?? null,
    }));
  }, [goalsQuery.data]);

  const focusOptions = useMemo(() => {
    const values = new Set<string>();
    mentorshipProfiles.forEach((mentor) => {
      (mentor.focus_areas ?? []).forEach((area) => values.add(area));
    });
    return Array.from(values).sort();
  }, [mentorshipProfiles]);

  const filteredMentors = useMemo(() => {
    return mentorshipProfiles
      .filter((mentor) => mentor.profile_id !== profile?.id)
      .filter((mentor) => {
        if (experienceFilter !== "all" && mentor.experience_level !== experienceFilter) return false;
        if (availabilityFilter !== "all" && mentor.availability_status !== availabilityFilter) return false;
        if (focusFilter !== "all") {
          const focusAreas = mentor.focus_areas ?? [];
          if (!focusAreas.some((area) => area.toLowerCase() === focusFilter.toLowerCase())) return false;
        }
        if (!searchTerm) return true;
        const needle = searchTerm.toLowerCase();
        const haystack = [
          mentor.headline ?? "",
          mentor.profile?.display_name ?? "",
          mentor.profile?.username ?? "",
          mentor.profile?.bio ?? "",
          ...(mentor.focus_areas ?? []),
          ...(mentor.support_topics ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
  }, [mentorshipProfiles, experienceFilter, availabilityFilter, focusFilter, searchTerm, profile?.id]);

  useEffect(() => {
    if (matches.length === 0) {
      setSelectedMatchId("all");
      return;
    }
    if (selectedMatchId === "all") {
      return;
    }
    if (matches.some((match) => match.id === selectedMatchId)) {
      return;
    }
    const preferredMatch = matches.find((match) => match.status === "active") ?? matches[0];
    setSelectedMatchId(preferredMatch?.id ?? "all");
  }, [matches, selectedMatchId]);

  const matchGoals = useMemo(() => {
    if (selectedMatchId === "all") return mentorshipGoals;
    return mentorshipGoals.filter((goal) => goal.matchId === selectedMatchId);
  }, [mentorshipGoals, selectedMatchId]);

  const availableMentors = filteredMentors.length;
  const activeMatches = matches.filter((match) => match.status === "active");
  const pendingMatches = matches.filter((match) => match.status === "pending");

  const requestMentorship = useMutation({
    mutationFn: async ({ mentorProfileId, focusAreas }: { mentorProfileId: string; focusAreas: string[] }) => {
      if (!profile?.id) throw new Error("You need a profile before requesting mentorship.");

      const { error } = await supabase.from("community_mentorship_matches").insert({
        mentor_profile_id: mentorProfileId,
        mentee_profile_id: profile.id,
        focus_areas: focusAreas,
        status: "pending",
        initiated_by_profile_id: profile.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Mentorship request sent",
        description: "We'll notify you when the mentor responds.",
      });
      queryClient.invalidateQueries({ queryKey: ["community_mentorship_matches", profile?.id] });
    },
    onError: (error) => {
      toast({
        title: "Unable to send request",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleRequestMentor = (mentor: MentorshipProfileWithProfile) => {
    if (!profile?.id) {
      toast({
        title: "Profile required",
        description: "Create your profile to request mentorship.",
        variant: "destructive",
      });
      return;
    }

    const existing = matches.find(
      (match) =>
        match.mentor_profile_id === mentor.profile_id &&
        match.mentee_profile_id === profile.id &&
        ["pending", "active"].includes(match.status),
    );

    if (existing) {
      toast({
        title: "Already connected",
        description: existing.status === "active" ? "You're already paired with this mentor." : "Request pending review.",
      });
      return;
    }

    requestMentorship.mutate({
      mentorProfileId: mentor.profile_id,
      focusAreas: mentor.focus_areas ?? [],
    });
  };

  const goalsLoading = goalsQuery.isLoading || goalsQuery.isFetching;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Mentorship Network</h1>
          <p className="max-w-2xl text-muted-foreground">
            Discover mentors shaping Rockmundo's creative acceleration loops, request pairings, and track shared goals as you level up together.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={Users}
          label="Open mentors"
          value={profilesLoading ? "--" : availableMentors}
          caption="Filtering by your focus preferences"
        />
        <SummaryCard
          icon={Sparkles}
          label="Active pairings"
          value={matchesLoading ? "--" : activeMatches.length}
          caption="Mentors collaborating right now"
        />
        <SummaryCard
          icon={Clock}
          label="Pending requests"
          value={matchesLoading ? "--" : pendingMatches.length}
          caption="Awaiting mentor response"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Mentorship goals</CardTitle>
          <CardDescription>Align on measurable arcs and celebrate the wins unlocked through your mentorship pod.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-xs">
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a pairing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pairings</SelectItem>
                  {matches.map((match) => {
                    const isMentor = match.mentor_profile_id === profile?.id;
                    const partner = isMentor ? match.mentee_profile : match.mentor_profile;
                    const partnerName = partner?.display_name || partner?.username || "Unknown";
                    return (
                      <SelectItem key={match.id} value={match.id}>
                        {partnerName} • {match.status}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {matchGoals.length} goals in view
            </Badge>
          </div>
          <GoalTracker goals={matchGoals} isLoading={goalsLoading} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr),minmax(0,1fr)]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Mentor directory</CardTitle>
                <CardDescription>Filter the community for mentors aligned with your craft, pace, and collaboration style.</CardDescription>
              </div>
              <Badge variant="secondary">{availableMentors} mentors</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name, focus, or vibe"
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Experience" />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={focusFilter} onValueChange={setFocusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Focus area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All focus areas</SelectItem>
                  {focusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {profilesLoading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMentors.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No mentors match your filters yet. Try expanding your focus or availability preferences.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredMentors.map((mentor) => {
                  const capacity = mentor.mentor_capacity ?? 0;
                  const activeCount = mentor.current_mentees ?? 0;
                  const experienceLabel = EXPERIENCE_LABELS[mentor.experience_level] ?? mentor.experience_level;
                  const availabilityLabel = AVAILABILITY_LABELS[mentor.availability_status] ?? mentor.availability_status;
                  const existing = matches.find(
                    (match) => match.mentor_profile_id === mentor.profile_id && match.mentee_profile_id === profile?.id,
                  );
                  const actionLabel = existing
                    ? existing.status === "active"
                      ? "Paired"
                      : existing.status === "pending"
                        ? "Requested"
                        : existing.status
                    : "Request pairing";
                  const disabled = Boolean(existing) || requestMentorship.isPending;

                  return (
                    <Card key={mentor.id} className="flex h-full flex-col border-muted">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={mentor.profile?.avatar_url ?? undefined} alt={mentor.profile?.display_name ?? mentor.profile?.username ?? "Mentor"} />
                            <AvatarFallback>
                              {(mentor.profile?.display_name ?? mentor.profile?.username ?? "M").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-lg font-semibold">
                                {mentor.profile?.display_name || mentor.profile?.username || "Mentor"}
                              </h3>
                              <Badge variant="outline" className="capitalize">
                                {experienceLabel}
                              </Badge>
                            </div>
                            {mentor.headline && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{mentor.headline}</p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{availabilityLabel}</Badge>
                          {capacity > 0 && (
                            <span>
                              {activeCount}/{capacity} mentees
                            </span>
                          )}
                          {mentor.timezone && <span>Timezone: {mentor.timezone}</span>}
                        </div>

                        {(mentor.focus_areas?.length ?? 0) > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground">Focus areas</p>
                            <div className="flex flex-wrap gap-2">
                              {mentor.focus_areas?.map((area) => (
                                <Badge key={area} variant="outline" className="capitalize">
                                  {area}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {(mentor.support_topics?.length ?? 0) > 0 && (
                          <div className="space-y-1 text-xs">
                            <p className="font-medium text-foreground">Support topics</p>
                            <p className="text-muted-foreground line-clamp-2">
                              {mentor.support_topics?.join(" • ")}
                            </p>
                          </div>
                        )}

                        <Button
                          className="mt-auto"
                          variant={existing ? "secondary" : "default"}
                          disabled={disabled}
                          onClick={() => handleRequestMentor(mentor)}
                        >
                          {requestMentorship.isPending && !existing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Handshake className="mr-2 h-4 w-4" />
                          )}
                          {actionLabel}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader>
            <CardTitle>Your mentorship pairings</CardTitle>
            <CardDescription>Track the relationships powering your growth.</CardDescription>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : matches.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No mentorship pairings yet. Explore the directory to request your first mentor.
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-4">
                <div className="space-y-4">
                  {matches.map((match) => {
                    const isMentor = match.mentor_profile_id === profile?.id;
                    const partner = isMentor ? match.mentee_profile : match.mentor_profile;
                    const partnerName = partner?.display_name || partner?.username || "Unknown";
                    const statusVariant = MATCH_BADGE_VARIANT[match.status] ?? "outline";
                    const statusDescription = MATCH_STATUS_DESCRIPTIONS[match.status] ?? "";
                    const updatedAtLabel = formatDistanceToNow(new Date(match.updated_at ?? match.created_at), {
                      addSuffix: true,
                    });
                    const isSelected = selectedMatchId === match.id;

                    return (
                      <div key={match.id} className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={partner?.avatar_url ?? undefined} alt={partnerName} />
                              <AvatarFallback>{partnerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{partnerName}</p>
                                <Badge variant={statusVariant} className="capitalize">
                                  {match.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{statusDescription}</p>
                              {match.focus_areas && match.focus_areas.length > 0 && (
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {match.focus_areas.map((area) => (
                                    <Badge key={area} variant="outline" className="capitalize">
                                      {area}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">Updated {updatedAtLabel}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "ghost"}
                            onClick={() => setSelectedMatchId(match.id)}
                          >
                            View goals
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: typeof Users;
  label: string;
  value: number | string;
  caption: string;
}

function SummaryCard({ icon: Icon, label, value, caption }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}
