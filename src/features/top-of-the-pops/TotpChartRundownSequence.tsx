import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronRight, Minus, Radio, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import type { TotpChartRundown, TotpChartRundownEntry } from "./chartRundownApi";
import type { TotpPresenterFragmentBundle } from "./api";
import { buildTotpChartRundownPages } from "./chartRundown";
import { resolveTotpPresenter } from "./presenters";
import { playTotpPresenterLine, type TotpPresenterRecordedClip } from "./presenterVoice";
import { TOTP_MEDIA_BUCKET, TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";
import { totpChartPositionScript } from "./chartPositionAudio";
import { useTotpContinuityAudienceAudio } from "./useTotpAudienceAudio";

const PAGE_VISUAL_MINIMUM_MS = 6_000;

export interface TotpChartRundownSequenceProps {
  rundown: TotpChartRundown;
  autoPlay?: boolean;
  presenterKey?: string | null;
  recordedUrl?: string | null;
  presenterFragments?: TotpPresenterFragmentBundle | null;
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

export function TotpChartRundownSequence({ rundown, autoPlay = false, presenterKey = "alex_rayne", recordedUrl = null, presenterFragments = null, onEnded }: TotpChartRundownSequenceProps) {
  const pages = useMemo(() => buildTotpChartRundownPages(rundown), [rundown]);
  const [pageIndex, setPageIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pageVisualComplete, setPageVisualComplete] = useState(false);
  const [pageNarrationComplete, setPageNarrationComplete] = useState(false);
  const [chartPositionPaths, setChartPositionPaths] = useState<Map<number, string>>(new Map());
  const advanceGuardRef = useRef(false);
  const page = pages[pageIndex] ?? null;
  const presenter = resolveTotpPresenter(presenterKey);
  useTotpContinuityAudienceAudio({
    active: autoPlay && !!page,
    seed: `chart:${page?.id ?? "none"}:${pageIndex}`,
    intensity: page?.minRank === 1 ? 6 : 3,
  });
  const pageDurationMs = Math.max(PAGE_VISUAL_MINIMUM_MS, (page?.entries.length ?? 0) * 2_300 + (pageIndex === 0 ? 3_500 : 0));

  useEffect(() => {
    let active = true;
    const folder = TOTP_MEDIA_PATHS.chartPositionFolder(presenter.key);
    void supabase.storage.from(TOTP_MEDIA_BUCKET).list(folder, { limit: 200 }).then(({ data, error }) => {
      if (!active || error) return;
      const newest = new Map<number, { path: string; stamp: number }>();
      for (const item of data ?? []) {
        const match = /^(\d+)-([a-f0-9]{8,64})\.(mp3|wav|ogg|webm|m4a|mp4)$/i.exec(item.name);
        if (!match) continue;
        const rank = Number(match[1]);
        if (!Number.isInteger(rank) || rank < 1 || rank > 40) continue;
        const stamp = Date.parse(item.created_at ?? item.updated_at ?? "") || 0;
        const current = newest.get(rank);
        if (!current || stamp >= current.stamp) newest.set(rank, { path: `${folder}/${item.name}`, stamp });
      }
      setChartPositionPaths(new Map([...newest.entries()].map(([rank, value]) => [rank, value.path])));
    });
    return () => { active = false; };
  }, [presenter.key]);

  const pageRecordedSequence = useMemo<TotpPresenterRecordedClip[]>(() => {
    if (!page) return [];
    const clips: TotpPresenterRecordedClip[] = [];
    if (pageIndex === 0) {
      clips.push({
        url: recordedUrl || totpMediaPublicUrl(TOTP_MEDIA_PATHS.presenter(presenter.key, "chart")),
        gapAfterMs: 180,
      });
    }
    for (const entry of page.entries) {
      const positionPath = chartPositionPaths.get(entry.rank);
      if (positionPath) clips.push({ url: totpMediaPublicUrl(positionPath), gapAfterMs: 85 });
      const bandAsset = entry.band_id ? presenterFragments?.bands?.[entry.band_id] : null;
      if (bandAsset?.audio_url) clips.push({ url: bandAsset.audio_url, gapAfterMs: 180 });
    }
    return clips;
  }, [chartPositionPaths, page, pageIndex, presenter.key, presenterFragments, recordedUrl]);

  const advance = useCallback(() => {
    if (advanceGuardRef.current) return;
    advanceGuardRef.current = true;
    if (pageIndex >= pages.length - 1) {
      onEnded?.();
      return;
    }
    setElapsedMs(0);
    setPageVisualComplete(false);
    setPageIndex((index) => Math.min(pages.length - 1, index + 1));
  }, [onEnded, pageIndex, pages.length]);

  useEffect(() => {
    advanceGuardRef.current = false;
    setPageVisualComplete(false);
    setPageNarrationComplete(false);
  }, [pageIndex]);

  useEffect(() => {
    if (!autoPlay || !page || typeof window === "undefined") return;
    setPageNarrationComplete(false);
    const fallback = [
      pageIndex === 0 ? "And now, let's take a look at this week's UK charts." : "",
      ...page.entries.map((entry) => `${totpChartPositionScript(entry.rank)} ${entry.artist_name}.`),
    ].filter(Boolean).join(" ");
    const line = playTotpPresenterLine({
      text: fallback,
      presenterKey: presenter.key,
      recordedSequence: pageRecordedSequence.length ? pageRecordedSequence : null,
      volume: 0.95,
      onEnded: () => setPageNarrationComplete(true),
    });
    const safety = window.setTimeout(() => setPageNarrationComplete(true), 45_000);
    return () => {
      window.clearTimeout(safety);
      line.stop();
    };
  }, [autoPlay, page, pageIndex, pageRecordedSequence, presenter.key]);

  useEffect(() => {
    if (!autoPlay || !page) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const nextElapsed = Math.min(pageDurationMs, performance.now() - startedAt);
      setElapsedMs(nextElapsed);
      if (nextElapsed >= pageDurationMs) {
        window.clearInterval(timer);
        setPageVisualComplete(true);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [autoPlay, page, pageDurationMs, pageIndex]);

  useEffect(() => {
    if (!autoPlay || !pageVisualComplete) return;
    if (!pageNarrationComplete) return;
    queueMicrotask(advance);
  }, [advance, autoPlay, pageNarrationComplete, pageVisualComplete]);

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
  const pageProgress = Math.min(100, elapsedMs / pageDurationMs * 100);
  const snapshotLabel = rundown.chart_snapshot_date
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(`${rundown.chart_snapshot_date}T12:00:00Z`))
    : "locked episode snapshot";

  return (
    <section className="mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-cyan-400/25 bg-slate-950 text-white shadow-2xl" data-totp-chart-rundown={page.chartType}>
      <div className="relative h-[calc(100%_-_3.25rem)] overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.2),transparent_30%)] p-4 md:p-6">
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

        <div className="mt-5 grid gap-1.5">
          {page.entries.map((entry) => {
            const trend = trendLabel(entry);
            const TrendIcon = trend.icon;
            return (
              <div
                key={`${page.chartType}:${entry.rank}:${entry.song_id ?? entry.song_title}`}
                className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2 md:grid-cols-[4.5rem_minmax(0,1fr)_8rem_6rem] ${entry.rank === 1 ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/[0.06]"}`}
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
