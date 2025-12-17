import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Music, Disc, Calendar, Route, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { useNavigate } from "react-router-dom";

interface LinkedContentEmbedProps {
  linkedType: "single" | "album" | "gig" | "tour" | "busking" | null;
  linkedId: string | null;
}

export const LinkedContentEmbed = ({ linkedType, linkedId }: LinkedContentEmbedProps) => {
  const navigate = useNavigate();

  const { data: songContent } = useQuery({
    queryKey: ["linked-song", linkedId],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, audio_url, band:bands!songs_band_id_fkey(name)")
        .eq("id", linkedId!)
        .single();
      return data;
    },
    enabled: linkedType === "single" && !!linkedId,
  });

  const { data: releaseContent } = useQuery({
    queryKey: ["linked-release", linkedId],
    queryFn: async () => {
      const { data } = await supabase
        .from("releases")
        .select("id, title, release_type, artwork_url, band:bands(name)")
        .eq("id", linkedId!)
        .single();
      return data;
    },
    enabled: linkedType === "album" && !!linkedId,
  });

  const { data: gigContent } = useQuery({
    queryKey: ["linked-gig", linkedId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gigs")
        .select(`
          id, status, scheduled_date, ticket_price,
          venue:venues!gigs_venue_id_fkey(name, city:cities(name)),
          band:bands!gigs_band_id_fkey(name)
        `)
        .eq("id", linkedId!)
        .single();
      return data;
    },
    enabled: linkedType === "gig" && !!linkedId,
  });

  const { data: tourContent } = useQuery({
    queryKey: ["linked-tour", linkedId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tours")
        .select("id, name, status, start_date, end_date, band:bands(name)")
        .eq("id", linkedId!)
        .single();
      return data;
    },
    enabled: linkedType === "tour" && !!linkedId,
  });

  if (!linkedId || !linkedType) return null;

  if (linkedType === "single" && songContent) {
    return (
      <div className="mt-3">
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[hsl(var(--twaater-hover))]"
          style={{ borderColor: "hsl(var(--twaater-border))", backgroundColor: "hsl(var(--twaater-bg))" }}
          onClick={() => navigate("/recording-studio")}
        >
          <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
            <Music className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{songContent.title}</p>
            <p className="text-sm text-muted-foreground">{(songContent.band as any)?.name || "Solo"} · {songContent.genre}</p>
          </div>
          {songContent.audio_url && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <SongPlayer audioUrl={songContent.audio_url} title={songContent.title} compact />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (linkedType === "album" && releaseContent) {
    return (
      <div className="mt-3">
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[hsl(var(--twaater-hover))]"
          style={{ borderColor: "hsl(var(--twaater-border))", backgroundColor: "hsl(var(--twaater-bg))" }}
          onClick={() => navigate("/release-manager")}
        >
          {releaseContent.artwork_url ? (
            <img src={releaseContent.artwork_url} alt={releaseContent.title} className="w-12 h-12 rounded object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Disc className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{releaseContent.title}</p>
            <p className="text-sm text-muted-foreground">{(releaseContent.band as any)?.name || "Solo"} · {releaseContent.release_type}</p>
          </div>
          <Badge variant="secondary" className="text-xs capitalize shrink-0">{releaseContent.release_type}</Badge>
        </div>
      </div>
    );
  }

  if (linkedType === "gig" && gigContent) {
    const venue = gigContent.venue as any;
    const band = gigContent.band as any;
    return (
      <div className="mt-3">
        <div 
          className="p-3 rounded-lg border cursor-pointer hover:bg-[hsl(var(--twaater-hover))]"
          style={{ borderColor: "hsl(var(--twaater-border))", backgroundColor: "hsl(var(--twaater-bg))" }}
          onClick={() => navigate("/gig-booking")}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{band?.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {venue?.name}, {venue?.city?.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {gigContent.scheduled_date && format(new Date(gigContent.scheduled_date), "PPP 'at' p")}
              </p>
            </div>
            <Badge variant={gigContent.status === "completed" ? "default" : "secondary"} className="text-xs capitalize shrink-0">
              {gigContent.status}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  if (linkedType === "tour" && tourContent) {
    return (
      <div className="mt-3">
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-[hsl(var(--twaater-hover))]"
          style={{ borderColor: "hsl(var(--twaater-border))", backgroundColor: "hsl(var(--twaater-bg))" }}
          onClick={() => navigate("/tours")}
        >
          <div className="w-12 h-12 rounded bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shrink-0">
            <Route className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{tourContent.name}</p>
            <p className="text-sm text-muted-foreground">{(tourContent.band as any)?.name}</p>
            <p className="text-xs text-muted-foreground">
              {tourContent.start_date && format(new Date(tourContent.start_date), "MMM d")} - {tourContent.end_date && format(new Date(tourContent.end_date), "MMM d, yyyy")}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs capitalize shrink-0">{tourContent.status || "planned"}</Badge>
        </div>
      </div>
    );
  }

  return null;
};
