// Temporary stub to replace problematic hook until types are fixed
import { useQuery } from '@tanstack/react-query';

export const useEducationVideoPlaylists = () => {
  return useQuery({
    queryKey: ['education-video-playlists'],
    queryFn: () => Promise.resolve([]),
    staleTime: 5 * 60 * 1000,
  });
};