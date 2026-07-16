import { useQuery } from '@tanstack/react-query';
import type { FestivalLegacySource } from '@/features/festivals/types';
import { resolveFestivalEditionIdentifier } from './mode';

export function useResolvedFestivalEdition(identifier?: string | null, legacySource?: FestivalLegacySource) {
  return useQuery({
    queryKey: ['festivals', 'booking', 'resolve-edition', legacySource ?? 'dedicated_festival_row', identifier ?? 'none'],
    queryFn: () => resolveFestivalEditionIdentifier({ identifier, legacySource }),
    enabled: Boolean(identifier),
  });
}
