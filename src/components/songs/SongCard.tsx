import { Badge } from "@/components/ui/badge";
import { Music, Info, ListPlus, Clock, Flame, Star, Guitar, Disc } from "lucide-react";
import { SongRehearsalStatus } from "./SongRehearsalStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ui/ContentCard";

interface SongCardProps {
  song: {
    id: string;
    title: string;
    genre: string;
    quality_score: number;
    created_at: string;
    duration_display?: string;
    duration_seconds?: number | null;
    catalog_status?: string;
    status?: string;
    user_id?: string;
    band_id?: string | null;
    hype?: number | null;
    fame?: number | null;
    version?: string | null;
    parent_song_id?: string | null;
    bands?: { name: string } | null;
  };
  onViewDetails: (songId: string) => void;
}

export const SongCard = ({ song, onViewDetails }: SongCardProps) => {
  const { data: userBand } = useQuery({
    queryKey: ["user-band", song.user_id],
    queryFn: async () => {
      if (!song.user_id) return null;
      const { data } = await supabase
        .from("band_members")
        .select("bands!band_members_band_id_fkey(id, name)")
        .eq("user_id", song.user_id)
        .maybeSingle();
      return data?.bands;
    },
    enabled: !!song.user_id,
  });

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "3:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const qualityTone =
    song.quality_score >= 1500
      ? "info"
      : song.quality_score >= 1000
      ? "info"
      : song.quality_score >= 500
      ? "success"
      : "warning";
  const qualityLabel =
    song.quality_score >= 1500
      ? "Exceptional"
      : song.quality_score >= 1000
      ? "High"
      : song.quality_score >= 500
      ? "Medium"
      : "Low";

  return (
    <ContentCard
      title={song.title}
      subtitle={song.bands?.name || "Solo Artist"}
      icon={Music}
      badges={[
        { label: song.genre, tone: "muted" },
        { label: `${qualityLabel} (${song.quality_score})`, tone: qualityTone as any },
        ...(song.status ? [{ label: song.status, tone: "muted" as const }] : []),
      ]}
      primaryAction={{
        label: "Details",
        icon: Info,
        onClick: () => onViewDetails(song.id),
      }}
      secondaryActions={[
        { label: "Add to setlist", icon: ListPlus, onClick: () => {} },
      ]}
    >
      <div className="flex flex-wrap gap-1.5">
        {song.version && song.version !== "standard" && (
          <Badge
            variant="outline"
            className={`gap-1 ${
              song.version === "acoustic"
                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                : "bg-cyan-500/10 text-cyan-600 border-cyan-500/20"
            }`}
          >
            {song.version === "acoustic" ? (
              <Guitar className="h-3 w-3" />
            ) : (
              <Disc className="h-3 w-3" />
            )}
            {song.version === "acoustic" ? "Acoustic" : "Remix"}
          </Badge>
        )}
        {(song.hype ?? 0) > 0 && (
          <Badge
            variant="outline"
            className="gap-1 bg-orange-500/10 text-orange-500 border-orange-500/20"
          >
            <Flame className="h-3 w-3" />
            {song.hype} Hype
          </Badge>
        )}
        {(song.fame ?? 0) > 0 && (
          <Badge
            variant="outline"
            className="gap-1 bg-purple-500/10 text-purple-500 border-purple-500/20"
          >
            <Star className="h-3 w-3" />
            {song.fame} Fame
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {song.duration_display || formatDuration(song.duration_seconds)}
        </Badge>
        {song.catalog_status && (
          <Badge variant="secondary">{song.catalog_status}</Badge>
        )}
      </div>
      <SongRehearsalStatus songId={song.id} bandId={song.band_id || userBand?.id} />
      <p className="text-xs text-muted-foreground">
        Created {new Date(song.created_at).toLocaleDateString()}
      </p>
    </ContentCard>
  );
};
