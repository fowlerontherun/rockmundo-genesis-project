import { PlayerModelPreview } from '@/features/player-model/PlayerModelPreview';
import {
  usePlayerModel,
  usePlayerStageTattoos,
} from '@/features/player-model/usePlayerModel';
import '@/features/player-model/player-model.css';

export function TattooAvatarPreview() {
  const model = usePlayerModel();
  const tattoos = usePlayerStageTattoos(model.profileId);

  if (model.isLoading || (model.profileId && model.query.isPending)) {
    return <div className="tattoo-avatar-preview__status" role="status">Loading your 3D character…</div>;
  }
  if (model.error || model.query.isError || tattoos.isError) {
    return <div className="tattoo-avatar-preview__status" role="alert">The live 3D tattoo preview could not load. Your saved tattoo data is unchanged.</div>;
  }
  if (!model.profileId || !model.query.data) {
    return <div className="tattoo-avatar-preview__status">Select a character to view tattoos in 3D.</div>;
  }

  return <div className="tattoo-avatar-preview">
    <PlayerModelPreview
      appearance={model.query.data.appearance}
      tattoos={tattoos.data ?? []}
      presentation="tattoo"
    />
    <p className="tattoo-avatar-preview__note">
      Clothing is temporarily removed in this Tattoo Parlour preview so every tattoo area stays visible. Use the Neck, Front torso, Back, Left arm, Right arm and Legs camera views for close inspection. Your saved outfit is not changed.
    </p>
  </div>;
}
