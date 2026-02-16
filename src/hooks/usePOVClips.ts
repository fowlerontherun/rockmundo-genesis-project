import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface POVClip {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  instrument_family: string | null;
  instrument_track: string | null;
  variant: string | null;
  venue_size: string | null;
  clip_type: string | null;
  description: string | null;
}

export const usePOVClips = (instrumentRoles: string[], venueSize?: string) => {
  return useQuery({
    queryKey: ['pov-clips', instrumentRoles, venueSize],
    queryFn: async () => {
      // Map instrument roles to families
      const familyMap: Record<string, string> = {
        'lead_guitar': 'guitar', 'rhythm_guitar': 'guitar', 'guitar': 'guitar', 'Guitar': 'guitar',
        'bass': 'guitar', 'Bass': 'guitar',
        'drums': 'drums', 'Drums': 'drums',
        'keyboard': 'keys', 'keys': 'keys', 'Keyboard': 'keys',
        'lead_vocals': 'vocals', 'vocals': 'vocals', 'Vocals': 'vocals',
        'DJ/Producer': 'electronic',
      };

      const families = [...new Set(instrumentRoles.map(r => familyMap[r] || familyMap[r.toLowerCase()] || 'vocals'))];

      // Fetch instrument clips for the band's instruments + universal clips
      const { data, error } = await supabase
        .from('pov_clip_templates')
        .select('id, video_url, thumbnail_url, instrument_family, instrument_track, variant, venue_size, clip_type, description')
        .eq('generation_status', 'completed')
        .not('video_url', 'is', null);

      if (error) throw error;

      const allClips = (data || []) as POVClip[];

      // Filter to relevant clips
      const instrumentClips = allClips.filter(c => 
        c.instrument_family && families.includes(c.instrument_family)
      );

      const universalClips = allClips.filter(c => 
        c.instrument_family === 'universal' || c.clip_type === 'crowd' || c.clip_type === 'entrance' || c.clip_type === 'exit' || c.clip_type === 'backstage' || c.clip_type === 'between_songs' || c.clip_type === 'atmosphere'
      );

      // Filter by venue size if specified
      const filteredUniversal = venueSize
        ? universalClips.filter(c => c.venue_size === venueSize || c.venue_size === 'any')
        : universalClips;

      return {
        instrumentClips,
        universalClips: filteredUniversal,
        allClips: [...instrumentClips, ...filteredUniversal],
        hasClips: instrumentClips.length > 0 || filteredUniversal.length > 0,
      };
    },
    enabled: instrumentRoles.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
