import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, MoreHorizontal, Send, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { blockPlayer } from "@/services/socialSafety";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { friendlyRoleplayError, INTERACTIONS, parseChatInput, type RoomMessageKind } from "./roleplay";

type Row = { id: string; profile_id: string; kind: RoomMessageKind; body: string; created_at: string;
  author: { display_name: string | null; username: string | null } | null };

const nameOf = (r: Row) => r.author?.display_name || r.author?.username || "Someone";

export function RoomChat({ roomKey, title, subtitle }: { roomKey: string; title: string; subtitle?: string }) {
  const { profileId } = useActiveProfile();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"say" | "me" | "ooc">("say");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const key = ["social-room", roomKey];

  const { data: rows = [], isError } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("social_room_messages")
        .select("id,profile_id,kind,body,created_at,author:profiles!social_room_messages_profile_id_fkey(display_name,username)")
        .eq("room_key", roomKey).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return ((data ?? []) as Row[]).reverse();
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`room-${roomKey}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_room_messages", filter: `room_key=eq.${roomKey}` },
        () => void qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [rows.length]);

  const send = async () => {
    const parsed = parseChatInput(text, mode);
    if (!parsed || !profileId) return;
    setSending(true);
    const { error } = await (supabase as any).rpc("post_social_room_message", { p_profile: profileId, p_room: roomKey, p_kind: parsed.kind, p_body: parsed.body });
    setSending(false);
    if (error) return toast.error(friendlyRoleplayError(error.message));
    setText("");
    void qc.invalidateQueries({ queryKey: key });
  };

  const interact = async (target: string, kind: string) => {
    const { data, error } = await (supabase as any).rpc("perform_social_interaction", { p_actor: profileId, p_target: target, p_kind: kind, p_room: roomKey });
    if (error) return toast.error(friendlyRoleplayError(error.message));
    toast.success(data?.xp ? `${data.line} (+${data.xp} XP)` : data?.line ?? "Done");
    void qc.invalidateQueries({ queryKey: key });
  };
  const report = async (row: Row) => {
    const reason = window.prompt("Why are you reporting this message?");
    if (reason === null) return;
    const { error } = await (supabase as any).rpc("report_social_room_message", { p_profile: profileId, p_message: row.id, p_reason: reason });
    if (error) toast.error("Couldn't send the report."); else toast.success("Reported to moderators.");
  };
  const block = async (row: Row) => {
    if (!window.confirm(`Block ${nameOf(row)}? You won't see their messages.`)) return;
    try { await blockPlayer(row.profile_id); toast.success("Player blocked."); void qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't block."); }
  };

  return (
    <Card>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <div className="h-80 space-y-1 overflow-y-auto rounded border bg-muted/20 p-2 text-xs" aria-live="polite">
          {isError && <p className="text-destructive">You can't see this room right now.</p>}
          {!isError && rows.length === 0 && <p className="text-muted-foreground">It's quiet in here. Say something, or try <code>/me</code> to act.</p>}
          {rows.map((r) => (
            <div key={r.id} className="group flex items-start gap-1">
              <p className={cn("flex-1 leading-snug",
                r.kind === "me" && "italic text-primary",
                r.kind === "ooc" && "text-muted-foreground",
                r.kind === "system" && "text-center text-[11px] font-medium text-accent-foreground")}>
                {r.kind === "say" && <><strong>{nameOf(r)}:</strong> {r.body}</>}
                {r.kind === "me" && <>* {nameOf(r)} {r.body}</>}
                {r.kind === "ooc" && <>(( {nameOf(r)}: {r.body} ))</>}
                {r.kind === "system" && <>— {r.body} —</>}
              </p>
              {r.profile_id !== profileId && r.kind !== "system" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="opacity-60 hover:opacity-100" aria-label={`Actions for ${nameOf(r)}`}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="text-xs">{nameOf(r)}</DropdownMenuLabel>
                    {INTERACTIONS.map((i) => <DropdownMenuItem key={i.kind} className="text-xs" onClick={() => void interact(r.profile_id, i.kind)}>{i.emoji} {i.label}</DropdownMenuItem>)}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-xs" onClick={() => void report(r)}><Flag className="mr-1 h-3 w-3" />Report message</DropdownMenuItem>
                    <DropdownMenuItem className="text-xs text-destructive" onClick={() => void block(r)}><ShieldOff className="mr-1 h-3 w-3" />Block player</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          <div ref={bottom} />
        </div>
        <div className="flex flex-nowrap gap-1">
          {(["say", "me", "ooc"] as const).map((m) => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} className="h-8 px-2 text-[11px]" onClick={() => setMode(m)}>
              {m === "say" ? "Say" : m === "me" ? "Action" : "OOC"}
            </Button>
          ))}
          <Input className="h-8 text-xs" maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
            placeholder={mode === "me" ? "e.g. tunes up his guitar" : mode === "ooc" ? "Out of character…" : "Say something in character…"} />
          <Button size="sm" className="h-8" disabled={sending || !text.trim() || !profileId} onClick={() => void send()} aria-label="Send"><Send className="h-3.5 w-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
