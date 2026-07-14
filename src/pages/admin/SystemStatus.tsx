import { useEffect, useState } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ServerCog, Megaphone, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useSiteConfig,
  DEFAULT_SERVER_STATUS,
  DEFAULT_ANNOUNCEMENT,
  type ServerStatusLevel,
} from "@/hooks/useSiteConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_META: Record<ServerStatusLevel, { label: string; badge: string }> = {
  up: { label: "Online", badge: "bg-green-500/15 text-green-500 border-green-500/40" },
  degraded: { label: "Degraded", badge: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40" },
  down: { label: "Down", badge: "bg-destructive/15 text-destructive border-destructive/40" },
};

export default function SystemStatusAdmin() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useSiteConfig();

  const [status, setStatus] = useState<ServerStatusLevel>(DEFAULT_SERVER_STATUS.status);
  const [statusMessage, setStatusMessage] = useState(DEFAULT_SERVER_STATUS.message);
  const [annEnabled, setAnnEnabled] = useState(DEFAULT_ANNOUNCEMENT.enabled);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annCtaLabel, setAnnCtaLabel] = useState("");
  const [annCtaUrl, setAnnCtaUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    setStatus(data.server.status);
    setStatusMessage(data.server.message);
    setAnnEnabled(!!data.announcement.enabled);
    setAnnTitle(data.announcement.title || "");
    setAnnBody(data.announcement.body || "");
    setAnnCtaLabel(data.announcement.cta_label || "");
    setAnnCtaUrl(data.announcement.cta_url || "");
  }, [data]);

  const saveKey = async (key: string, value: any) => {
    const { error } = await (supabase as any)
      .from("system_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) throw error;
  };

  const saveStatus = useMutation({
    mutationFn: async () => {
      if (!statusMessage.trim()) throw new Error("Status message is required");
      await saveKey("server_status", { status, message: statusMessage.trim() });
    },
    onSuccess: () => {
      toast.success("Server status updated");
      qc.invalidateQueries({ queryKey: ["site-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAnnouncement = useMutation({
    mutationFn: async () => {
      if (annEnabled && !annTitle.trim()) throw new Error("Title is required when banner is enabled");
      await saveKey("announcement_banner", {
        enabled: annEnabled,
        title: annTitle.trim(),
        body: annBody.trim(),
        cta_label: annCtaLabel.trim(),
        cta_url: annCtaUrl.trim(),
      });
    },
    onSuccess: () => {
      toast.success("News banner updated");
      qc.invalidateQueries({ queryKey: ["site-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">System Status & News Banner</h1>
            <p className="text-muted-foreground text-sm">
              Control what visitors see at the top of the public landing and auth pages.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Server status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="h-5 w-5 text-primary" /> Server Status
              <Badge variant="outline" className={`ml-2 ${STATUS_META[status].badge}`}>
                {STATUS_META[status].label}
              </Badge>
            </CardTitle>
            <CardDescription>
              Shown as a top banner on the landing page. Set to "Down" during outages to warn players before they try to log in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ServerStatusLevel)} disabled={isLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">Online</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="down">Down</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Message shown to visitors</Label>
              <Textarea
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                rows={2}
                placeholder="e.g. RockMundo is currently offline for maintenance."
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only displayed on the landing page when status is set to Degraded or Down.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveStatus.mutate()} disabled={saveStatus.isPending || isLoading}>
                {saveStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Status
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Announcement banner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" /> News Banner
              <Badge variant="outline" className={annEnabled ? "border-primary/40 text-primary" : "text-muted-foreground"}>
                {annEnabled ? "Live" : "Hidden"}
              </Badge>
            </CardTitle>
            <CardDescription>
              The announcement strip that currently promotes the upcoming Play Test. Edit the copy or hide it here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Show banner on the public site</p>
                <p className="text-xs text-muted-foreground">Turn off after the announcement is no longer relevant.</p>
              </div>
              <Switch checked={annEnabled} onCheckedChange={setAnnEnabled} disabled={isLoading} />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Open Play Test · Friday 17 July"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                rows={3}
                placeholder="A 1-week public play test starts Friday 17 July 2026 — no Beta code needed. Check Discord for details."
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>CTA Label (optional)</Label>
                <Input value={annCtaLabel} onChange={(e) => setAnnCtaLabel(e.target.value)} placeholder="Discord" disabled={isLoading} />
              </div>
              <div>
                <Label>CTA URL (optional)</Label>
                <Input value={annCtaUrl} onChange={(e) => setAnnCtaUrl(e.target.value)} placeholder="https://discord.gg/..." disabled={isLoading} />
              </div>
            </div>

            {/* Preview */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
                <p className="font-semibold text-primary">{annTitle || "(no title)"}</p>
                <p className="text-foreground/90 mt-0.5">{annBody || "(no body)"}</p>
                {annCtaLabel && annCtaUrl ? (
                  <p className="text-xs text-primary mt-1">→ {annCtaLabel} ({annCtaUrl})</p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => saveAnnouncement.mutate()} disabled={saveAnnouncement.isPending || isLoading}>
                {saveAnnouncement.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Banner
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}
