import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Version = { id: string; version_key: string; name: string; description: string | null; status: string; config: Record<string, unknown>; created_at: string; activated_at: string | null };
type Audit = { id: string; action: string; change_summary: string | null; created_at: string; balance_version_id: string | null };

const db = supabase as any;
const NEXT: Record<string, { status: string; label: string }[]> = {
  draft: [{ status: "valid", label: "Mark checked" }, { status: "invalid", label: "Mark invalid" }],
  validating: [{ status: "valid", label: "Mark checked" }, { status: "invalid", label: "Mark invalid" }],
  invalid: [{ status: "draft", label: "Back to draft" }],
  valid: [{ status: "approved", label: "Approve" }, { status: "active", label: "Make live" }],
  approved: [{ status: "active", label: "Make live" }, { status: "draft", label: "Back to draft" }],
  scheduled: [{ status: "active", label: "Make live" }],
  active: [{ status: "rolled_back", label: "Roll back" }, { status: "retired", label: "Retire" }],
};

export default function BalanceVersions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState("{\n  \n}");
  const [busy, setBusy] = useState(false);

  const versions = useQuery({
    queryKey: ["admin-balance-versions"],
    queryFn: async () => {
      const { data, error } = await db.from("balance_versions").select("id,version_key,name,description,status,config,created_at,activated_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Version[];
    },
  });
  const audit = useQuery({
    queryKey: ["admin-balance-audit"],
    queryFn: async () => {
      const { data, error } = await db.from("balance_audit_log").select("id,action,change_summary,created_at,balance_version_id").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as Audit[];
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin-balance-versions"] }); void qc.invalidateQueries({ queryKey: ["admin-balance-audit"] }); };
  const fail = (e: any) => toast({ title: "Couldn't save", description: e?.message ?? String(e), variant: "destructive" });

  const create = async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(config); } catch { return fail(new Error("Settings must be valid JSON")); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(new Error("Settings must be a JSON object"));
    setBusy(true);
    const { error } = await db.rpc("admin_create_balance_version", { p_version_key: key, p_name: name, p_description: description || null, p_config: parsed, p_parent_id: null });
    setBusy(false);
    if (error) return fail(error);
    toast({ title: "Draft saved" });
    setKey(""); setName(""); setDescription(""); setConfig("{\n  \n}");
    refresh();
  };
  const setStatus = async (v: Version, status: string) => {
    if (status === "active" && !window.confirm(`Make "${v.name}" the live balance version? The current live version will be retired.`)) return;
    const { error } = await db.rpc("admin_set_balance_version_status", { p_version_id: v.id, p_status: status, p_note: null });
    if (error) return fail(error);
    toast({ title: `Version ${status.replace("_", " ")}` });
    refresh();
  };
  const nameOf = (id: string | null) => versions.data?.find((v) => v.id === id)?.version_key ?? "—";

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Scale className="h-5 w-5 text-primary" />Balance Versions</h1>
        <p className="text-xs text-muted-foreground">Save game-balance settings as versions, check them, and make one live. Live versions are locked.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">New draft</CardTitle><CardDescription className="text-xs">Settings are a JSON object, e.g. {"{\"gig_payout_multiplier\": 1.1}"}</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Key (e.g. 2026-11-economy)" value={key} onChange={(e) => setKey(e.target.value)} className="h-8 w-56 text-xs" />
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 min-w-[12rem] flex-1 text-xs" />
          </div>
          <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" />
          <Textarea value={config} onChange={(e) => setConfig(e.target.value)} rows={6} className="font-mono text-xs" />
          <Button size="sm" onClick={() => void create()} disabled={busy || !key.trim() || !name.trim()}><Plus className="mr-1 h-4 w-4" />Save draft</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Versions</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {versions.error && <p className="text-destructive">{(versions.error as Error).message}</p>}
          {(versions.data ?? []).length === 0 && !versions.isLoading && <p className="text-muted-foreground">No versions yet.</p>}
          {(versions.data ?? []).map((v) => (
            <div key={v.id} className="space-y-1 rounded border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{v.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{v.version_key}</span>
                <Badge variant={v.status === "active" ? "default" : "outline"} className="text-[10px]">{v.status.replace("_", " ")}</Badge>
                <span className="ml-auto text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
              </div>
              {v.description && <p className="text-muted-foreground">{v.description}</p>}
              <pre className="max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-[10px]">{JSON.stringify(v.config, null, 2)}</pre>
              <div className="flex flex-wrap gap-1">
                {(NEXT[v.status] ?? []).map((n) => (
                  <Button key={n.status} size="sm" variant={n.status === "active" ? "default" : "outline"} className="h-7 text-[11px]" onClick={() => void setStatus(v, n.status)}>{n.label}</Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">History</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {(audit.data ?? []).length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
          {(audit.data ?? []).map((a) => (
            <div key={a.id} className="flex gap-2">
              <span className="w-32 shrink-0 text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              <span className="font-mono text-[10px]">{nameOf(a.balance_version_id)}</span>
              <span>{a.action}</span>
              {a.change_summary && <span className="truncate text-muted-foreground">{a.change_summary}</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
