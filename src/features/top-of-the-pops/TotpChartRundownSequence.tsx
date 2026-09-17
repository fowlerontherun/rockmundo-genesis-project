import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronRight, Minus, Radio, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TotpChartRundown, TotpChartRundownEntry } from "./chartRundownApi";
import { buildTotpChartRundownPages } from "./chartRundown";
import { resolveTotpPresenter } from "./presenters";
import { TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";

const PAGE_DURATION_MS = 5_000;

export interface TotpChartRundownSequenceProps {
  rundown: TotpChartRundown;
  autoPlay?: boolean;
  presenterKey?: string | null;
  onEnded?: () => void;
}

function trendLabel(entry: TotpChartRundownEntry) {
  const trend = (entry.trend ?? "").toLowerCase();
  if (trend === "up" || (entry.trend_change ?? 0) > 0) {
    return { icon: TrendingUp, label: entry.trend_change ? `Up ${Math.abs(entry.trend_change)}` : "Up" };
  }
  if (trend === "down" || (entry.trend_change ?? 0) < 0) {
    return { icon: TrendingDown, label: entry.trend_change ? `Down ${Math.abs(entry.trend_change)}` : "Down" };
  }
  if (trend === "new") return { icon: Radio, label: "New" };
  return { icon: Minus, label: "No change" };
}

function formatActivity(value: number) {
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function TotpChartRundownSequence({ rundown, autoPlay = false, presenterKey = "alex_rayne", onEnded }: TotpChartRundownSequenceProps) {
  const pages = useMemo(() => buildTotpChartRundownPages(rundown), [rundown]);
  const [pageIndex, setPageIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const page = pages[pageIndex] ?? null;
  const presenter = resolveTotpPresenter(presenterKey);

  const advance = useCallback(() => {
    if (pageIndex >= pages.length - 1) {
      onEnded?.();
      return;
    }
    setElapsedMs(0);
    setPageIndex((index) => Math.min(pages.length - 1, index + 1));
  }, [onEnded, pageIndex, pages.length]);

  useEffect(() => {
    if (!autoPlay || !page || pageIndex !== 0 || typeof window === "undefined") return;
    const recordedUrl = totpMediaPublicUrl(TOTP_MEDIA_PATHS.presenter(presenter.key, "chart"));
    let cancelled = false;
    let recorded: HTMLAudioElement | null = null;
    const fallback = () => {
      if (cancelled || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance("And now, let's take a look at this week's UK charts.");
      utterance.rate = 0.98;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((voice) => /en-GB/i.test(voice.lang)) ?? voices.find((voice) => /^en/i.test(voice.lang));
      if (preferred) utterance.voice = preferred;
      window.speechSynthesis.speak(utterance);
    };
    void fetch(recordedUrl, { method: "HEAD" })
      .then((response) => {
        if (!response.ok || cancelled) { fallback(); return; }
        recorded = new Audio(recordedUrl);
        recorded.volume = 0.95;
        void recorded.play().catch(fallback);
      })
      .catch(fallback);
    return () => {
      cancelled = true;
      recorded?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [autoPlay, page, pageIndex, presenter.key]);

  useEffect(() => {
    if (!autoPlay || !page) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const nextElapsed = Math.min(PAGE_DURATION_MS, performance.now() - startedAt);
      setElapsedMs(nextElapsed);
      if (nextElapsed >= PAGE_DURATION_MS) {
        window.clearInterval(timer);
        queueMicrotask(advance);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [advance, autoPlay, page]);

  if (!page) {
    return (
      <section className="rounded-xl border bg-card p-6 text-center" data-totp-chart-rundown="empty">
        <BarChart3 className="mx-auto h-7 w-7 text-muted-foreground" />
        <h3 className="mt-3 font-semibold">No frozen UK chart positions</h3>
        <p className="mt-1 text-sm text-muted-foreground">This episode has no eligible Streaming or Digital Sales rows to present.</p>
        <Button className="mt-4" size="sm" onClick={onEnded}>Back to the studio <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </section>
    );
  }

  const isFinalPage = pageIndex === pages.length - 1;
  const pageProgress = Math.min(100, elapsedMs / PAGE_DURATION_MS * 100);
  const snapshotLabel = rundown.chart_snapshot_date
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(`${rundown.chart_snapshot_date}T12:00:00Z`))
    : "locked episode snapshot";

  return (
    <section className="overflow-hidden rounded-xl border border-cyan-400/25 bg-slate-950 text-white shadow-2xl" data-totp-chart-rundown={page.chartType}>
      <div className="relative min-h-[31rem] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.2),transparent_30%)] p-5 md:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
              <Radio className="h-4 w-4" /> Top of the Pops chart rundown
            </div>
            <h3 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{page.chartLabel}</h3>
            <p className="mt-2 text-sm text-white/60">Positions {page.rangeLabel} · frozen {snapshotLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">Page {pageIndex + 1} of {pages.length}</Badge>
            <Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">{page.sourceCount} of 40 real positions</Badge>
          </div>
        </div>

        <div className="mt-8 grid gap-2">
          {page.entries.map((entry) => {
            const trend = trendLabel(entry);
            const TrendIcon = trend.icon;
            return (
              <div
                key={`${page.chartType}:${entry.rank}:${entry.song_id ?? entry.song_title}`}
                className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2.5 md:grid-cols-[4.5rem_minmax(0,1fr)_8rem_6rem] ${entry.rank === 1 ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/[0.06]"}`}
              >
                <div className={`text-2xl font-black tabular-nums ${entry.rank === 1 ? "text-amber-200" : "text-white"}`}>#{entry.rank}</div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{entry.artist_name}</div>
                  <div className="truncate text-sm text-white/55">{entry.song_title}</div>
                </div>
                <div className="hidden items-center gap-1.5 text-xs text-white/60 md:flex">
                  <TrendIcon className="h-3.5 w-3.5" /> {trend.label}
                </div>
                <div className="hidden text-right text-xs text-white/55 md:block">{formatActivity(entry.weekly_plays)} weekly</div>
              </div>
            );
          })}
        </div>

        {page.sourceCount < 40 ? (
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-white/55">
            Only {page.sourceCount} real song{page.sourceCount === 1 ? " exists" : "s exist"} in this locked UK chart snapshot. Unfilled positions are deliberately omitted rather than populated with fake artists.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-black/40 px-4 py-3">
        <Progress value={autoPlay ? pageProgress : ((pageIndex + 1) / pages.length) * 100} className="h-1.5 min-w-40 flex-1 bg-white/10" />
        {!autoPlay ? (
          <Button size="sm" variant="secondary" onClick={advance}>
            {isFinalPage ? "Back to studio" : "Next chart page"} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <span className="text-xs text-white/50">{isFinalPage ? "Returning to the studio…" : "Next chart page…"}</span>
        )}
      </div>
    </section>
  );
}

export default TotpChartRundownSequence;
