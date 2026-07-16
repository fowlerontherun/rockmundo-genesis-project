import { Music } from 'lucide-react';
import { FMPageScaffold } from '@/components/fm/FMPageScaffold';
import { usePrimaryBand } from '@/hooks/usePrimaryBand';
import { CanonicalPlayerFestivalHub } from '@/features/festivals/booking/components';

export default function FestivalBrowser() {
  const { data: primaryBandRecord } = usePrimaryBand();
  const band = primaryBandRecord?.bands;

  return (
    <FMPageScaffold
      title="Festivals"
      subtitle="Canonical applications, offers, contracts and setlist preparation"
      icon={Music}
      backTo="/hub/band-live"
    >
      <CanonicalPlayerFestivalHub bandId={band?.id} />
    </FMPageScaffold>
  );
}
