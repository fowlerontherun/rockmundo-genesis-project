import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music2 } from "lucide-react";

interface ReleaseSelectorProps {
  userId?: string;
  bandId?: string;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function ReleaseSelector({ userId, bandId, value, onValueChange, placeholder = "Select a release" }: ReleaseSelectorProps) {
  const { data: releases, isLoading } = useQuery({
    queryKey: ["user-releases", userId, bandId],
    queryFn: async () => {
      let query = supabase
        .from("releases")
        .select("id, title, release_status, created_at")
        .eq("release_status", "released")
        .order("created_at", { ascending: false });

      if (bandId) {
        query = query.eq("band_id", bandId);
      } else if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userId || !!bandId,
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
        <p className="text-sm text-muted-foreground mb-2">No Released Music Yet</p>
        <p className="text-xs text-muted-foreground">
          Create and release music in Release Manager first
        </p>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {releases.map((release) => (
          <SelectItem key={release.id} value={release.id}>
            {release.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
