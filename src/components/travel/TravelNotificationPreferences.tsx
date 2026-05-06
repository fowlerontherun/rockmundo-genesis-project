import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface Prefs {
  in_app_enabled: boolean;
  email_enabled: boolean;
  notify_status_changes: boolean;
  notify_eta_delays: boolean;
  notify_rejoin_available: boolean;
  email_address: string | null;
}

const DEFAULTS: Prefs = {
  in_app_enabled: true,
  email_enabled: false,
  notify_status_changes: true,
  notify_eta_delays: true,
  notify_rejoin_available: true,
  email_address: null,
};

export const TravelNotificationPreferences = () => {
  const { profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["travel-notification-prefs", profileId],
    queryFn: async (): Promise<Prefs> => {
      if (!profileId) return DEFAULTS;
      const { data, error } = await (supabase as any)
        .from("travel_notification_preferences")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return (data as Prefs) ?? DEFAULTS;
    },
    enabled: !!profileId,
  });

  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  useEffect(() => { if (data) setPrefs(data); }, [data]);

  const save = useMutation({
    mutationFn: async (next: Prefs) => {
      if (!profileId || !userId) throw new Error("No active profile");
      const { error } = await (supabase as any)
        .from("travel_notification_preferences")
        .upsert(
          { profile_id: profileId, user_id: userId, ...next },
          { onConflict: "profile_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Travel notification preferences saved");
      queryClient.invalidateQueries({ queryKey: ["travel-notification-prefs", profileId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save preferences"),
  });

  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4" /> Travel Notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Get pinged when a member's travel status changes, a leg is delayed, or a catch-up becomes available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">In-app inbox alerts</Label>
                <p className="text-[11px] text-muted-foreground">Adds an entry to your inbox.</p>
              </div>
              <Switch
                checked={prefs.in_app_enabled}
                onCheckedChange={(v) => update({ in_app_enabled: v })}
              />
            </div>

            <div className="grid gap-2 pl-1 border-l-2 border-border">
              <ToggleRow
                label="Status changes (depart / arrive / cancel)"
                checked={prefs.notify_status_changes}
                disabled={!prefs.in_app_enabled}
                onChange={(v) => update({ notify_status_changes: v })}
              />
              <ToggleRow
                label="ETA delays"
                checked={prefs.notify_eta_delays}
                disabled={!prefs.in_app_enabled}
                onChange={(v) => update({ notify_eta_delays: v })}
              />
              <ToggleRow
                label="Catch-up / rejoin available"
                checked={prefs.notify_rejoin_available}
                disabled={!prefs.in_app_enabled}
                onChange={(v) => update({ notify_rejoin_available: v })}
              />
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email me too
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Optional</Badge>
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Email delivery activates once a sender domain is configured for the project.
                  </p>
                </div>
                <Switch
                  checked={prefs.email_enabled}
                  onCheckedChange={(v) => update({ email_enabled: v })}
                />
              </div>
              {prefs.email_enabled && (
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={prefs.email_address ?? ""}
                  onChange={(e) => update({ email_address: e.target.value || null })}
                  className="h-8 text-sm"
                />
              )}
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={() => save.mutate(prefs)} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save preferences"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const ToggleRow = ({
  label, checked, onChange, disabled,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <div className="flex items-center justify-between">
    <Label className={`text-xs ${disabled ? "text-muted-foreground" : ""}`}>{label}</Label>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
);
