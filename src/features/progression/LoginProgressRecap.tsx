import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Award, ChevronUp, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useIsMobileDevice } from "@/hooks/useIsMobileDevice";
import { supabase } from "@/integrations/supabase/client";
import { getSkillBySlug } from "@/utils/skillCatalogue";
import { buildLoginProgressView, type LoginProgressClaim, type SkillChange } from "./loginProgressSummary";

const format = (value: number) => value.toLocaleString();

// Supabase keeps the same session_id across access-token refreshes.
function authSessionId(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  try {
    const encoded = accessToken.split(".")[1];
    if (!encoded) return null;
    const claims = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    return typeof claims.session_id === "string" && claims.session_id ? claims.session_id : null;
  } catch {
    return null;
  }
}

function SkillRow({ skill, showChange }: { skill: SkillChange; showChange: boolean }) {
  const label = getSkillBySlug(skill.slug)?.name
    ?? skill.slug.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const levels = skill.currentLevel - skill.previousLevel;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3" data-testid="login-skill-progress">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{label}</p>
          <p className="text-[11px] text-zinc-400">
            {skill.requiredXp > 0 ? `${format(skill.currentXp)} / ${format(skill.requiredXp)} XP to next level` : "Maximum mastery reached"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold tabular-nums">Lv {skill.currentLevel}</span>
          {showChange && levels > 0 && (
            <span className="ml-2 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              +{levels} {levels === 1 ? "level" : "levels"}
            </span>
          )}
          {showChange && levels <= 0 && skill.xpGained > 0 && (
            <span className="ml-2 text-xs font-semibold text-emerald-300">+{format(skill.xpGained)} XP</span>
          )}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar"
        aria-label={`${label} progress to next level`} aria-valuenow={skill.percent}
        aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-400 to-cyan-400 transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${skill.percent}%` }} />
      </div>
    </div>
  );
}

/** A server-claimed, once-per-authentication progress recap on desktop and mobile. */
export function LoginProgressRecap() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { profileId } = useActiveProfile();
  const isMobile = useIsMobileDevice();
  const sessionId = useMemo(() => authSessionId(session?.access_token), [session?.access_token]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { data } = useQuery<LoginProgressClaim>({
    queryKey: ["login-progress-recap", user?.id, profileId, sessionId],
    enabled: Boolean(user && profileId && sessionId),
    queryFn: async () => {
      if (!profileId) throw new Error("No active character");
      // The generated Supabase types will include this RPC after the migration.
      const client = supabase as unknown as {
        rpc: (name: "claim_login_progress_summary", args: { p_profile_id: string }) => Promise<{
          data: LoginProgressClaim | null; error: Error | null;
        }>;
      };
      const { data: claim, error } = await client.rpc("claim_login_progress_summary", { p_profile_id: profileId });
      if (error) throw error;
      if (!claim) throw new Error("Missing login progress summary");
      return claim;
    },
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false,
  });
  const summary = useMemo(() => data?.show ? buildLoginProgressView(data) : null, [data]);
  const seenKey = data?.show ? `rockmundo:login-recap:${profileId}:${data.session_id}` : null;
  const seen = seenKey ? window.sessionStorage.getItem(seenKey) === "seen" : true;
  const open = Boolean(data?.show && summary && seenKey && !seen && !dismissed.includes(seenKey));
  const dismiss = () => {
    if (!seenKey) return;
    window.sessionStorage.setItem(seenKey, "seen");
    setDismissed((keys) => [...keys, seenKey]);
  };
  const viewSkills = () => { dismiss(); navigate(isMobile ? "/mobile/progression" : "/skills"); };
  if (!data?.show || !summary) return null;

  const first = data.first_login;
  const showSkillChange = !first && summary.skillsImproved > 0;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent aria-describedby="login-progress-description"
        className="max-h-[min(92dvh,800px)] w-[calc(100vw-1.25rem)] max-w-[570px] gap-0 overflow-y-auto overflow-x-hidden rounded-[22px] border border-violet-400/25 bg-[#0c0b18] p-0 text-white shadow-[0_26px_100px_rgba(5,2,20,0.7)] sm:rounded-[28px] [&>button]:right-4 [&>button]:top-4 [&>button]:z-10 [&>button]:text-white/70">
        <div className="relative overflow-hidden border-b border-white/10 px-5 pb-6 pt-8 sm:px-7 sm:pb-7 sm:pt-10">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-fuchsia-600/25 blur-[75px]" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-52 w-52 rounded-full bg-cyan-500/15 blur-[75px]" />
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">
              <Sparkles className="h-3.5 w-3.5" /> RockMundo Progress
            </div>
            <DialogTitle className="font-oswald text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              {first ? "Your progress at a glance" : summary.hasGains ? "Look how far you've come" : "Welcome back, rockstar"}
            </DialogTitle>
            <DialogDescription id="login-progress-description" className="mt-2 max-w-md text-sm leading-relaxed text-zinc-300">
              {first
                ? "Here's where your character stands today. We'll track what you earn and learn between logins."
                : summary.hasGains
                  ? "Your character has been moving up. Here's what changed since your last login."
                  : "You're all caught up since your last login. Your next breakthrough is waiting."}
            </DialogDescription>

            <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-cyan-500/10 px-5 py-5 sm:px-6">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
                <Zap className="h-4 w-4 text-amber-300" /> {first ? "Lifetime XP" : "XP gained since last login"}
              </p>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <span className="font-oswald text-5xl font-bold leading-none tracking-tight tabular-nums text-white sm:text-6xl" data-testid="login-xp-gained">
                  {first ? format(summary.currentTotalXp) : `+${format(summary.xpGained)}`}
                </span>
                <span className="pb-1 text-base font-extrabold text-fuchsia-200">XP</span>
              </div>
              {!first && <p className="mt-2 text-xs text-zinc-300">{format(summary.currentTotalXp)} lifetime XP earned in total</p>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-300"><Award className="h-4 w-4 text-amber-300" /> Character level</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-oswald text-3xl font-bold tabular-nums">{summary.currentLevel}</span>
                  {summary.levelGained > 0 && <span className="text-xs font-bold text-emerald-300"><ChevronUp className="inline h-3 w-3" />+{summary.levelGained}</span>}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-300"><TrendingUp className="h-4 w-4 text-cyan-300" /> {first ? "Skills unlocked" : "Skills improved"}</div>
                <p className="mt-1 font-oswald text-3xl font-bold tabular-nums">{first ? summary.unlockedSkills : summary.skillsImproved}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-6 pt-5 sm:px-7 sm:pb-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-oswald text-lg font-semibold uppercase tracking-wide text-white">
              {showSkillChange ? "Your skill gains" : "Your skills right now"}
            </h3>
            {summary.featuredSkills.length > 0 && <span className="text-[11px] text-zinc-400">Top {summary.featuredSkills.length}</span>}
          </div>
          {summary.featuredSkills.length > 0 ? (
            <div className="space-y-2">{summary.featuredSkills.map(
              (skill) => <SkillRow key={skill.slug} skill={skill} showChange={showSkillChange} />,
            )}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.035] p-5 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-violet-300" />
              <p className="text-sm font-semibold">Your skills are ready to grow</p>
              <p className="mt-1 text-xs text-zinc-400">Try a course, practice session or skill upgrade to get started.</p>
            </div>
          )}
          {summary.skillsImproved > 5 && showSkillChange && <p className="mt-3 text-center text-xs text-zinc-400">+{summary.skillsImproved - 5} more improved skills</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={dismiss} className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">Continue playing</Button>
            <Button onClick={viewSkills} className="bg-fuchsia-500 font-semibold text-white hover:bg-fuchsia-600">
              View your skills <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
