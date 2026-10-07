import { ShareMomentSheet } from './ShareMomentSheet';
import type { CharacterProfileShareMoment } from './characterProfile';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moment: CharacterProfileShareMoment;
}

/**
 * Character sharing uses the same canonical ShareMomentSheet and Avatar V1
 * capture pipeline as every other shareable moment.
 */
export function AvatarShareStudio({ open, onOpenChange, moment }: Props) {
  return <ShareMomentSheet open={open} onOpenChange={onOpenChange} moment={moment} />;
}

/** Backwards-compatible semantic alias for the profile entry point. */
export const CharacterShareStudio = AvatarShareStudio;
