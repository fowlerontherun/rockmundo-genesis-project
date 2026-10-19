import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Music2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { OwnedNightclub } from "@/hooks/useNightclubOwnership";
import { getDayName } from "@/hooks/useNightclubEvents";
import { parseThemeNightAttempt, resolveThemeNightAttempt, themeNightFingerprint,
  type ThemeNightAction, type ThemeNightAttempt } from "./themeNightClient";

type OwnerThemeNight = {
  id: string;
  day_of_week: number;
  event_name: string;
  genre_focus: string | null;
  is_active: boolean;
};

type ActionReceipt = {
  event_id: string;
  owned_club_id: string;
  action: ThemeNightAction;
  replayed: boolean;
};

const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function OwnedClubThemeNights({ club }: { club: OwnedNightclub }) {
  const queryClient = useQueryClient();
  const verified = Boolean(club.verified_purchase_id && club.club_id);
  const [weekday, setWeekday] = useState("5");
  const [title, setTitle] = useState("Friday Night Beats");
  const [genre, setGenre] = useState("Electronic");
  const pendingAttempt = useRef<ThemeNightAttempt | null>(null);

  const { data: nightsData, isLoading, isError } = useQuery<OwnerThemeNight[]>({
    queryKey: ["owned-nightclub-theme-nights", club.id],
    enabled: verified,
    queryFn: async () => {
      // Owner metadata column was added by live migration; generated API types lag.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_events")
        .select("id,day_of_week,event_name,genre_focus,is_active")
        .eq("managed_by_owned_club_id", club.id).order("day_of_week");
      if (error) throw error;
      return (data ?? []) as OwnerThemeNight[];
    },
  });

  const nights = nightsData ?? [];
  // Sync the form to the selected stored night once the verified-owner query resolves.
  // Changes to draft fields themselves do not trigger a reset.
  useEffect(() => {
    if (!nightsData || isError) return;
    const saved = nightsData.find((night) => night.day_of_week === Number(weekday));
    setTitle(saved?.event_name ?? `${getDayName(Number(weekday))} Night Beats`);
    setGenre(saved?.genre_focus ?? "Electronic");
  }, [nightsData, weekday, isError]);

  const mutation = useMutation({
    mutationFn: async ({ action, day, name, focus }: {
      action: ThemeNightAction; day: number; name?: string; focus?: string;
    }) => {
      if (!verified || !Number.isInteger(day) || day < 0 || day > 6) {
        throw new Error("Verified nightclub ownership and a game weekday are required");
      }
      const cleanName = action === "set" ? (name ?? "").trim() : null;
      const cleanFocus = action === "set" ? (focus ?? "").trim() : null;
      if (action === "set" && (
        !cleanName || cleanName.length < 3 || cleanName.length > 64 ||
        !cleanFocus || cleanFocus.length < 2 || cleanFocus.length > 40
      )) throw new Error("Provide a 3–64 character title and a 2–40 character genre");

      const fingerprint = themeNightFingerprint(club.id, day, action, cleanName, cleanFocus);
      const storageKey = `club-theme-night-request:${club.profile_id}:${club.id}`;
      let previous = pendingAttempt.current;
      if (!previous) {
        try { previous = parseThemeNightAttempt(sessionStorage.getItem(storageKey)); }
        catch { /* WebViews and private sessions may disable storage. */ }
      }
      const attempt = resolveThemeNightAttempt(previous, fingerprint, () => crypto.randomUUID());
      pendingAttempt.current = attempt;
      try { sessionStorage.setItem(storageKey, JSON.stringify(attempt)); }
      catch { /* Keep in-memory request ID when storage is unavailable. */ }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("manage_owned_nightclub_theme_night", {
        p_owned_club_id: club.id,
        p_game_weekday: day,
        p_action: action,
        p_request_id: attempt.requestId,
        p_title: cleanName,
        p_genre: cleanFocus,
      });
      if (error) throw error;
      const receipt = data as ActionReceipt | null;
      if (!receipt || receipt.owned_club_id !== club.id ||
          receipt.action !== action || !uuidFormat.test(receipt.event_id ?? "")) {
        throw new Error("The nightclub theme night update was not confirmed by the server");
      }
      // Acknowledged action is complete even when client-side refresh is delayed.
      pendingAttempt.current = null;
      try { sessionStorage.removeItem(storageKey); } catch { /* Best effort. */ }
      return receipt;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === "set" ? "Game-weekly genre night saved" : "Genre night disabled");
      void queryClient.invalidateQueries({ queryKey: ["owned-nightclub-theme-nights", club.id] });
      void queryClient.invalidateQueries({ queryKey: ["nightclub-events", club.club_id] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update genre night"),
  });

  const selectedDay = Number(weekday);
  const existing = nights.find((night) => night.day_of_week === selectedDay);
  const noChanges = existing?.is_active && existing.event_name === title.trim()
    && existing.genre_focus === genre.trim();

  return (
    <Card data-testid="owner-genre-nights">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-primary" /> Game-weekly genre nights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          These nights repeat on RockMundo's accelerated game weekdays, not your device calendar.
          They do not pay DJ fees or boost fame/XP by themselves.
        </p>
        {!verified ? (
          <p className="text-sm text-muted-foreground">
            Managing club genre nights requires a verified purchase receipt.
            Historical club ownership must be reconciled before this control is available.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`genre-day-${club.id}`}>RockMundo game weekday</Label>
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger id={`genre-day-${club.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 7 }, (_, day) => (
                      <SelectItem value={String(day)} key={day}>{getDayName(day)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`genre-focus-${club.id}`}>Music genre</Label>
                <Input id={`genre-focus-${club.id}`} value={genre}
                  onChange={(event) => setGenre(event.target.value)} maxLength={40}
                  placeholder="House, Rock, Electronic…" disabled={mutation.isPending} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`genre-title-${club.id}`}>Night name</Label>
                <Input id={`genre-title-${club.id}`} value={title}
                  onChange={(event) => setTitle(event.target.value)} maxLength={64}
                  disabled={mutation.isPending} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={mutation.isPending || isLoading || isError || Boolean(noChanges)}
                onClick={() => mutation.mutate({ action: "set", day: selectedDay, name: title, focus: genre })}>
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                  <CalendarDays className="mr-2 h-4 w-4" />}
                {existing ? "Save game-weekly night" : "Create game-weekly night"}
              </Button>
              {existing?.is_active && (
                <Button variant="outline" disabled={mutation.isPending || isLoading || isError}
                  onClick={() => mutation.mutate({ action: "disable", day: selectedDay })}>
                  Disable {getDayName(selectedDay)} night
                </Button>
              )}
            </div>
            {isLoading && <p className="text-sm text-muted-foreground">Loading club events…</p>}
            {isError && <p className="text-sm text-destructive" role="alert">
              Existing genre nights could not be loaded. Check again before changing the schedule.
            </p>}
            {nights.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Your existing game-weekly nights</p>
                {nights.map((night) => (
                  <div key={night.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        {getDayName(night.day_of_week)} · {night.event_name}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Music2 className="h-3 w-3" /> {night.genre_focus}
                      </p>
                    </div>
                    <Badge variant={night.is_active ? "secondary" : "outline"}>
                      {night.is_active ? "Recurring" : "Disabled"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
