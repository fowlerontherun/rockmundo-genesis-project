import { artworkPresets, matchesArtworkPreset } from './presets';
import { parseArtworkProject, serializeArtworkProject } from './project';
import { importArtworkImage, loadArtworkImage, MAX_DESIGN_BYTES } from './imageLayer';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { artworkFile, downloadArtworkFile, drawArtwork, newArtworkDesign, type ArtworkDesign, type ArtworkSurface } from './design';

export interface ArtworkDraft { design: ArtworkDesign; surface: ArtworkSurface }

export function ReleaseArtworkDesigner({ title, artist, onUse, onBusyChange, disabled = false, draft, onDraftChange }: { title: string; artist: string; onUse: (file: File) => void | Promise<void>; disabled?: boolean; onBusyChange?: (busy: boolean) => void; draft?: ArtworkDraft; onDraftChange?: (draft: ArtworkDraft) => void }) {
  const [localDraft, setLocalDraft] = useState<ArtworkDraft>(() => ({ design: newArtworkDesign(title, artist), surface: 'cover' }));
  const { design, surface } = draft ?? localDraft;
  const updateDraft = (next: ArtworkDraft) => { setLocalDraft(next); onDraftChange?.(next); };
  const setDesign = (next: ArtworkDesign) => updateDraft({ design: next, surface });
  const setSurface = (next: ArtworkSurface) => updateDraft({ design, surface: next });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<{ url: string; image: HTMLImageElement } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const patch = (value: Partial<ArtworkDesign>) => { setDesign({ ...design, ...value }); setNotice(null); };
  useEffect(() => {
    let active = true;
    setLoadedImage(null);
    if (!design.image) { setImageLoading(false); return; }
    setImageLoading(true);
    loadArtworkImage(design.image).then(image => {
      if (active) { setLoadedImage({ url: design.image!.dataUrl, image }); setError(null); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setImageLoading(false); });
    return () => { active = false; };
  }, [design.image?.dataUrl]);
  useEffect(() => {
    try {
      if (canvas.current) drawArtwork(canvas.current, design, surface, loadedImage?.url === design.image?.dataUrl ? loadedImage?.image : undefined);
    } catch (e) { setError((e as Error).message); }
  }, [design, surface, loadedImage]);
  const importImage = async (file: File) => {
    setBusy(true); onBusyChange?.(true); setError(null);
    try { patch({ image: await importArtworkImage(file) }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); onBusyChange?.(false); }
  };
  const run = async (use: boolean) => {
    setBusy(true); onBusyChange?.(true); setError(null); setNotice(null);
    try {
      const file = await artworkFile(design, surface);
      if (use) { await onUse(file); setNotice('Artwork selected. Save the release to apply it.'); }
      else downloadArtworkFile(file, file.name);
    } catch (e) { setError((e as Error).message || 'Could not create artwork.'); }
    finally { setBusy(false); onBusyChange?.(false); }
  };
  return <section aria-label="Release artwork designer" className="space-y-4 rounded-xl border bg-muted/20 p-4">
    <div><h3 className="font-semibold">Artwork studio</h3><p className="text-xs text-muted-foreground">Create a cover, CD ring or vinyl label using patterns or your own image. Export each design as a 1200px PNG, or use it as your release artwork.</p></div>
    <fieldset disabled={busy || disabled} className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Artwork surface">{(['cover', 'cd', 'vinyl'] as const).map(s => <Button key={s} type="button" size="sm" variant={surface === s ? 'default' : 'outline'} aria-pressed={surface === s} onClick={() => { setSurface(s); setNotice(null); }}>{s === 'cover' ? 'Cover' : s === 'cd' ? 'CD ring' : 'Vinyl'}</Button>)}</div>
      <div className="space-y-2" role="group" aria-label="Artwork styles">
        <p className="text-xs font-medium">Start with a style</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{artworkPresets.map(preset => <Button key={preset.id} type="button" variant={matchesArtworkPreset(design, preset) ? 'default' : 'outline'} aria-pressed={matchesArtworkPreset(design, preset)} className="h-auto justify-start gap-2 whitespace-normal py-2 text-left text-xs" onClick={() => patch(preset.style)}>
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 overflow-hidden rounded border"><span className="w-1/2" style={{ backgroundColor: preset.style.background }} /><span className="w-1/4" style={{ backgroundColor: preset.style.accent }} /><span className="w-1/4" style={{ backgroundColor: preset.style.ink }} /></span>
          {preset.name}
        </Button>)}</div>
        <p className="text-xs text-muted-foreground">Styles change colours, pattern, typeface and vinyl finish. Your text, image and crop stay in place. Adjust any setting below.</p>
      </div>
      <canvas ref={canvas} role="img" aria-label={`${surface} artwork preview: ${design.title}`} className="mx-auto aspect-square w-full max-w-80 rounded-lg border bg-slate-200" />
      <div className="space-y-2 rounded-lg border p-3">
        <label className="text-xs">Your photo or illustration<Input aria-label="Add artwork image" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importImage(file); }} /></label>
        <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 10 MB. The image is embedded in your downloadable design file.</p>
        {design.image && <>
          {(['zoom', 'x', 'y'] as const).map(key => <label key={key} className="block text-xs">{key === 'zoom' ? 'Image zoom' : key === 'x' ? 'Horizontal crop' : 'Vertical crop'}<input aria-label={key === 'zoom' ? 'Image zoom' : key === 'x' ? 'Horizontal crop' : 'Vertical crop'} className="mt-1 block w-full" type="range" min={key === 'zoom' ? 1 : -1} max={key === 'zoom' ? 3 : 1} step="0.01" value={design.image![key]} onChange={e => patch({ image: { ...design.image!, [key]: Number(e.target.value) } })} /></label>)}
          <Button type="button" size="sm" variant="outline" onClick={() => { patch({ image: undefined }); setError(null); }}>Remove image</Button>
        </>}
        {imageLoading && <p role="status" className="text-xs">Loading image preview…</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['title', 'artist', 'subtitle'] as const).map(key => <label key={key} className="space-y-1 text-xs capitalize">{key}<Input aria-label={`Design ${key}`} value={design[key]} maxLength={100} onChange={e => patch({ [key]: e.target.value })} /></label>)}
        <label className="space-y-1 text-xs">Pattern<select aria-label="Design pattern" className="block w-full rounded border bg-background p-2" value={design.pattern} onChange={e => patch({ pattern: e.target.value as ArtworkDesign['pattern'] })}><option value="rays">Sunburst</option><option value="stripes">Diagonal stripes</option><option value="circles">Polka dots</option></select></label>
        <label className="space-y-1 text-xs">Typeface<select aria-label="Design typeface" className="block w-full rounded border bg-background p-2" value={design.font} onChange={e => patch({ font: e.target.value as ArtworkDesign['font'] })}><option value="sans-serif">Modern</option><option value="serif">Classic</option><option value="monospace">Typewriter</option></select></label>
        <div className="flex gap-3">{(['background', 'accent', 'ink'] as const).map(key => <label key={key} className="text-xs capitalize">{key}<input aria-label={`Design ${key}`} type="color" value={design[key]} onChange={e => patch({ [key]: e.target.value })} className="mt-1 block h-9 w-12 rounded border" /></label>)}</div>
      </div>
      {surface === 'vinyl' && <div className="flex flex-wrap items-end gap-3"><label className="text-xs">Vinyl finish<select aria-label="Vinyl finish" className="mt-1 block rounded border bg-background p-2" value={design.vinylStyle} onChange={e => patch({ vinylStyle: e.target.value as ArtworkDesign['vinylStyle'] })}><option value="black">Classic black</option><option value="colour">Coloured vinyl</option><option value="splatter">Splatter vinyl</option></select></label><label className="text-xs">Vinyl colour<input aria-label="Vinyl colour" type="color" value={design.vinylColour} onChange={e => patch({ vinylColour: e.target.value })} className="mt-1 block h-9 w-12 rounded border" /></label></div>}
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void run(true)}>Use as release artwork</Button><Button type="button" variant="outline" onClick={() => void run(false)}>Download PNG</Button></div>
      <details className="text-xs"><summary className="cursor-pointer">Save or reopen an editable design</summary><p className="my-2 text-muted-foreground">Download the design file to continue editing later. CD and vinyl exports are separate graphics; manufacturing uses your existing release formats.</p><Button type="button" size="sm" variant="outline" onClick={() => downloadArtworkFile(new Blob([serializeArtworkProject({ design, surface })], { type: 'application/json' }), 'rockmundo-artwork-design.json')}>Download design</Button><label className="mt-2 block">Open design<Input type="file" accept=".json,application/json" aria-label="Open artwork design" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); onBusyChange?.(true); try { if (file.size > MAX_DESIGN_BYTES) throw new Error('Design file is too large.'); const project = parseArtworkProject(await file.text()); if (project.design.image) await loadArtworkImage(project.design.image); updateDraft(project); setNotice(null); setError(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); onBusyChange?.(false); } }} /></label></details>
    </fieldset>
    {busy && <p role="status" className="text-xs">Preparing artwork…</p>}
    {notice && <p role="status" className="text-xs">{notice}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}
