import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayerModelPreview } from '@/features/player-model/PlayerModelPreview';
import { useEquippedRichClothing, useEquippedStageLuthieryInstruments, usePlayerModel, usePlayerStageTattoos } from '@/features/player-model/usePlayerModel';
import { useAvatarMerchWearables } from '@/features/player-model/useAvatarMerchWearables';
import { captureAvatarCanvas, type AvatarCapture } from './avatarCapture';
import { ShareMomentSheet } from './ShareMomentSheet';
import type { CharacterProfileShareMoment } from './characterProfile';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moment: CharacterProfileShareMoment;
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

  useEffect(() => { if (!open) setAvatar(null); }, [open]);
  useEffect(() => { setAvatar(null); }, [moment.id]);

  const capture = useCallback((canvas: HTMLCanvasElement) => {
    try { setAvatar(captureAvatarCanvas(canvas)); } catch { setAvatar(null); }
  }, []);

  const shareMoment = useMemo(() => ({ ...moment, avatar }), [moment, avatar]);

  return <>
    {open && model.query.data?.appearance && (
      <div className="fixed -left-[10000px] top-0 h-[1000px] w-[800px] pointer-events-none" aria-hidden="true">
        <PlayerModelPreview
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
    <ShareMomentSheet open={open} onOpenChange={onOpenChange} moment={shareMoment} />
  </>;
}

/** Backwards-compatible semantic alias for the profile entry point. */
export const CharacterShareStudio = AvatarShareStudio;
