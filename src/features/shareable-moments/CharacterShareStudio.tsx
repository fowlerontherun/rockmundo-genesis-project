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
  // Explicit user choice only. Never silently hide a crafted instrument when its query fails.
  const [omitUnloadedCrafted, setOmitUnloadedCrafted] = useState<string | null>(null);
  const useNoCraftedInstrument = omitUnloadedCrafted === captureKey && luthiery.isError;
  const storedAvatar = retry > 0 ? null : moment.avatar ?? null;
  // Automatic milestone prompts should not initialise WebGL until the
  // player actually chooses to create the image.
  const [promptAccepted, setPromptAccepted] = useState(false);
  const captureEnabled = !moment.promptOnly || promptAccepted;
  const avatar = storedAvatar ?? (capture?.key === captureKey ? capture.avatar : null);
  const captureStatus: CaptureStatus = storedAvatar ? 'ready' : capture?.key === captureKey ? capture.status : 'loading';

  useEffect(() => {
    if (!open || !captureEnabled || storedAvatar) return;
    let cancelled = false;
    setCapture({ key: captureKey, avatar: null, status: 'loading' });

    if (!profileId || !appearance) {
      // Without a selected character the model query remains disabled and
      // 'loading' would otherwise continue forever.
      if (model.query.isError || (!profileId && !model.isLoading)) {
        setCapture({ key: captureKey, avatar: null, status: 'unavailable' });
      }
      return;
    }
    // React Query can keep stale appearance data when a refresh fails.
    // Never publish a stale model or omit equipment after an errored request:
    // all required appearance layers must have healthy query results.
    // Disabled merch queries (players without a band) are not errors.
    if (model.query.isError || clothing.isError || tattoos.isError || merch.query.isError || (luthiery.isError && !useNoCraftedInstrument)) {
      setCapture({ key: captureKey, avatar: null, status: 'unavailable' });
      return;
    }
    // Wait for equipped appearance layers so the saved picture represents the
    // current avatar rather than a partially loaded default outfit.
    // A disabled optional query (e.g. merch without a band) is perpetually
    // isPending in React Query; only wait for requests actually in flight.
    if (model.query.isFetching
      || (clothing.isPending && clothing.isFetching)
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
      luthieryInstrument: useNoCraftedInstrument ? null : craftedInstrument,
    }).then(captureAvatarCanvas).then(snapshot => {
      if (!cancelled) setCapture({ key: captureKey, avatar: snapshot, status: 'ready' });
    }).catch(error => {
      console.warn('[share-studio] avatar capture failed', error);
      if (!cancelled) setCapture({ key: captureKey, avatar: null, status: 'unavailable' });
    });

    return () => { cancelled = true; };
  }, [open, captureEnabled, storedAvatar, captureKey, profileId, appearance, model.query.isError, model.query.isFetching, model.isLoading,
    clothing.isPending, clothing.isFetching, clothing.isError, clothing.data, tattoos.isPending, tattoos.isFetching, tattoos.isError, tattoos.data,
    merch.query.isPending, merch.query.isFetching, merch.query.isError, merch.query.data, luthiery.isPending, luthiery.isFetching, luthiery.isError, craftedInstrument,
    role, instrument, retry, useNoCraftedInstrument]);

  const shareMoment = useMemo(() => ({ ...moment, avatar }), [moment, avatar]);

  return <ShareMomentSheet
    open={open}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) setPromptAccepted(false);
      onOpenChange(nextOpen);
    }}
    onPromptAccepted={() => setPromptAccepted(true)}
    moment={shareMoment}
    avatarStatus={captureStatus}
    avatarWarning={useNoCraftedInstrument ? "The crafted-instrument service is unavailable, so this image deliberately omits any crafted instrument. Your appearance and clothing remain unchanged." : undefined}
    onAvatarFallback={luthiery.isError && !useNoCraftedInstrument && !model.query.isError && !clothing.isError && !tattoos.isError && !merch.query.isError
      ? () => { setOmitUnloadedCrafted(captureKey); setRecapture(previous => ({ key: captureKey, attempt: (previous?.key === captureKey ? previous.attempt : 0) + 1 })); }
      : undefined}
    onAvatarRetry={() => {
      if (model.query.isError) void model.query.refetch();
      if (clothing.isError) void clothing.refetch();
      if (tattoos.isError) void tattoos.refetch();
      if (merch.query.isError) void merch.query.refetch();
      if (luthiery.isError) void luthiery.refetch();
      setRecapture(previous => ({
        key: captureKey,
        attempt: previous?.key === captureKey ? previous.attempt + 1 : 1,
      }));
    }}
  />;
}

/** Backwards-compatible semantic alias for the profile entry point. */
export const CharacterShareStudio = AvatarShareStudio;
