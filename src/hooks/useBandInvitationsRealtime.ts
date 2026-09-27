import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BandInvitationChange = {
  eventType: string;
  status: string | null;
};

type BandInvitationRealtimeOptions = {
  /** A band manager sees only invitations for the selected band; a recipient
   * sees invitations addressed to their account. The existing SELECT RLS
   * applies to both subscription filters. */
  filterColumn: "band_id" | "invited_user_id";
  filterValue: string | null | undefined;
  onChange: (change: BandInvitationChange) => void;
};

/**
 * Subscribes to the invitation lifecycle for one band or recipient.
 * The callback ref lets consumers update refresh handlers without reopening
 * a channel on every render. No broad, unfiltered subscriptions are created.
 */
export function useBandInvitationsRealtime({
  filterColumn,
  filterValue,
  onChange,
}: BandInvitationRealtimeOptions) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!filterValue) return;

    const channel = supabase
      .channel(`band-invitations:${filterColumn}:${filterValue}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "band_invitations",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          const next = payload.new;
          const status = next && typeof next === "object" && "status" in next
            && typeof next.status === "string" ? next.status : null;
          onChangeRef.current({ eventType: payload.eventType, status });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [filterColumn, filterValue]);
}
