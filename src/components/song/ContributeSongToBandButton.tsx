import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface ContributeSongToBandButtonProps {
  songId: string;
  songTitle: string;
  songBandId?: string | null;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "default";
}

/**
 * Lets ANY active band member (not just leaders) contribute one of their own
 * finished songs to their band's repertoire so it can be rehearsed and performed.
 */
export const ContributeSongToBandButton = ({
  songId,
  songTitle,
  songBandId,
  size = "sm",
  variant = "outline",
}: ContributeSongToBandButtonProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const primaryBand = usePrimaryBand();
  const { profileId } = useActiveProfile();

  const bandId = primaryBand.data?.band_id ?? null;
  const bandName = primaryBand.data?.bands?.name ?? "your band";

  // Already in this band's repertoire, or the character has no band.
  if (!bandId || songBandId === bandId) return null;

  const handleContribute = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("contribute_song_to_band", {
        p_song_id: songId,
        p_band_id: bandId,
        p_profile_id: profileId ?? null,
      });
      if (error) throw error;

      toast.success("Added to band repertoire", {
        description: `"${songTitle}" can now be rehearsed and performed by ${bandName}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["user-songs"] });
      queryClient.invalidateQueries({ queryKey: ["band-repertoire-songs"] });
      queryClient.invalidateQueries({ queryKey: ["band-songs"] });
    } catch (error: any) {
      const code = String(error?.message ?? "");
      toast.error(
        code.includes("NOT_BAND_MEMBER")
          ? "You are not an active member of this band."
          : code.includes("NOT_SONG_OWNER")
            ? "You can only contribute songs you wrote."
            : "Failed to add song to the band repertoire",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleContribute} disabled={isSubmitting}>
      {isSubmitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Users className="mr-2 h-3 w-3" />}
      Contribute to {bandName}
    </Button>
  );
};
