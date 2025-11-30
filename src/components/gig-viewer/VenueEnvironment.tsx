import { BeachEnvironment } from './environments/BeachEnvironment';
import { FestivalEnvironment } from './environments/FestivalEnvironment';
import { OperaHouseEnvironment } from './environments/OperaHouseEnvironment';
import { ClubEnvironment } from './environments/ClubEnvironment';
import { AmphitheaterEnvironment } from './environments/AmphitheaterEnvironment';
import { RooftopEnvironment } from './environments/RooftopEnvironment';

export type VenueTheme = 'beach' | 'festival' | 'opera' | 'club' | 'amphitheater' | 'rooftop' | 'default';

interface VenueEnvironmentProps {
  venueTheme?: VenueTheme;
}

export const VenueEnvironment = ({ venueTheme = 'default' }: VenueEnvironmentProps) => {
  switch (venueTheme) {
    case 'beach':
      return <BeachEnvironment />;
    case 'festival':
      return <FestivalEnvironment />;
    case 'opera':
      return <OperaHouseEnvironment />;
    case 'club':
      return <ClubEnvironment />;
    case 'amphitheater':
      return <AmphitheaterEnvironment />;
    case 'rooftop':
      return <RooftopEnvironment />;
    default:
      return null;
  }
};
