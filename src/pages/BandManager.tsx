import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { BandCreationForm } from "@/components/band/BandCreationForm";
import { BandOverview } from "@/components/band/BandOverview";
import { BandMemberCard } from "@/components/band/BandMemberCard";
import { AddTouringMember } from "@/components/band/AddTouringMember";
import { ChemistryDisplay } from "@/components/band/ChemistryDisplay";
import { BandChat } from "@/components/band/BandChat";
import { BandEarnings } from "@/components/band/BandEarnings";
import { BandFinancesTab } from "@/components/bands/BandFinancesTab";
import { BandRosterTab } from "@/components/bands/BandRosterTab";
import { InviteFriendToBand } from "@/components/band/InviteFriendToBand";
import { BandSettingsTab } from "@/components/band/BandSettingsTab";
import { BandStatusBanner } from "@/components/band/BandStatusBanner";
import { BandApplicationsList } from "@/components/band/BandApplicationsList";
import { BandInvitations } from "@/components/band/BandInvitations";

import { GigHistoryTab } from "@/components/band/GigHistoryTab";
import { BandRepertoireTab } from "@/components/band/BandRepertoireTab";
import { FameFansOverview } from "@/components/fame/FameFansOverview";
import {
  Calendar,
  DollarSign,
  History,
  Mic2,
  Package,
  Plus,
  Settings,
  Users,
  Music,
  Star,
  Library,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserBands } from "@/utils/bandStatus";
import { reactivateBand } from "@/utils/bandHiatus";
import { getBandStatusLabel, getBandStatusColor } from "@/utils/bandStatus";
import { useAutoGigExecution } from "@/hooks/useAutoGigExecution";
import HubLayout from "@/components/hub/HubLayout";
import { bandHubNavigation } from "@/config/hubNavigation";
import { PageLoadingState } from "@/components/ui/page-state";

export default function BandManager() {
  const { profileId, userId } = useActiveProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [userBands, setUserBands] = useState<any[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Enable auto-gig execution for the selected band
  useAutoGigExecution(selectedBandId);

  useEffect(() => {
    if (profileId) {
      loadUserBands();
    }
  }, [profileId]);

  useEffect(() => {
    if (selectedBandId) {
      loadBandDetails(selectedBandId);
    }
  }, [selectedBandId]);

  const loadUserBands = async () => {
    if (!profileId) return;

    try {
      const bands = await getUserBands(profileId);

      // Filter out disbanded bands
      const activeBands = bands.filter(
        (b: any) => b.bands.status !== "disbanded",
      );
      setUserBands(activeBands);

      // Auto-select first active band, or first hiatus band
      const activeFirst = activeBands.find(
        (b: any) => b.bands.status === "active",
      );
      const defaultBand = activeFirst || activeBands[0];

      if (defaultBand) {
        setSelectedBandId(defaultBand.band_id);
      }
    } catch (error) {
      console.error("Error loading bands:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBandDetails = async (bandId: string) => {
    try {
      // Load band data
      const { data: band } = await supabase
        .from("bands")
        .select("*")
        .eq("id", bandId)
        .single();

      if (band) {
        setSelectedBand(band);
        await loadBandMembers(bandId);
      }
    } catch (error) {
      console.error("Error loading band details:", error);
    }
  };

  const loadBandMembers = async (bandId: string) => {
    // First get all band members (including touring members with null user_id)
    const { data: bandMembersData } = await supabase
      .from("band_members")
      .select("*")
      .eq("band_id", bandId)
      .order("joined_at", { ascending: true });

    if (!bandMembersData) {
      setMembers([]);
      return;
    }

    // Get profile_ids that are not null (use profile_id to get the correct character)
    const profileIds = bandMembersData
      .map((m) => m.profile_id)
      .filter((id): id is string => id !== null);

    // Fetch profiles for human members only
    let profilesData: any[] = [];
    if (profileIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, username")
        .in("id", profileIds);
      profilesData = data || [];
    }

    // Attach profile data to members using profile_id
    const membersWithProfiles = bandMembersData.map((member) => {
      if (member.profile_id) {
        const profile = profilesData.find((p) => p.id === member.profile_id);
        return { ...member, profiles: profile || null };
      }
      return { ...member, profiles: null };
    });

    setMembers(membersWithProfiles);
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("band_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Member Removed",
        description: "The band member has been removed",
      });

      if (selectedBandId) {
        await loadBandMembers(selectedBandId);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleReactivate = async () => {
    if (!profileId || !selectedBandId) return;

    try {
      const result = await reactivateBand(selectedBandId, profileId);

      if (result.success) {
        toast({
          title: "Band Reactivated",
          description: "Your band is now active again",
        });
        await loadUserBands();
      } else if (result.conflicts && result.conflicts.length > 0) {
        toast({
          title: "Conflicts Detected",
          description: `${result.conflicts.length} member(s) need to resolve conflicts with other bands`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate band",
        variant: "destructive",
      });
    }
  };

  const activeSection = (() => {
    const path = location.pathname;
    if (path.endsWith("/members")) return "members";
    if (path.endsWith("/fame")) return "fame";
    if (path.endsWith("/repertoire")) return "repertoire";
    if (path.endsWith("/history")) return "history";
    if (path.endsWith("/finances")) return "finances";
    if (path.endsWith("/chemistry")) return "chemistry";
    if (path.endsWith("/settings")) return "settings";
    return "overview";
  })();

  const selectSection = (section: string) => {
    const target = section === "overview" ? "/band" : `/band/${section}`;
    if (location.pathname !== target) navigate(target);
  };

  if (loading) {
    return (
      <HubLayout
        title="Band"
        description="Manage your band, preparation and live performance workflow."
        icon={Users}
        overviewPath="/band"
        navigation={bandHubNavigation}
      >
        <PageLoadingState
          title="Loading Band"
          description="Finding your active band and membership details."
        />
      </HubLayout>
    );
  }

  if (!selectedBand || userBands.length === 0) {
    return (
      <HubLayout
        title="Band"
        description="Create a band, review invitations or find musicians before managing rehearsals and gigs."
        icon={Users}
        overviewPath="/band"
        navigation={bandHubNavigation}
        actions={[
          {
            label: "Browse bands",
            path: "/bands/browse",
            icon: Users,
            variant: "outline",
          },
          {
            label: "Find musicians",
            path: "/bands/finder",
            icon: Plus,
            variant: "outline",
          },
        ]}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>No active band yet</CardTitle>
              <CardDescription>
                Create a band, browse existing bands or respond to invitations
                to unlock band management.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/bands/browse">Browse bands</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/bands/finder">Find musicians</Link>
              </Button>
            </CardContent>
          </Card>
          <BandInvitations />
          <div className="lg:col-span-2">
            <BandCreationForm onBandCreated={loadUserBands} />
          </div>
        </div>
      </HubLayout>
    );
  }

  const currentMembership = selectedBand
    ? userBands.find((band) => band.band_id === selectedBand.id)
    : undefined;

  const isLeader = Boolean(
    (profileId && selectedBand.leader_id === profileId) ||
    (userId && selectedBand.leader_id === userId) ||
    currentMembership?.role === "leader" ||
    (profileId && currentMembership?.bands?.leader_id === profileId) ||
    (userId && currentMembership?.bands?.leader_id === userId),
  );

  const bandTitle = selectedBand.is_solo_artist
    ? selectedBand.artist_name || selectedBand.name
    : selectedBand.name;
  const hubActions = [
    {
      label: "Invite member",
      path: "/band/members",
      icon: Plus,
      variant: "outline" as const,
    },
    {
      label: "Schedule rehearsal",
      path: "/band/rehearsals",
      icon: Mic2,
      variant: "outline" as const,
    },
    {
      label: "Prepare gig",
      path: "/band/gigs",
      icon: Zap,
      variant: "secondary" as const,
    },
  ];

  return (
    <HubLayout
      title={bandTitle}
      description={`${selectedBand.genre || "Genre unset"} • ${selectedBand.is_solo_artist ? "Solo Artist" : "Band"}`}
      icon={Music}
      overviewPath="/band"
      navigation={bandHubNavigation}
      actions={hubActions}
      breadcrumbs={[{ label: "Band", path: "/band" }, { label: bandTitle }]}
      status={
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/70 p-3">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={selectedBand.logo_url} alt={selectedBand.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {selectedBand.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{bandTitle}</p>
            <p className="text-sm text-muted-foreground">
              {members.length} of {selectedBand.max_members} members •{" "}
              {selectedBand.status}
            </p>
          </div>
          {userBands.length > 1 && (
            <Select
              value={selectedBandId || ""}
              onValueChange={setSelectedBandId}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {userBands.map((band) => (
                  <SelectItem key={band.band_id} value={band.band_id}>
                    {band.bands.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      }
    >
      <div className="mb-6 space-y-4">
        {/* Status Banner for Hiatus */}
        <BandStatusBanner
          status={selectedBand.status}
          hiatusStartedAt={selectedBand.hiatus_started_at}
          hiatusEndsAt={selectedBand.hiatus_ends_at}
          hiatusReason={selectedBand.hiatus_reason}
          isLeader={isLeader}
          onReactivate={handleReactivate}
        />
      </div>

      <Tabs
        value={activeSection}
        onValueChange={selectSection}
        className="space-y-6"
      >
        <TabsList className="h-auto flex flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="chat" className="text-xs sm:text-sm">
            Chat
          </TabsTrigger>
          <TabsTrigger value="earnings" className="text-xs sm:text-sm">
            Earnings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <BandOverview
            bandId={selectedBand.id}
            isLeader={isLeader}
            logoUrl={selectedBand.logo_url}
            soundDescription={selectedBand.sound_description}
            bandName={selectedBand.name}
            onBandUpdate={() => loadBandDetails(selectedBand.id)}
          />
        </TabsContent>

        <TabsContent value="fame" className="space-y-4">
          <FameFansOverview bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <BandInvitations />

          {/* Pending Applications (Leader only) */}
          {isLeader && selectedBand.status === "active" && (
            <BandApplicationsList
              bandId={selectedBand.id}
              onMemberAdded={() => loadBandMembers(selectedBand.id)}
            />
          )}

          <BandRosterTab bandId={selectedBand.id} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Band Members</CardTitle>
                  <CardDescription>
                    {members.length} of {selectedBand.max_members} members
                  </CardDescription>
                </div>
                {isLeader && selectedBand.status === "active" && (
                  <div className="flex gap-2">
                    <InviteFriendToBand
                      bandId={selectedBand.id}
                      bandName={selectedBand.name}
                      currentUserId={profileId!}
                    />
                    <AddTouringMember
                      bandId={selectedBand.id}
                      onAdded={() => loadBandMembers(selectedBand.id)}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map((member) => (
                <BandMemberCard
                  key={member.id}
                  member={member}
                  isLeader={member.role === "leader"}
                  canManage={isLeader && selectedBand.status === "active"}
                  onRemove={
                    isLeader &&
                    member.role !== "leader" &&
                    selectedBand.status === "active"
                      ? () => handleRemoveMember(member.id)
                      : undefined
                  }
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repertoire" className="space-y-4">
          <BandRepertoireTab
            bandId={selectedBand.id}
            bandName={selectedBand.name}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <GigHistoryTab bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <BandChat bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="earnings" className="space-y-4">
          <BandEarnings bandId={selectedBand.id} isLeader={isLeader} />
        </TabsContent>

        <TabsContent value="finances" className="space-y-4">
          <BandFinancesTab bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="chemistry" className="space-y-4">
          <ChemistryDisplay bandId={selectedBand.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <BandSettingsTab
            bandId={selectedBand.id}
            isLeader={isLeader}
            bandStatus={selectedBand.status}
            isSoloArtist={selectedBand.is_solo_artist}
            isRecruiting={selectedBand.is_recruiting}
            allowApplications={selectedBand.allow_applications ?? true}
            primaryGenre={selectedBand.primary_genre}
            secondaryGenres={selectedBand.secondary_genres}
            genreLastChangedAt={selectedBand.genre_last_changed_at}
            onBandUpdate={loadUserBands}
          />
        </TabsContent>
      </Tabs>
    </HubLayout>
  );
}
