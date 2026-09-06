import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Music, Edit, Trash2, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSetlists, useDeleteSetlist } from "@/hooks/useSetlists";
import { SetlistEditor } from "@/components/setlist/SetlistEditor";
import { EnhancedSetlistSongManager } from "@/components/setlist/EnhancedSetlistSongManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SetlistManager = () => {
  const {
    profileId,
    userId,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useActiveProfile();
  const navigate = useNavigate();
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [managingSongsSetlistId, setManagingSongsSetlistId] = useState<string | null>(null);
  const [deletingSetlistId, setDeletingSetlistId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const {
    data: band,
    isLoading: isLoadingBand,
    error: bandError,
    refetch: refetchBand,
  } = useQuery({
    queryKey: ["user-band", profileId, userId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data: memberData, error: memberError } = await supabase
        .from("band_members")
        .select(
          "band_id, member_status, is_touring_member, joined_at, bands!band_members_band_id_fkey(*)",
        )
        .eq("profile_id", profileId)
        .or("member_status.eq.active,member_status.is.null")
        .or("is_touring_member.eq.false,is_touring_member.is.null")
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberError) {
        throw memberError;
      }

      const memberBand = (memberData as any)?.bands;
      if (memberBand?.status === "active") {
        return memberBand;
      }

      const { data: leaderData, error: leaderError } = await supabase
        .from("bands")
        .select("*")
        .eq("leader_id", profileId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (leaderError) {
        throw leaderError;
      }

      if (leaderData) {
        return leaderData;
      }

      // Legacy safety net: older membership rows may have the auth user attached
      // but no character profile. Only use this fallback when it resolves to one
      // unambiguous active, non-touring band so another character's band is never
      // selected by accident.
      if (userId) {
        const { data: legacyMemberships, error: legacyError } = await supabase
          .from("band_members")
          .select(
            "band_id, member_status, is_touring_member, joined_at, bands!band_members_band_id_fkey(*)",
          )
          .eq("user_id", userId)
          .or("member_status.eq.active,member_status.is.null")
          .or("is_touring_member.eq.false,is_touring_member.is.null")
          .order("joined_at", { ascending: false });

        if (legacyError) {
          throw legacyError;
        }

        const activeLegacyBands = (legacyMemberships ?? [])
          .map((membership: any) => membership.bands)
          .filter((candidate: any) => candidate?.status === "active");

        const uniqueLegacyBands = Array.from(
          new Map(activeLegacyBands.map((candidate: any) => [candidate.id, candidate])).values(),
        );

        if (uniqueLegacyBands.length === 1) {
          return uniqueLegacyBands[0];
        }
      }

      return null;
    },
    enabled: !!profileId,
    retry: 2,
  });

  const { data: setlists, isLoading } = useSetlists(band?.id || null);
  const deleteSetlistMutation = useDeleteSetlist();

  const canCreateSetlist = (setlists?.length || 0) < 5;

  const handleDelete = (setlistId: string) => {
    deleteSetlistMutation.mutate(setlistId);
    setDeletingSetlistId(null);
  };

  if (isLoadingProfile || (!!profileId && isLoadingBand)) {
    return <div className="text-center py-12">Loading band details...</div>;
  }

  if (profileError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">We couldn't load your active character.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!profileId) {
    return (
      <div className="text-center py-12">Please log in to manage setlists.</div>
    );
  }

  if (bandError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-destructive">We couldn't load your band membership.</p>
        <p className="text-sm text-muted-foreground">
          Your band has not been removed; this is a loading error.
        </p>
        <Button variant="outline" onClick={() => void refetchBand()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="text-center py-12">
        <p className="mb-4">You need to be in an active band to manage setlists.</p>
        <Button onClick={() => navigate("/band")}>Create or Join a Band</Button>
      </div>
    );
  }

  return (
    <FMPageScaffold
      title="Setlist Manager"
      subtitle={`Create and manage setlists for ${band.name}`}
      icon={Music}
      backTo="/hub/band-live"
      headerActions={
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline">{setlists?.length || 0}/5 Setlists</Badge>
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            disabled={!canCreateSetlist}
          >
            {canCreateSetlist ? (
              <>
                <Plus className="mr-2 h-4 w-4" />
                New Setlist
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Limit Reached
              </>
            )}
          </Button>
        </div>
      }
    >
      {!canCreateSetlist && (
        <Alert className="mb-6">
          <AlertDescription>
            You've reached the maximum of 5 setlists. This limit helps you focus on perfecting your performances. Delete an existing setlist to create a new one.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-12">Loading setlists...</div>
      ) : setlists && setlists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Music className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Setlists Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first setlist to start booking gigs
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Setlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {setlists?.map((setlist) => (
            <Card key={setlist.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-1">{setlist.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {setlist.setlist_type} setlist
                    </CardDescription>
                  </div>
                  <Badge
                    variant={setlist.song_count >= 6 ? "default" : "secondary"}
                  >
                    {setlist.song_count || 0} songs
                  </Badge>
                </div>
                {setlist.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {setlist.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {setlist.song_count < 6 && (
                  <div className="bg-muted p-2 rounded-md mb-3 text-sm">
                    <span className="text-warning">⚠️</span> Add{" "}
                    {6 - (setlist.song_count || 0)} more songs to book gigs
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setManagingSongsSetlistId(setlist.id)}
                  >
                    <Music className="mr-2 h-4 w-4" />
                    Manage Songs
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSetlistId(setlist.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingSetlistId(setlist.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <SetlistEditor
          bandId={band.id}
          onClose={() => setShowCreateDialog(false)}
          bandFame={band.fame || 0}
        />
      )}

      {editingSetlistId && (
        <SetlistEditor
          bandId={band.id}
          setlistId={editingSetlistId}
          onClose={() => setEditingSetlistId(null)}
          bandFame={band.fame || 0}
        />
      )}

      {managingSongsSetlistId && (
        <EnhancedSetlistSongManager
          setlistId={managingSongsSetlistId}
          bandId={band.id}
          onClose={() => setManagingSongsSetlistId(null)}
        />
      )}

      <AlertDialog
        open={!!deletingSetlistId}
        onOpenChange={() => setDeletingSetlistId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Setlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this setlist and remove it from any booked gigs.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSetlistId && handleDelete(deletingSetlistId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FMPageScaffold>
  );
};

export default SetlistManager;
