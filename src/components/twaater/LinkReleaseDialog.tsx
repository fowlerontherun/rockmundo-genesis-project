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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Disc, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LinkReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (releaseId: string, releaseTitle: string) => void;
}

export const LinkReleaseDialog = ({ open, onOpenChange, onSelect }: LinkReleaseDialogProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ["user-releases-for-twaater", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user's bands
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      const bandIds = memberships?.map((m) => m.band_id) || [];

      // Fetch releases
      const { data: releases, error } = await supabase
        .from("releases")
        .select("id, title, release_type, artwork_url, release_status, band:bands(id, name)")
        .or(bandIds.length > 0 ? `band_id.in.(${bandIds.join(",")}),user_id.eq.${user.id}` : `user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return releases || [];
    },
    enabled: open && !!user?.id,
  });

  const filteredReleases = releases.filter((r: any) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Disc className="h-5 w-5" style={{ color: "hsl(var(--twaater-purple))" }} />
            Link a Release
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search releases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">Loading releases...</div>
          ) : filteredReleases.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              {search ? "No releases found" : "No releases yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReleases.map((release: any) => (
                <button
                  key={release.id}
                  onClick={() => {
                    onSelect(release.id, release.title);
                    onOpenChange(false);
                  }}
                  className="w-full p-3 rounded-lg text-left transition-colors hover:bg-[hsl(var(--twaater-hover))] border border-transparent hover:border-[hsl(var(--twaater-border))] flex items-center gap-3"
                >
                  {release.artwork_url ? (
                    <img src={release.artwork_url} alt={release.title} className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                      <Disc className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{release.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {release.band?.name || "Solo"} · {release.release_type}
                    </p>
                  </div>
                  <Badge variant={release.release_status === "released" ? "default" : "secondary"} className="text-xs">
                    {release.release_status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
