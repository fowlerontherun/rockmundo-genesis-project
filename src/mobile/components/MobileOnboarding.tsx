import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BookOpen, CheckCircle2, Download, HelpCircle, Info, RefreshCw, ShieldAlert, Smartphone, X, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { PersistedNotification } from "@/hooks/useNotificationsFeed";
import { MCard } from "./MCard";
import { EmptyState } from "./EmptyState";
import { deriveQuickStartSteps, deriveRecommendedAction, getBlockedActionCopy, getPlayerSegment, groupMobileNotifications, loadMobileOnboardingState, saveMobileOnboardingState, type QuickStartStep } from "../mobileOnboarding";

const track = (event: string, data: Record<string, unknown> = {}) => {
  window.dispatchEvent(new CustomEvent("rm-mobile-analytics", { detail: { event, ...data } }));
};

export function useMobileOnboardingState() {
  const { user } = useAuth();
  const [state, setState] = useState(() => loadMobileOnboardingState(user?.id));
  useEffect(() => {
    const next = saveMobileOnboardingState(user?.id, { mobileSessionCount: loadMobileOnboardingState(user?.id).mobileSessionCount + 1 });
    setState(next);
    const listener = (e: Event) => setState((e as CustomEvent).detail);
    window.addEventListener("rm-mobile-onboarding-state", listener);
    return () => window.removeEventListener("rm-mobile-onboarding-state", listener);
  }, [user?.id]);
  const update = (patch: Parameters<typeof saveMobileOnboardingState>[1]) => setState(saveMobileOnboardingState(user?.id, patch));
  return { state, update, userId: user?.id };
}

export function MobileWelcomeCard() {
  const game = useGameData();
  const navigate = useNavigate();
  const { state, update } = useMobileOnboardingState();
  const segment = getPlayerSegment(game, state);
  if (state.welcome !== "new") return null;
  const established = segment === "established-first-mobile";
  const complete = (skipped = false) => { update({ welcome: skipped ? "skipped" : "continued" }); track(skipped ? "mobile_onboarding_skipped" : "mobile_onboarding_started", { segment }); };
  return <MCard className="border-primary/40 bg-primary/5" title={established ? "Your career is ready on mobile" : "Welcome to RockMundo mobile"} subtitle={established ? "Your band, city and progress are preserved." : "Quick actions, active activities and daily progress in one hand."} icon={<Smartphone className="h-5 w-5" />}>
    <p className="text-sm text-muted-foreground">Mobile is tuned for checking what changed, responding quickly, travel and scheduling, band coordination and daily progression — not a separate tutorial mode.</p>
    <div className="mt-2 grid grid-cols-2 gap-2"><Button onClick={() => complete(false)}>Continue</Button><Button variant="outline" onClick={() => complete(true)} aria-label="Skip Mobile Tour">Skip Mobile Tour</Button></div>
    <Button variant="ghost" size="sm" onClick={() => navigate("/mobile/me/settings")}>Open Settings later</Button>
  </MCard>;
}

export function MobileRecommendedAction({ notifications = [] }: { notifications?: PersistedNotification[] }) {
  const navigate = useNavigate();
  const game = useGameData();
  const rec = deriveRecommendedAction(game, notifications);
  if (!rec) return null;
  return <MCard title={rec.title} subtitle={rec.reason} icon={<Info className="h-5 w-5" />} chevron onPress={() => { track("recommended_action_opened", { title: rec.title }); navigate(rec.to); }} />;
}

export function MobileQuickStartChecklist({ recover = false }: { recover?: boolean }) {
  const navigate = useNavigate();
  const game = useGameData();
  const { state, update } = useMobileOnboardingState();
  const steps = deriveQuickStartSteps(game, state);
  const done = steps.filter((s) => s.completed).length;
  if (!recover && (state.quickStartDismissedAt || done === steps.length)) return null;
  const mark = (step: QuickStartStep) => { update({ completedStepIds: [...new Set([...state.completedStepIds, step.id])] }); track("quick_start_step_completed", { step: step.id }); navigate(step.to); };
  return <section className="rm-mcard p-4" aria-labelledby="mobile-quick-start-title"><div className="mb-3 flex items-start justify-between gap-2"><div><h2 id="mobile-quick-start-title" className="font-bold">Quick Start</h2><p className="text-xs text-muted-foreground">{done} of {steps.length} complete. Based on your current player state.</p></div><Button variant="ghost" size="icon" aria-label="Dismiss Quick Start" onClick={() => update({ quickStartDismissedAt: new Date().toISOString() })}><X className="h-4 w-4" /></Button></div><ol className="space-y-2">{steps.map((s) => <li key={s.id}><button className="w-full rounded-xl border p-3 text-left" aria-pressed={s.completed} onClick={() => mark(s)}><span className="flex items-center gap-2 font-semibold"><CheckCircle2 className={`h-4 w-4 ${s.completed ? "text-green-500" : "text-muted-foreground"}`} />{s.title}</span><span className="mt-1 block text-xs text-muted-foreground">{s.explanation} Benefit: {s.benefit}</span>{s.blocker && <span className="mt-1 block text-xs text-amber-600">Blocked: {s.blocker}</span>}</button></li>)}</ol></section>;
}

export function MobileContextTip({ id, title, children }: { id: string; title: string; children: string }) {
  const { state, update } = useMobileOnboardingState();
  if (state.dismissedGuidanceIds.includes(id)) return null;
  return <MCard title={title} subtitle={children} icon={<HelpCircle className="h-5 w-5" />} right={<Button variant="ghost" size="icon" aria-label={`Dismiss ${title}`} onClick={() => { update({ dismissedGuidanceIds: [...state.dismissedGuidanceIds, id] }); track("contextual_guidance_dismissed", { id }); }}><X className="h-4 w-4" /></Button>} />;
}

export function MobileReturningBriefing({ notifications = [] }: { notifications?: PersistedNotification[] }) {
  const navigate = useNavigate();
  const game = useGameData();
  const { state, update } = useMobileOnboardingState();
  const segment = getPlayerSegment(game, state);
  const items = notifications.filter((n) => !n.read_at).slice(0, 4);
  if (!segment.includes("returning") || state.lastBriefingDismissedAt || items.length === 0) return null;
  return <section className="rm-mcard border-amber-400/40 bg-amber-400/5 p-4" aria-labelledby="briefing-title"><div className="flex justify-between gap-2"><div><h2 id="briefing-title" className="font-bold">Welcome back</h2><p className="text-xs text-muted-foreground">Since You Were Away · Needs Attention · Coming Up</p></div><Button variant="ghost" size="icon" aria-label="Dismiss welcome back briefing" onClick={() => update({ lastBriefingDismissedAt: new Date().toISOString() })}><X className="h-4 w-4" /></Button></div><div className="mt-3 space-y-2">{items.map((n) => <MCard key={n.id} title={n.title} subtitle={n.message} onPress={() => { track("returning_briefing_item_opened", { category: n.category }); navigate(n.action_path || "/mobile/social/notifications"); }} />)}</div></section>;
}

export function MobileNotificationGroups({ notifications, onOpen }: { notifications: PersistedNotification[]; onOpen: (n: PersistedNotification) => void }) {
  const groups = groupMobileNotifications(notifications);
  if (!groups.length) return <EmptyState title="All caught up" message="Actionable social, career, world, progress and system updates will appear here." />;
  return <div className="space-y-4">{groups.map(([group, items]) => <section key={group}><h2 className="mb-2 px-1 text-[15px] font-bold">{group}</h2><div className="space-y-2">{items.map((n) => <MCard key={n.id} title={n.title} subtitle={`${n.message} · ${new Date(n.created_at).toLocaleString()}`} icon={<Bell className="h-5 w-5" />} right={!n.read_at ? <span className="rounded-full bg-primary px-2 py-1 text-[10px] text-primary-foreground">New</span> : null} chevron onPress={() => onOpen(n)} />)}</div></section>)}</div>;
}

export function MobileBlockedActionSheet({ kind, open, onOpenChange }: { kind: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const copy = getBlockedActionCopy(kind);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className="rounded-t-2xl"><SheetHeader><SheetTitle>{copy.title}</SheetTitle></SheetHeader><p className="mt-3 text-sm text-muted-foreground">{copy.explanation}</p><ul className="mt-3 list-disc pl-5 text-sm">{copy.requirements.map((r) => <li key={r}>{r}</li>)}</ul><div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={() => { track("blocker_resolution_opened", { kind }); navigate(copy.to); }}>{copy.action}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div></SheetContent></Sheet>;
}

export function MobileHelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const terms = ["Fame", "Popularity", "Reputation", "Chemistry", "Cohesion", "Readiness", "Quality", "Mood", "Stress", "Energy", "Producer", "Royalty Split"];
  const filtered = terms.filter((t) => t.toLowerCase().includes(q.toLowerCase()));
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl"><SheetHeader><SheetTitle>Mobile Help & Glossary</SheetTitle></SheetHeader><input aria-label="Search glossary" value={q} onChange={(e) => setQ(e.target.value)} className="mt-3 min-h-11 w-full rounded-xl border bg-background px-3" placeholder="Search terms" /><div className="mt-3 grid gap-2">{["Getting Started", "Career", "Social", "World", "Character", "Activities", "Economy", "Common Problems"].map((c) => <MCard key={c} title={c} subtitle="Concise mobile guidance using existing game terminology." icon={<BookOpen className="h-5 w-5" />} />)}</div><h3 className="mt-4 font-bold">Glossary</h3>{filtered.map((t) => <p key={t} className="border-b py-2 text-sm"><b>{t}</b>: A RockMundo game term explained in context without changing rules.</p>)}</SheetContent></Sheet>;
}

export function MobileInstallPrompt({ force = false }: { force?: boolean }) {
  const { state, update } = useMobileOnboardingState();
  const [prompt, setPrompt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  useEffect(() => { const h = (e: Event) => { e.preventDefault(); setPrompt(e); }; window.addEventListener("beforeinstallprompt", h as any); setIos(/iphone|ipad|ipod/i.test(navigator.userAgent)); return () => window.removeEventListener("beforeinstallprompt", h as any); }, []);
  const installed = window.matchMedia?.("(display-mode: standalone)").matches;
  const eligible = force || (!installed && (prompt || ios) && state.mobileSessionCount > 1 && !state.installDismissedAt);
  if (!eligible) return null;
  return <MCard title="Install RockMundo" subtitle="Quicker access, standalone app-like window and easier return to active activities where supported." icon={<Download className="h-5 w-5" />}><p className="text-sm text-muted-foreground">RockMundo remains an online MMO; this does not add native push notifications or offline gameplay.</p>{ios ? <ol className="mt-2 list-decimal pl-5 text-sm"><li>Open Share.</li><li>Select Add to Home Screen.</li><li>Confirm.</li></ol> : null}<div className="mt-3 grid grid-cols-2 gap-2"><Button disabled={!prompt && !ios} onClick={async () => { track("install_prompt_accepted"); await prompt?.prompt?.(); }}>Install</Button><Button variant="outline" onClick={() => { update({ installDismissedAt: new Date().toISOString() }); track("install_prompt_dismissed"); }}>Later</Button></div></MCard>;
}

export function MobileUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => { navigator.serviceWorker?.getRegistration().then((r) => { if (r?.waiting) setWaiting(r); }); }, []);
  if (!waiting) return null;
  return <MCard title="Update ready" subtitle="A new RockMundo version is ready. Update when you are not submitting a form or booking." icon={<RefreshCw className="h-5 w-5" />}><div className="grid grid-cols-2 gap-2"><Button onClick={() => waiting.waiting?.postMessage({ type: "SKIP_WAITING" })}>Update Now</Button><Button variant="outline" onClick={() => setWaiting(null)}>Later</Button></div></MCard>;
}

export function MobileOfflineState() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  if (online) return null;
  return <MCard title="You are offline" subtitle="RockMundo gameplay needs a connection. Last visible shell remains for navigation only." icon={<WifiOff className="h-5 w-5" />} right={<ShieldAlert className="h-4 w-4 text-amber-500" />} />;
}
