import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Music, Edit, Trash2, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSetlists, useDeleteSetlist } from "@/hooks/useSetlists";
import { SetlistEditor } from "@/components/setlist/SetlistEditor";
import { SetlistSongManager } from "@/components/setlist/SetlistSongManager";
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [managingSongsSetlistId, setManagingSongsSetlistId] = useState<string | null>(null);
  const [deletingSetlistId, setDeletingSetlistId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: band } = useQuery({
    queryKey: ["user-band", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: memberData, error: memberError } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(*)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberData) return memberData.bands;

      const { data: leaderData, error: leaderError } = await supabase
        .from("bands")
        .select("*")
        .eq("leader_id", user.id)
        .maybeSingle();

      return leaderData;
    },
    enabled: !!user,
  });

  const { data: setlists, isLoading } = useSetlists(band?.id || null);
  const deleteSetlistMutation = useDeleteSetlist();
  
  const canCreateSetlist = (setlists?.length || 0) < 3;

  const handleDelete = (setlistId: string) => {
    deleteSetlistMutation.mutate(setlistId);
    setDeletingSetlistId(null);
  };

  if (!user) {
    return (
      <div className="text-center py-12">Please log in to manage setlists.</div>
    );
  }

  if (!band) {
    return (
      <div className="text-center py-12">
        <p className="mb-4">You need to be in a band to manage setlists.</p>
        <Button onClick={() => navigate("/band-manager")}>Create or Join a Band</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Setlist Manager</h1>
            <p className="text-muted-foreground">
              Create and manage setlists for {band.name}
              <Badge variant="outline" className="ml-2">
                {setlists?.length || 0}/3 Setlists
              </Badge>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button 
              onClick={() => setShowCreateDialog(true)} 
              size="lg"
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
            {!canCreateSetlist && (
              <p className="text-sm text-muted-foreground">
                Delete a setlist to create new one
              </p>
            )}
          </div>
        </div>

        {!canCreateSetlist && (
          <Alert className="mb-6">
            <AlertDescription>
              You've reached the maximum of 3 setlists. This limit helps you focus on perfecting your performances. Delete an existing setlist to create a new one.
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
          <SetlistSongManager
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
      </div>
    </div>
  );
};

export default SetlistManager;
