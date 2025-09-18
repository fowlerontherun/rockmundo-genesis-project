import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Music, Users, Calendar, TrendingUp } from "lucide-react";
import type { Band, BandMember } from "@/types/database";

interface BandMemberWithProfile extends BandMember {
  profiles?: {
    display_name: string;
    username: string;
  };
}

export default function SimpleBandManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [band, setBand] = useState<Band | null>(null);
  const [members, setMembers] = useState<BandMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBandName, setNewBandName] = useState("");
  const [newBandGenre, setNewBandGenre] = useState("Rock");

  const genres = ["Rock", "Pop", "Jazz", "Blues", "Electronic", "Country", "Hip-Hop", "Classical"];

  const loadBandMembers = useCallback(async (bandId: string) => {
    try {
      const { data } = await supabase
        .from("band_members")
        .select(`
          *,
          profiles:user_id (
            display_name,
            username
          )
        `)
        .eq("band_id", bandId);

      if (data) {
        setMembers(data as BandMemberWithProfile[]);
      }
    } catch (error) {
      console.error("Error loading band members:", error);
      toast({
        title: "Band members unavailable",
        description: "We couldn't load the current roster. Please try again shortly.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadBandData = useCallback(async () => {
    if (!user?.id) {
      setBand(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      // Check if user is a band leader
      const { data: leaderBand } = await supabase
        .from("bands")
        .select("*")
        .eq("leader_id", user.id)
        .single();

      if (leaderBand) {
        setBand(leaderBand);
        await loadBandMembers(leaderBand.id);
      } else {
        // Check if user is a band member
        const { data: memberData } = await supabase
          .from("band_members")
          .select("band_id, bands(*)")
          .eq("user_id", user.id)
          .single();

        if (memberData?.bands) {
          setBand(memberData.bands as Band);
          await loadBandMembers(memberData.band_id);
        }
      }
    } catch (error) {
      console.error("Error loading band data:", error);
    } finally {
      setLoading(false);
    }
  }, [loadBandMembers, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    loadBandData();
  }, [loadBandData, user?.id]);

  const createBand = async () => {
    if (!user?.id || !newBandName.trim()) {
      toast({
        title: "Band name required",
        description: "Enter a name before creating your band.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("bands")
        .insert({
          name: newBandName.trim(),
          genre: newBandGenre,
          description: `A ${newBandGenre} band`,
          leader_id: user.id,
          popularity: 0,
          weekly_fans: 0,
          max_members: 4
        })
        .select()
        .single();

      if (error) throw error;

      setBand(data);
      setNewBandName("");
      await loadBandMembers(data.id);
      toast({
        title: "Band created",
        description: `${data.name} is ready to take the stage!`,
      });
    } catch (error) {
      console.error("Error creating band:", error);
      toast({
        title: "Could not create band",
        description: "Something went wrong while saving your band. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Create Your Band
            </CardTitle>
            <CardDescription>
              Start your musical journey by creating a band
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Band Name</label>
              <Input
                value={newBandName}
                onChange={(e) => setNewBandName(e.target.value)}
                placeholder="Enter band name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Genre</label>
              <select
                value={newBandGenre}
                onChange={(e) => setNewBandGenre(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={createBand} disabled={!newBandName.trim()}>
              Create Band
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{band.name}</h1>
          <p className="text-muted-foreground">{band.genre} Band</p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {band.popularity} Popularity
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground">
              Max {band.max_members} members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Fans</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{band.weekly_fans}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Popularity</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{band.popularity}</div>
            <p className="text-xs text-muted-foreground">
              Fame points
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Band Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {member.profiles?.display_name || member.profiles?.username || "Unknown"}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                <Badge variant="outline">
                  {member.user_id === band.leader_id ? "Leader" : "Member"}
                </Badge>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                No members yet. Invite musicians to join your band!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}