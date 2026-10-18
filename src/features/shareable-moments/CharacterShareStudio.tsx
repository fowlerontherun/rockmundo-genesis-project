import { useEffect, useMemo, useState } from 'react';
import { useEquippedRichClothing, useEquippedStageLuthieryInstruments, usePlayerModel, usePlayerStageTattoos } from '@/features/player-model/usePlayerModel';
import { useAvatarMerchWearables } from '@/features/player-model/useAvatarMerchWearables';
import { captureAvatarCanvas, captureAvatarV1ForShare, type AvatarCapture } from './avatarCapture';
import { ShareMomentSheet } from './ShareMomentSheet';
import type { ShareMoment } from './types';

type AvatarShareMoment = ShareMoment & { avatar?: AvatarCapture | null };
type CaptureStatus = 'loading' | 'ready' | 'unavailable';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moment: AvatarShareMoment;
}

/**
 * Capture the same player model, outfit, tattoos and equipment used on stage.
 * A dedicated WebGL render avoids depending on an off-screen animated preview,
 * which browsers can skip or clear before its first populated frame.
 */
export function AvatarShareStudio({ open, onOpenChange, moment }: Props) {
  const model = usePlayerModel();
  const profileId = open ? model.profileId : null;
  const clothing = useEquippedRichClothing(profileId);
  const tattoos = usePlayerStageTattoos(profileId);
  const merch = useAvatarMerchWearables(profileId);
  const luthiery = useEquippedStageLuthieryInstruments(profileId);
  const appearance = model.query.data?.appearance;
  const craftedInstrument = luthiery.data?.[0] ?? null;
  const instrument = craftedInstrument?.instrumentKind === 'electric_bass' ? 'bass_guitar' : craftedInstrument?.instrumentKind === 'electric_guitar' ? 'electric_guitar' : undefined;
  const role = instrument === 'bass_guitar' ? 'bass' : instrument === 'electric_guitar' ? 'guitar' : 'other';
  const captureKey = `${model.profileId ?? 'none'}:${moment.type}:${moment.id ?? moment.createdAt}`;
  const [capture, setCapture] = useState<{ key: string; avatar: AvatarCapture | null; status: CaptureStatus } | null>(null);
  // A previously stored image can be corrupted. Retrying must switch to a
  // fresh model capture instead of repeatedly decoding the invalid data URL.
  // Scope retry state to the specific moment so other saved portraits survive.
  const [recapture, setRecapture] = useState<{ key: string; attempt: number } | null>(null);
  const retry = recapture?.key === captureKey ? recapture.attempt : 0;
  const storedAvatar = retry > 0 ? null : moment.avatar ?? null;
  const avatar = storedAvatar ?? (capture?.key === captureKey ? capture.avatar : null);
  const captureStatus: CaptureStatus = storedAvatar ? 'ready' : capture?.key === captureKey ? capture.status : 'loading';

  useEffect(() => {
    if (!open || storedAvatar) return;
    let cancelled = false;
    setCapture({ key: captureKey, avatar: null, status: 'loading' });

    if (!profileId || !appearance) {
      if (model.query.isError) setCapture({ key: captureKey, avatar: null, status: 'unavailable' });
      return;
    }
    // Wait for equipped appearance layers so the saved picture represents the
    // current avatar rather than a partially loaded default outfit.
    // A disabled optional query (e.g. merch without a band) is perpetually
    // isPending in React Query; only wait for requests actually in flight.
    if ((clothing.isPending && clothing.isFetching)
      || (tattoos.isPending && tattoos.isFetching)
      || (merch.query.isPending && merch.query.isFetching)
      || (luthiery.isPending && luthiery.isFetching)) return;

    void captureAvatarV1ForShare({
      appearance,
      role,
      instrument,
      richClothing: clothing.data ?? [],
      tattoos: tattoos.data ?? [],
      merchWearable: merch.query.data?.equipped ?? null,
      luthieryInstrument: craftedInstrument,
    }).then(captureAvatarCanvas).then(snapshot => {
      if (!cancelled) setCapture({ key: captureKey, avatar: snapshot, status: 'ready' });
    }).catch(error => {
      console.warn('[share-studio] avatar capture failed', error);
      if (!cancelled) setCapture({ key: captureKey, avatar: null, status: 'unavailable' });
    });

    return () => { cancelled = true; };
  }, [open, storedAvatar, captureKey, profileId, appearance, model.query.isError,
    clothing.isPending, clothing.isFetching, clothing.data, tattoos.isPending, tattoos.isFetching, tattoos.data,
    merch.query.isPending, merch.query.isFetching, merch.query.data, luthiery.isPending, luthiery.isFetching, craftedInstrument,
    role, instrument, retry]);

  const shareMoment = useMemo(() => ({ ...moment, avatar }), [moment, avatar]);

  return <ShareMomentSheet
    open={open}
    onOpenChange={onOpenChange}
    moment={shareMoment}
    avatarStatus={captureStatus}
    onAvatarRetry={() => setRecapture(previous => ({
      key: captureKey,
      attempt: previous?.key === captureKey ? previous.attempt + 1 : 1,
    }))}
  />;
}

/** Backwards-compatible semantic alias for the profile entry point. */
export const CharacterShareStudio = AvatarShareStudio;
