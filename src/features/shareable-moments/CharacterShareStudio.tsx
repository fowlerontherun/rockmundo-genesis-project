import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerModelPreview } from '@/features/player-model/PlayerModelPreview';
import { useEquippedRichClothing, useEquippedStageLuthieryInstruments, usePlayerModel, usePlayerStageTattoos } from '@/features/player-model/usePlayerModel';
import { useAvatarMerchWearables } from '@/features/player-model/useAvatarMerchWearables';
import { captureAvatarCanvas, type AvatarCapture } from './avatarCapture';
import { ShareMomentSheet } from './ShareMomentSheet';
import type { CharacterProfileShareMoment } from './characterProfile';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moment: CharacterProfileShareMoment | null;
}

/**
 * Avatar-aware sharing owns player-model lookup and WebGL capture here so the
 * generic ShareMomentSheet stays reusable outside AuthProvider/player context.
 */
export function AvatarShareStudio({ open, onOpenChange, moment }: Props) {
  const model = usePlayerModel();
  const clothing = useEquippedRichClothing(open ? model.profileId : null);
  const tattoos = usePlayerStageTattoos(open ? model.profileId : null);
  const merch = useAvatarMerchWearables(open ? model.profileId : null);
  const luthiery = useEquippedStageLuthieryInstruments(open ? model.profileId : null);
  const craftedInstrument = luthiery.data?.[0] ?? null;
  const instrument = craftedInstrument?.instrumentKind === 'electric_bass' ? 'bass_guitar' : craftedInstrument?.instrumentKind === 'electric_guitar' ? 'electric_guitar' : undefined;
  const role = instrument === 'bass_guitar' ? 'bass' : instrument === 'electric_guitar' ? 'guitar' : 'other';
  const [avatar, setAvatar] = useState<AvatarCapture | null>(null);
  const [captureError, setCaptureError] = useState(false);
  const [captureAttempt, setCaptureAttempt] = useState(0);
  const [captureTimedOut, setCaptureTimedOut] = useState(false);

  useEffect(() => { if (!open) { setAvatar(null); setCaptureError(false); setCaptureTimedOut(false); } }, [open]);
  useEffect(() => { setAvatar(null); setCaptureError(false); setCaptureTimedOut(false); }, [moment?.id]);
  useEffect(() => {
    if (!open || !moment || avatar || captureError) return;
    setCaptureTimedOut(false);
    const timer = window.setTimeout(() => setCaptureTimedOut(true), 15000);
    return () => window.clearTimeout(timer);
  }, [open, moment?.id, avatar, captureError, captureAttempt]);

  const capture = useCallback((canvas: HTMLCanvasElement) => {
    try { setAvatar(captureAvatarCanvas(canvas)); setCaptureError(false); setCaptureTimedOut(false); } catch { setAvatar(null); setCaptureError(true); }
  }, []);

  const shareMoment = useMemo(() => moment ? { ...moment, avatar } : null, [moment, avatar]);

  return <>
    {open && moment && model.query.data?.appearance && (
      <div className="fixed -left-[10000px] top-0 h-[1000px] w-[800px] pointer-events-none" aria-hidden="true">
        <PlayerModelPreview
          key={captureAttempt}
          appearance={model.query.data.appearance}
          role={role}
          instrument={instrument}
          richClothing={clothing.data ?? []}
          tattoos={tattoos.data ?? []}
          merchWearable={merch.query.data?.equipped ?? null}
          luthieryInstrument={craftedInstrument}
          presentation="stage"
          transparentCapture
          onCanvasReady={capture}
        />
      </div>
    )}
    {open && moment && (captureError || captureTimedOut) && <div role="alert" className="fixed bottom-20 right-4 z-[80] max-w-sm rounded-lg border bg-background p-4 shadow-lg"><p className="mb-2 text-sm">Your avatar could not be captured for sharing. The preview may have failed to load.</p><Button size="sm" onClick={() => { setCaptureError(false); setCaptureTimedOut(false); setCaptureAttempt((value) => value + 1); }}>Retry avatar capture</Button></div>}
    <ShareMomentSheet open={open} onOpenChange={onOpenChange} moment={shareMoment} />
  </>;
}

/** Backwards-compatible semantic alias for the profile entry point. */
export const CharacterShareStudio = AvatarShareStudio;
