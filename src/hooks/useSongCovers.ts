import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface CoverableSong {
  song_id: string;
  title: string;
  genre: string | null;
  quality_score: number;
  fame: number;
  popularity: number;
  peak_popularity: number;
  owner_band_id: string | null;
  owner_band_name: string | null;
  owner_profile_id: string | null;
  cover_royalty_percentage: number;
  cover_auto_approve: boolean;
  recording_requests_open: boolean;
  gig_play_count: number;
  release_date: string | null;
  in_repertoire: boolean;
  familiarity_percentage: number;
  recording_license_status: string | null;
  recording_license_royalty_percentage: number | null;
  existing_request_status: string | null;
  covering_band_count: number;
}

export interface CoverRequestRow {
  id: string;
  song_id: string;
  requesting_band_id: string;
  owner_band_id: string | null;
  purpose: string;
  message: string | null;
  status: string;
  royalty_percentage: number;
  flat_fee_amount: number;
  response_message: string | null;
  responded_at: string | null;
  created_at: string;
  songs?: { title: string; genre: string | null; fame: number | null; popularity: number | null } | null;
  requesting_band?: { name: string } | null;
  owner_band?: { name: string } | null;
}

/** Bands the active character is an active member of. */
export const useMyBandIds = () => {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["my-band-ids", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands(name)")
        .eq("profile_id", profileId!)
        .eq("member_status", "active");
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        bandId: row.band_id as string,
        bandName: (row.bands?.name as string) ?? "Band",
      }));
    },
  });
};

/** Finished songs by other bands, including repertoire + licence state for this band. */
export const useCoverableSongs = (params: {
  search?: string;
  genre?: string;
  bandId?: string | null;
}) => {
  const { search, genre, bandId } = params;

  return useQuery({
    queryKey: ["cover-song-catalog", search ?? "", genre ?? "all", bandId ?? ""],
    enabled: !!bandId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_cover_song_catalog", {
        p_band_id: bandId,
        p_search: search?.trim() ? search.trim() : null,
        p_genre: genre && genre !== "all" ? genre : null,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as CoverableSong[];
    },
  });
};

const requestSelect = `
  *,
  songs:song_id (title, genre, fame, popularity),
  requesting_band:requesting_band_id (name),
  owner_band:owner_band_id (name)
`;

/** Recording-cover requests my bands have sent. */
export const useOutgoingCoverRequests = (bandIds: string[]) =>
  useQuery({
    queryKey: ["cover-requests-outgoing", bandIds.join(",")],
    enabled: bandIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("song_cover_requests")
        .select(requestSelect)
        .in("requesting_band_id", bandIds)
        .in("purpose", ["recording", "both"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CoverRequestRow[];
    },
  });

/** Recording requests waiting on my bands / my songs. */
export const useIncomingCoverRequests = (bandIds: string[]) => {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["cover-requests-incoming", bandIds.join(","), profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const filters = [`owner_profile_id.eq.${profileId}`];
      if (bandIds.length > 0) filters.push(`owner_band_id.in.(${bandIds.join(",")})`);

      const { data, error } = await (supabase as any)
        .from("song_cover_requests")
        .select(requestSelect)
        .or(filters.join(","))
        .in("purpose", ["recording", "both"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CoverRequestRow[];
    },
  });
};

export const useAddSongToRepertoire = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { songId: string; bandId: string }) => {
      const { data, error } = await (supabase as any).rpc("add_song_to_band_repertoire", {
        p_song_id: input.songId,
        p_band_id: input.bandId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Song added to the live repertoire");
      queryClient.invalidateQueries({ queryKey: ["cover-song-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["band-repertoire-songs"] });
      queryClient.invalidateQueries({ queryKey: ["band-songs"] });
      queryClient.invalidateQueries({ queryKey: ["band-songs-optimized"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not add the song to the repertoire"),
  });
};

/** Recording permission is separate from permission to learn/play a song live. */
export const useRequestSongCover = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { songId: string; bandId: string; message?: string }) => {
      const { data, error } = await (supabase as any).rpc("request_song_cover", {
        p_song_id: input.songId,
        p_band_id: input.bandId,
        p_purpose: "recording",
        p_message: input.message ?? null,
      });
      if (error) throw error;
      return data as { status: string; royalty_percentage: number; license_id?: string };
    },
    onSuccess: (result) => {
      toast.success(
        result?.status === "approved"
          ? `Recording licence approved at ${Number(result.royalty_percentage ?? 0)}% writer royalties`
          : "Recording licence request sent to the songwriters",
      );
      queryClient.invalidateQueries({ queryKey: ["cover-song-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["cover-requests-outgoing"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not request a recording licence"),
  });
};

export const useRespondToCoverRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      approve: boolean;
      royaltyPercentage?: number;
      responseMessage?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("respond_to_song_cover_request", {
        p_request_id: input.requestId,
        p_approve: input.approve,
        p_royalty_percentage: input.royaltyPercentage ?? null,
        p_response_message: input.responseMessage ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.approve ? "Recording licence approved" : "Recording licence request declined");
      queryClient.invalidateQueries({ queryKey: ["cover-requests-incoming"] });
      queryClient.invalidateQueries({ queryKey: ["cover-song-catalog"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not answer the request"),
  });
};

/** Creates/reuses the covering band's own pre-recording master after a licence is approved. */
export const useGetOrCreateCoverMaster = () =>
  useMutation({
    mutationFn: async (input: { originalSongId: string; bandId: string }) => {
      const { data, error } = await (supabase as any).rpc("get_or_create_cover_master", {
        p_original_song_id: input.originalSongId,
        p_band_id: input.bandId,
      });
      if (error) throw error;
      return data as {
        cover_master_id: string;
        original_song_id: string;
        license_id: string;
        royalty_percentage: number;
        status: string;
      };
    },
  });

export const useUpdateSongCoverSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      songId: string;
      availableForCovers: boolean;
      royaltyPercentage: number;
      autoApprove: boolean;
    }) => {
      const { error } = await (supabase as any)
        .from("songs")
        .update({
          available_for_covers: input.availableForCovers,
          cover_royalty_percentage: Math.round(input.royaltyPercentage),
          cover_auto_approve: input.autoApprove,
        })
        .eq("id", input.songId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recording-cover terms updated");
      queryClient.invalidateQueries({ queryKey: ["user-songs"] });
      queryClient.invalidateQueries({ queryKey: ["cover-song-catalog"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not update recording-cover terms"),
  });
};

/** Refresh a song's fame (permanent) and popularity (dynamic). */
export const useRecalculateSongMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (songId: string) => {
      const { data, error } = await (supabase as any).rpc("recalculate_song_fame_popularity", {
        p_song_id: songId,
      });
      if (error) throw error;
      return data as { fame: number; popularity: number };
    },
    onSuccess: (result) => {
      toast.success(`Fame ${result?.fame ?? 0} · Popularity ${result?.popularity ?? 0}`);
      queryClient.invalidateQueries({ queryKey: ["user-songs"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not refresh song metrics"),
  });
};
