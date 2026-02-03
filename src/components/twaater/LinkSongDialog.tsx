import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Search, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (songId: string, songTitle: string) => void;
}

export const LinkSongDialog = ({ open, onOpenChange, onSelect }: LinkSongDialogProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["user-songs-for-twaater", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user's bands
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      const bandIds = memberships?.map((m) => m.band_id) || [];

      // Fetch songs from bands or user
      const { data: songs, error } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, audio_url, status, band:bands(id, name)")
        .or(`band_id.in.(${bandIds.join(",")}),user_id.eq.${user.id}`)
        .in("status", ["recorded", "released"])
        .neq("archived", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return songs || [];
    },
    enabled: open && !!user?.id,
  });

  const filteredSongs = songs.filter((s: any) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" style={{ color: "hsl(var(--twaater-purple))" }} />
            Link a Song
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">Loading songs...</div>
          ) : filteredSongs.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              {search ? "No songs found" : "No recorded songs yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSongs.map((song: any) => (
                <button
                  key={song.id}
                  onClick={() => {
                    onSelect(song.id, song.title);
                    onOpenChange(false);
                  }}
                  className="w-full p-3 rounded-lg text-left transition-colors hover:bg-[hsl(var(--twaater-hover))] border border-transparent hover:border-[hsl(var(--twaater-border))]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{song.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {song.band?.name || "Solo"} · {song.genre}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {song.audio_url && (
                        <Badge variant="secondary" className="text-xs">AI Audio</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">Q{song.quality_score || 0}</Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
