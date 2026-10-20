import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import './game-art.css';

const PALETTES = [
  ['#24163f', '#c6a0ff', '#edb76c'],
  ['#112e36', '#73d3cb', '#edc287'],
  ['#362037', '#f3a0c0', '#a9b7ff'],
  ['#302719', '#e6c37c', '#a9d8c6'],
] as const;

export function artworkPalette(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const [background, accent, highlight] = PALETTES[hash % PALETTES.length];
  return { '--art-bg': background, '--art-accent': accent, '--art-highlight': highlight } as CSSProperties;
}

/** Failed artwork remains decorative; it must never hide a card's content or actions. */
export function ArtworkImage({ src, fallback, className }: { src?: string | null; fallback?: string; className?: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const active = [src, fallback].find((url): url is string => !!url && !failed.includes(url));
  return active ? <img src={active} alt="" aria-hidden="true" loading="lazy" decoding="async" className={className} onError={() => setFailed(previous => [...previous, active])} /> : null;
}

/** These are illustrated covers, not external videos or invented learning content. */
export function LearningArtwork({ kind, id, title, subject }: {
  kind: 'book' | 'video' | 'mentor'; id: string; title: string; subject?: string | null;
}) {
  return <div className={cn('learning-art', `learning-art--${kind}`)} style={artworkPalette(subject || id)} aria-hidden="true">
    <div className="learning-art__lines" />
    {kind === 'book' ? <div className="learning-art__book">
      <span className="learning-art__imprint">ROCKMUNDO / FIELD NOTES</span>
      <span className="learning-art__title">{title}</span>
      <svg viewBox="0 0 140 32" className="learning-art__wave" focusable="false"><path d="M0 16h16l6-9 8 20 9-25 9 29 8-18 7 3h14l6-9 8 20 8-25 8 29 8-18 7 3h18" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      <span className="learning-art__subject">{subject || 'Music & craft'}</span>
    </div> : kind === 'video' ? <>
      <div className="learning-art__video-copy"><span className="learning-art__imprint">ROCKMUNDO LESSONS</span><span className="learning-art__title">{subject || title}</span></div>
      <span className="learning-art__play"><svg viewBox="0 0 32 32" focusable="false"><path d="M12 7 26 16 12 25Z" fill="currentColor" /></svg></span>
    </> : <>
      <svg viewBox="0 0 120 120" className="learning-art__portrait" focusable="false">
        <circle cx="60" cy="60" r="57" fill="var(--art-accent)" opacity=".14" />
        <path d="M17 120v-12c0-24 19-37 43-37s43 13 43 37v12" fill="var(--art-accent)" />
        <path d="m42 80 18 22 18-22-8-11H50Z" fill="var(--art-highlight)" />
        <ellipse cx="60" cy="46" rx="23" ry="29" fill="var(--art-highlight)" />
        <path d="M36 48c-6-37 38-48 49-15l-1 13-9-21c-6 15-25 15-39 23Z" fill="var(--art-bg)" />
        <path d="M45 48h11m8 0h11m-19 0h8" stroke="var(--art-bg)" strokeWidth="3" />
      </svg>
      <div className="learning-art__mentor-copy"><span className="learning-art__imprint">MENTOR</span><span className="learning-art__title">{subject || 'Music & craft'}</span></div>
    </>}
  </div>;
}

export function FestivalPoster({ id, title, location, date, status }: { id: string; title: string; location: string; date: string; status?: string | null }) {
  return <div className="festival-poster" style={artworkPalette(id)}>
    <ArtworkImage src="/hub-tiles/festivals.png" className="festival-poster__image" />
    <div className="festival-poster__shade" />
    <div className="festival-poster__content">
      <div className="festival-poster__eyebrow"><span>ROCKMUNDO / FESTIVALS</span>{status && <span>{status.replaceAll('_', ' ')}</span>}</div>
      <h3 className="festival-poster__title">{title}</h3>
      <div className="festival-poster__details"><span>{location}</span><span>{date}</span></div>
    </div>
  </div>;
}

const NEWS_ART: Record<string, string> = {
  Charts: 'music-charts', Release: 'release-manager', Festival: 'festivals',
  Gig: 'gig-booking', Award: 'awards', Milestone: 'band',
};
export function NewsArtwork({ category }: { category: string }) {
  return <div className="news-art" style={artworkPalette(category)} aria-hidden="true">
    <ArtworkImage src={`/hub-tiles/${NEWS_ART[category] || 'band'}.png`} className="h-full w-full object-cover" />
  </div>;
}
