import { Music } from 'lucide-react';
import { FMPageScaffold } from '@/components/fm/FMPageScaffold';
import { usePrimaryBand } from '@/hooks/usePrimaryBand';
import { CanonicalPlayerFestivalHub } from '@/features/festivals/booking/components';
import { FestivalDirectoryPosters } from '@/features/festivals/components/FestivalDirectoryPosters';

export default function FestivalBrowser() {
  const { data: primaryBandRecord } = usePrimaryBand();
  const band = primaryBandRecord?.bands;

  return (
    <FMPageScaffold
      title="Festivals"
      subtitle="Discover festival line-ups, apply to play and manage your festival bookings"
      icon={Music}
      backTo="/hub/band-live"
    >
      <div className="space-y-6">
        <FestivalDirectoryPosters />
        <CanonicalPlayerFestivalHub bandId={band?.id} />
      </div>
    </FMPageScaffold>
  );
}
