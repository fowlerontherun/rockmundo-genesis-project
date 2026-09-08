import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Expand, Loader2, Pause, Play, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { ConcertScene } from './ConcertScene';
import { DEFAULT_SETTINGS, DEMO_DURATION, LOOKS, SHOTS, songSection, type DemoSettings, type DemoStats, type LightingLook } from './config';
import './concert-demo.css';

export default function Concert3DDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLElement>(null);
  const engine = useRef<ConcertScene | null>(null);
  const [settings, setSettings] = useState<DemoSettings>(() => ({ ...DEFAULT_SETTINGS, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
  const latestSettings = useRef(settings);
  latestSettings.current = settings;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState<DemoStats>({ fps: 0, drawCalls: 0, triangles: 0, seconds: 0 });
  const [showStats, setShowStats] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const update = <K extends keyof DemoSettings>(key: K, value: DemoSettings[K]) => setSettings(previous => ({ ...previous, [key]: value }));

  useEffect(() => {
    let active = true;
    setState('loading'); setMessage('');
    try {
      engine.current = new ConcertScene(canvas.current!, latestSettings.current, value => { if (active) setStats(value); }, (value, detail = '') => { if (active) { setState(value); setMessage(detail); } });
    } catch {
      setState('error'); setMessage('This browser could not start the 3D scene. Enable hardware acceleration or try another browser, then retry.');
    }
    return () => { active = false; engine.current?.destroy(); engine.current = null; };
  }, [attempt]);
  useEffect(() => { engine.current?.setSettings(settings); }, [settings]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSettings(previous => ({ ...previous, reducedMotion: media.matches }));
    const onFullscreen = () => setFullscreen(document.fullscreenElement === stage.current);
    media.addEventListener('change', change); document.addEventListener('fullscreenchange', onFullscreen);
    return () => { media.removeEventListener('change', change); document.removeEventListener('fullscreenchange', onFullscreen); };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
      setMessage('');
    } catch { setMessage('Fullscreen is unavailable here. You can still use every camera in the embedded view.'); }
  }
  const elapsed = Math.floor(stats.seconds % DEMO_DURATION);

  return <main className="concert-demo">
    <header className="concert-demo__header">
      <div>
        <Link className="concert-demo__back" to="/admin/gig-viewer-demo"><ArrowLeft size={14} /> Gig viewer</Link>
        <div className="concert-demo__title"><h1>3D Concert Demo</h1><span className="concert-demo__badge">ADMIN PREVIEW</span></div>
        <p>A late-night set at The Live Room. Take a seat, or step on stage.</p>
      </div>
      <span className="concert-demo__fixture">Local demo · fictional band</span>
    </header>

    <section className="concert-demo__experience" ref={stage} aria-label="Interactive concert preview">
      <div className="concert-demo__viewport">
        <canvas ref={canvas} className="concert-demo__canvas" aria-label="3D club with a four-piece band, stage lighting and an animated audience" aria-describedby="concert-scene-description" />
        <div className="concert-demo__topline" aria-hidden="true"><span><i /> THE LIVE ROOM</span><span>CLUB SESSION / 001</span></div>
        <div className="concert-demo__scene-caption" aria-hidden="true"><span>NEON HOURS</span><strong>{songSection(stats.seconds)}</strong></div>
        <p id="concert-scene-description" className="sr-only">An original club scene with a vocalist, guitarist, bassist and drummer. Camera buttons change your viewpoint. Lighting, audience and motion controls are below the preview. This is a silent visual demo using fictional performers.</p>

        {state !== 'ready' && <div className="concert-demo__overlay" role={state === 'error' ? 'alert' : 'status'}>
          {state === 'loading' ? <><Loader2 size={28} className="concert-demo__spinner" /><h2>Setting the stage</h2><p>Loading the band, materials and lights…</p></> : <><h2>The scene needs a restart</h2><p>{message}</p><button className="concert-demo__primary" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={16} /> Retry 3D demo</button></>}
        </div>}
        {showStats && state === 'ready' && <output className="concert-demo__stats" aria-label="Rendering performance">{stats.fps || '—'} FPS · {stats.drawCalls} draws · {(stats.triangles / 1000).toFixed(0)}k triangles</output>}
      </div>

      <div className="concert-demo__transport">
        <div className="concert-demo__playback">
          <button className="concert-demo__play" aria-label={settings.playing ? 'Pause performance' : 'Play performance'} disabled={state !== 'ready'} onClick={() => update('playing', !settings.playing)}>{settings.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
          <button className="concert-demo__icon" aria-label="Restart performance" disabled={state !== 'ready'} onClick={() => { engine.current?.restart(); setStats(previous => ({ ...previous, seconds: 0 })); }}><RotateCcw size={17} /></button>
          <span className="concert-demo__time">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} <span>/ 1:36</span></span>
          <span className="concert-demo__silent">Visual demo</span>
        </div>
        <div className="concert-demo__cameras" role="group" aria-label="Camera viewpoint"><Camera size={16} aria-hidden="true" />{SHOTS.map(shot => <button key={shot.id} aria-pressed={settings.camera === shot.id} onClick={() => update('camera', shot.id)}>{shot.label}</button>)}</div>
        {document.fullscreenEnabled && <button className="concert-demo__icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <X size={18} /> : <Expand size={18} />}</button>}
      </div>
      <progress className="concert-demo__progress" max={DEMO_DURATION} value={stats.seconds % DEMO_DURATION} aria-label="Demo performance progress" />

      <div className="concert-demo__controls">
        <div className="concert-demo__control concert-demo__looks"><label htmlFor="concert-look">LIGHTING</label><select id="concert-look" value={settings.look} onChange={event => update('look', event.target.value as LightingLook)}>{Object.entries(LOOKS).map(([id, look]) => <option key={id} value={id}>{look.name}</option>)}</select></div>
        <div className="concert-demo__control"><label htmlFor="concert-energy">PERFORMANCE <span>{Math.round(settings.energy * 100)}%</span></label><input id="concert-energy" type="range" min="0" max="100" step="1" value={settings.energy * 100} onChange={event => update('energy', Number(event.target.value) / 100)} /></div>
        <div className="concert-demo__control"><label htmlFor="concert-crowd">CROWD <span>{Math.round(settings.crowd * 100)}%</span></label><input id="concert-crowd" type="range" min="0" max="100" step="1" value={settings.crowd * 100} onChange={event => update('crowd', Number(event.target.value) / 100)} /></div>
        <div className="concert-demo__checks"><label><input type="checkbox" checked={settings.haze} onChange={event => update('haze', event.target.checked)} /> Stage haze</label><label><input type="checkbox" checked={settings.reducedMotion} onChange={event => update('reducedMotion', event.target.checked)} /> Reduced motion</label></div>
        <div className="concert-demo__control"><label htmlFor="concert-quality">QUALITY</label><select id="concert-quality" value={settings.quality} onChange={event => update('quality', event.target.value as DemoSettings['quality'])}><option value="balanced">Balanced</option><option value="high">High detail</option></select></div>
      </div>
    </section>

    <footer className="concert-demo__footer"><p>Four-piece band · textured club · five camera views <span>Local preview. No game records are changed.</span></p><button aria-pressed={showStats} onClick={() => setShowStats(value => !value)}><SlidersHorizontal size={14} /> Performance stats</button></footer>
    {message && state !== 'error' && <p className="concert-demo__notice" role="status">{message}</p>}
  </main>;
}
