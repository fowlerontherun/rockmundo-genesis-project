import { useMemo, useState } from 'react';
import { PlayerModelPreview } from '@/features/player-model/PlayerModelPreview';
import { useAvatarMerchWearables } from '@/features/player-model/useAvatarMerchWearables';
import { useEquippedRichClothing, useEquippedStageLuthieryInstruments, usePlayerModel, usePlayerStageTattoos } from '@/features/player-model/usePlayerModel';
import { captureAvatarCanvas, type AvatarCapture } from './avatarCapture';
import { ShareMomentSheet } from './ShareMomentSheet';
import type { CharacterProfileShareMoment } from './characterProfile';
import '@/features/player-model/player-model.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moment: CharacterProfileShareMoment;
}

export function CharacterShareStudio({ open, onOpenChange, moment }: Props) {
  const model = usePlayerModel();
  const clothing = useEquippedRichClothing(open ? model.profileId : null);
  const tattoos = usePlayerStageTattoos(open ? model.profileId : null);
  const luthiery = useEquippedStageLuthieryInstruments(open ? model.profileId : null);
  const merch = useAvatarMerchWearables(open ? model.profileId : null);
  const [avatar, setAvatar] = useState<AvatarCapture | null>(null);
  const shareMoment = useMemo(() => ({ ...moment, avatar }), [moment, avatar]);

  return <>
    {open && model.query.data?.appearance && <div className="fixed -left-[10000px] top-0 h-[1000px] w-[800px]" aria-hidden="true">
      <PlayerModelPreview
        appearance={model.query.data.appearance}
        richClothing={clothing.data ?? []}
        tattoos={tattoos.data ?? []}
        merchWearable={merch.query.data?.equipped ?? null}
        luthieryInstrument={luthiery.data?.[0] ?? null}
        presentation="stage"
        onCanvasReady={canvas => setAvatar(captureAvatarCanvas(canvas))}
      />
    </div>}
    <ShareMomentSheet open={open} onOpenChange={onOpenChange} moment={shareMoment} />
  </>;
}
