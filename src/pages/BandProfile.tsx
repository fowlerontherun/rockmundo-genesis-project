import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, TrendingUp, Music, User } from "lucide-react";
import { format } from "date-fns";
import { BandSongsSection } from "@/components/band/BandSongsSection";
import { BandApplicationDialog } from "@/components/band/BandApplicationDialog";
import { withdrawBandApplication } from "@/services/bandApplications";
import { getRecruitmentStatusMeta } from "@/lib/recruitmentStatus";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function BandProfile() {
  const { t } = useTranslation();
  const { bandId } = useParams();
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submittedApplication, setSubmittedApplication] = useState<any | null>(null);

  const { data: band, isLoading } = useQuery({
    queryKey: ["band-profile", bandId],
    queryFn: async () => {
      if (!bandId) throw new Error("No band ID");

      const { data, error } = await supabase
        .from("bands")
        .select(`
          id,
          name,
          genre,
          description,
          fame,
          chemistry_level,
          cohesion_score,
          created_at,
          logo_url,
          is_recruiting,
          band_members:band_members!band_members_band_id_fkey(
            id,
            instrument_role,
            vocal_role,
            role,
            joined_at,
            is_touring_member,
            profile_id,
            profiles:profile_id(
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq("id", bandId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  // Check if user is already a member
  const isMember = band?.band_members?.some(
    (m: any) => m.profile_id === profileId
  );

  // Check if user already applied
  const { data: applicationHistory, isLoading: isApplicationHistoryLoading, isError: isApplicationHistoryError } = useQuery({
    queryKey: ["band-application-history", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("band_applications")
        .select("id, status, created_at, responded_at, instrument_role, vocal_role, band_id, bands:band_id(id, name)")
        .eq("applicant_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profileId,
  });

  const { data: existingApplication } = useQuery({
    queryKey: ["band-application", bandId, profileId],
    queryFn: async () => {
      if (!bandId || !profileId) return null;
      const { data } = await supabase
        .from("band_applications")
        .select("id, status, created_at, instrument_role, vocal_role, responded_at")
        .eq("band_id", bandId)
        .eq("applicant_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!bandId && !!profileId,
  });

  const withdrawMutation = useMutation({
    mutationFn: async (applicationId: string) => withdrawBandApplication(applicationId),
    onSuccess: (application) => {
      setSubmittedApplication(application);
      toast({ title: "Application withdrawn", description: `Your application has been withdrawn.` });
      queryClient.invalidateQueries({ queryKey: ["band-application", bandId, profileId] });
      queryClient.invalidateQueries({ queryKey: ["band-profile", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band-applications", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band-application-history", profileId] });
    },
    onError: (error: any) => {
      toast({ title: "Unable to withdraw application", description: error?.message || "Try again or refresh before withdrawing.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <FMPageScaffold title="Band Profile" icon={Users} backTo="/hub/band">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading band...</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (!band) {
    return (
      <FMPageScaffold title="Band Profile" icon={Users} backTo="/hub/band">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Band not found.</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const activeApplication = submittedApplication || existingApplication;
  const activeApplicationStatus = getRecruitmentStatusMeta(activeApplication?.status);
  const canApply = band.is_recruiting && !isMember && (!activeApplication || activeApplication.status === "withdrawn" || activeApplication.status === "rejected") && profileId;


  return (
    <FMPageScaffold title={band.name} subtitle={band.genre || undefined} icon={Users} backTo="/hub/band">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {band.logo_url ? (
              <img
                src={band.logo_url}
                alt={band.name}
                className="h-24 w-24 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted">
                <Music className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{band.name}</h1>
                {band.genre && <Badge variant="secondary">{band.genre}</Badge>}
                {band.is_recruiting && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Recruiting
                  </Badge>
                )}
              </div>

              {band.description && (
                <p className="text-sm">{band.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>{band.fame || 0} Fame</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{band.chemistry_level || 0} Chemistry</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Cohesion:</span>
                  <span>{band.cohesion_score || 0}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {band.created_at && `Formed ${format(new Date(band.created_at), "MMMM yyyy")}`}
                </p>
                {/* Apply button */}
                {canApply && (
                  <BandApplicationDialog
                    bandId={band.id}
                    bandName={band.name}
                    profileId={profileId!}
                    onSubmitted={(application) => setSubmittedApplication(application)}
                  />
                )}
                {activeApplication && (
                  <div className="w-full rounded-lg border bg-muted/30 p-3 sm:max-w-md" aria-live="polite">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">Application to {band.name}</span>
                          <Badge variant={activeApplicationStatus.badgeVariant}>
                            {activeApplicationStatus.label}
                          </Badge>
                        </div>
                        <p>Submitted {activeApplication.created_at ? format(new Date(activeApplication.created_at), "MMM d, yyyy") : "recently"}</p>
                        <p>Requested role: {activeApplication.instrument_role || "Not specified"}{activeApplication.vocal_role ? ` / ${activeApplication.vocal_role}` : ""}</p>
                      </div>
                      {activeApplication.status === 'pending' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="shrink-0 text-destructive" disabled={withdrawMutation.isPending}>
                              {withdrawMutation.isPending ? "Withdrawing..." : "Withdraw application"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Withdraw application?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This withdraws your pending application to {band.name}. It does not guarantee an immediate future reapplication if cooldown rules are introduced later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={withdrawMutation.isPending}>Keep application</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => withdrawMutation.mutate(activeApplication.id)}
                                disabled={withdrawMutation.isPending}
                              >
                                Withdraw application
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Band Members ({band.band_members?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!band.band_members || band.band_members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <div className="space-y-4">
              {band.band_members.map((member: any, idx: number) => (
                <div key={member.id}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profiles?.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {member.is_touring_member 
                            ? `${member.instrument_role} Player (Touring)` 
                            : (member.profiles?.display_name || member.profiles?.username || "Unknown")}
                        </span>
                        <Badge variant={member.role === "leader" ? "default" : "outline"}>
                          {member.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.instrument_role}
                        {member.vocal_role && ` / ${member.vocal_role}`}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {member.joined_at ? `Joined ${format(new Date(member.joined_at), "MMM yyyy")}` : ''}
                    </div>
                  </div>
                  {idx < band.band_members.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {profileId && (
        <Card>
          <CardHeader>
            <CardTitle>My Application History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isApplicationHistoryLoading ? (
              <p className="text-sm text-muted-foreground">Loading your recruitment history...</p>
            ) : isApplicationHistoryError ? (
              <p className="text-sm text-destructive">Your recruitment history could not be loaded.</p>
            ) : !applicationHistory || applicationHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have not applied to any bands yet.</p>
            ) : (
              applicationHistory.map((application: any) => {
                const status = getRecruitmentStatusMeta(application.status);
                const bandName = application.bands?.name || "Unknown band";
                return (
                  <div key={application.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="link" className="h-auto p-0 font-semibold" onClick={() => navigate(`/bands/${application.band_id}`)}>
                          {bandName}
                        </Button>
                        <Badge variant={status.badgeVariant}>{status.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Requested role: {application.instrument_role || "Not specified"}{application.vocal_role ? ` / ${application.vocal_role}` : ""}</p>
                      <p className="text-xs text-muted-foreground">Submitted {application.created_at ? format(new Date(application.created_at), "MMM d, yyyy") : "recently"}{application.responded_at ? ` • Resolved ${format(new Date(application.responded_at), "MMM d, yyyy")}` : ""}</p>
                    </div>
                    {application.status === "pending" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="self-start text-destructive sm:self-center" disabled={withdrawMutation.isPending}>Withdraw</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Withdraw application?</AlertDialogTitle>
                            <AlertDialogDescription>This withdraws your pending application to {bandName}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={withdrawMutation.isPending}>Keep application</AlertDialogCancel>
                            <AlertDialogAction onClick={() => withdrawMutation.mutate(application.id)} disabled={withdrawMutation.isPending}>Withdraw application</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Songs Section */}
      <BandSongsSection bandId={band.id} bandName={band.name} />
    </FMPageScaffold>
  );
}
