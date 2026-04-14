import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReleaseSelectorProps {
  profileId?: string;
  bandId?: string;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  releasedOnly?: boolean;
}

export function ReleaseSelector({ profileId, bandId, value, onValueChange, placeholder = "Select a release", releasedOnly = false }: ReleaseSelectorProps) {
  const { data: releases, isLoading } = useQuery({
    queryKey: ["user-releases", profileId, bandId, releasedOnly],
    queryFn: async () => {
      let query = (supabase as any)
        .from("releases")
        .select("id, title, release_status, created_at")
        .order("created_at", { ascending: false });

      if (releasedOnly) {
        query = query.eq("release_status", "released");
      }

      if (bandId) {
        query = query.eq("band_id", bandId);
      } else if (profileId) {
        query = query.eq("profile_id", profileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profileId || !!bandId,
  });

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading releases..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (!releases || releases.length === 0) {
    return (
      <div className="text-center py-8 border rounded-lg bg-muted/50">
        <Music2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground mb-2">No Releases Yet</p>
        <p className="text-xs text-muted-foreground">
          Create music in Release Manager first
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "released": return "default";
      case "manufacturing": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {releases.map((release: any) => (
          <SelectItem key={release.id} value={release.id}>
            <span className="flex items-center gap-2">
              {release.title}
              {release.release_status !== "released" && (
                <Badge variant={getStatusColor(release.release_status) as any} className="text-[10px] px-1 py-0">
                  {release.release_status}
                </Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
