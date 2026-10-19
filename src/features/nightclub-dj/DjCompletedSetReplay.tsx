import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const VerifiedDjStage = lazy(() =>
  import("./DjLiveClubStage").then(module => ({ default: module.DjLiveClubStage })),
);

type Club = { id: string; name: string; cityName: string };

/** Only an actually completed owner-visible DJ booking may open a replay. */
export function DjCompletedSetReplay({
  bookingId, profileId, clubs, onClose,
}: {
  bookingId: string;
  profileId: string;
  clubs: readonly Club[];
  onClose: () => void;
}) {
  const booking = useQuery<{ id: string; club_id: string; status: string }>({
    queryKey: ["dj-completed-replay-identity", profileId, bookingId],
    queryFn: async () => {
      // DJ booking columns predate the generated TypeScript client schema.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_bookings")
        .select("id,club_id,status").eq("id", bookingId)
        .eq("profile_id", profileId).eq("status", "completed").single();
      if (error) throw error;
      return data as { id: string; club_id: string; status: string };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const matchedClub = clubs.find(club => club.id === booking.data?.club_id);
  return (
    <section aria-label="Selected DJ performance replay" className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Completed set · {matchedClub?.name ?? "Nightclub"}</h3>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          <X className="mr-1 h-4 w-4" /> Close replay
        </Button>
      </div>
      {booking.isLoading && <p role="status" className="text-sm text-muted-foreground">Verifying historical booking ownership…</p>}
      {(booking.isError || (!booking.isLoading && booking.data?.status !== "completed")) && (
        <p role="alert" className="text-sm text-destructive">
          This completed performance cannot be verified for your selected character.
        </p>
      )}
      {booking.data?.status === "completed" && (
        <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading DJ stage viewer…</p>}>
          <VerifiedDjStage key={bookingId} mode="replay"
            bookingId={booking.data.id} profileId={profileId} clubId={booking.data.club_id}
            clubName={matchedClub?.name ?? "Nightclub"} />
        </Suspense>
      )}
    </section>
  );
}
