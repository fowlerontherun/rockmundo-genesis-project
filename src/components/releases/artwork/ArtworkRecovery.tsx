import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadArtworkFile } from './design';
import type { ArtworkDraft } from './ReleaseArtworkDesigner';

export interface ArtworkRecoveryState {
  releaseId: string;
  title: string;
  profileId: string | null;
  file: File;
  draft: ArtworkDraft | null;
  error: string;
  retry: () => Promise<void>;
}

export function ArtworkRecovery({ recovery, disabled = false, onBusyChange, onSaved, onFinish }: { recovery: ArtworkRecoveryState; disabled?: boolean; onBusyChange: (busy: boolean) => void; onSaved: () => void; onFinish: () => void }) {
  const [error, setError] = useState(recovery.error);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const running = useRef(false);
  useEffect(() => { const url = URL.createObjectURL(recovery.file); setPreview(url); return () => URL.revokeObjectURL(url); }, [recovery.file]);
  const retry = async () => {
    if (running.current || disabled) return;
    running.current = true; setBusy(true); onBusyChange(true);
    try { await recovery.retry(); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not attach the artwork. Please try again.'); }
    finally { running.current = false; setBusy(false); onBusyChange(false); }
  };
  return <div className="space-y-4">
    <p><strong>{recovery.title}</strong> was created successfully. Its artwork still needs to be attached.</p>
    <p className="text-sm text-muted-foreground">Retry attaches artwork to this release only. It will not create another release or repeat the manufacturing charge. Download your artwork before leaving if you want a backup.</p>
    {preview && <img src={preview} alt="Artwork awaiting attachment" className="mx-auto aspect-square w-full max-w-64 rounded-lg border object-contain" />}
    <p role="alert" className="text-sm text-destructive">{error}</p>
    {disabled && <p className="text-sm">Switch back to the character that created this release to retry.</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy || disabled} onClick={() => void retry()}>{busy ? 'Attaching artwork…' : 'Retry artwork attachment'}</Button>
      <Button type="button" variant="outline" onClick={() => downloadArtworkFile(recovery.file, recovery.file.name)}>Download artwork</Button>
      {recovery.draft && <Button type="button" variant="outline" onClick={() => downloadArtworkFile(new Blob([JSON.stringify(recovery.draft!.design)], { type: 'application/json' }), 'rockmundo-artwork-design.json')}>Download editable design</Button>}
      <Button type="button" variant="ghost" disabled={busy} onClick={onFinish}>Finish without artwork</Button>
    </div>
  </div>;
}
