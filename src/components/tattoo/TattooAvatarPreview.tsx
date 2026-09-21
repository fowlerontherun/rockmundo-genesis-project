import { PlayerModelPreview } from '@/features/player-model/PlayerModelPreview';
import {
  useEquippedRichClothing,
  usePlayerModel,
  usePlayerStageTattoos,
} from '@/features/player-model/usePlayerModel';
import '@/features/player-model/player-model.css';

export function TattooAvatarPreview() {
  const model = usePlayerModel();
  const clothing = useEquippedRichClothing(model.profileId);
  const tattoos = usePlayerStageTattoos(model.profileId);

  if (model.isLoading || (model.profileId && model.query.isPending)) {
    return <div className="tattoo-avatar-preview__status" role="status">Loading your 3D character…</div>;
  }
  if (model.error || model.query.isError || clothing.isError || tattoos.isError) {
    return <div className="tattoo-avatar-preview__status" role="alert">The live 3D tattoo preview could not load. Your saved tattoo data is unchanged.</div>;
  }
  if (!model.profileId || !model.query.data) {
    return <div className="tattoo-avatar-preview__status">Select a character to view tattoos in 3D.</div>;
  }

  return <div className="tattoo-avatar-preview">
    <PlayerModelPreview
      appearance={model.query.data.appearance}
      richClothing={clothing.data ?? []}
      tattoos={tattoos.data ?? []}
    />
    <p className="tattoo-avatar-preview__note">
      This is the same animated model used by the Avatar Creator, gigs and Top of the Pops. Equipped clothing automatically hides covered tattoo regions.
    </p>
  </div>;
}
