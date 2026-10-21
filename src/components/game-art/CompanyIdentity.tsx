import { artworkPalette } from './GameArtwork';
import './company-identity.css';

/** Decorative workplace illustration, not a company-supplied logo. */
export function CompanyIdentity({ id, name, type }: { id: string; name?: string | null; type?: string | null }) {
  return <div className="company-identity" style={artworkPalette(id)}>
    <div className="company-identity__illustration" aria-hidden="true">
      <svg viewBox="0 0 80 80" focusable="false">
        <circle cx="64" cy="18" r="9" fill="var(--art-highlight)" opacity=".5" />
        <path d="M9 68V28l30-14 30 14v40Z" fill="var(--art-accent)" opacity=".2" />
        <path d="M18 68V30h44v38" fill="var(--art-bg)" stroke="var(--art-accent)" strokeWidth="2" />
        <path d="M14 30h52v-7H14Z" fill="var(--art-accent)" />
        {[27, 40, 53].map(x => <path key={x} d={`M${x - 3} 38h6v7h-6z M${x - 3} 50h6v7h-6z`} fill="var(--art-highlight)" />)}
        <path d="M35 68V59h10v9M9 69h62" fill="none" stroke="var(--art-accent)" strokeWidth="2" />
      </svg>
    </div>
    <div className="company-identity__copy">
      <p className="company-identity__name">{name || 'Company'}</p>
      {type && <p className="company-identity__type">{type.replace(/_/g, ' ')}</p>}
    </div>
  </div>;
}
