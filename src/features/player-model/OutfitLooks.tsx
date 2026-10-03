import type { PlayerAppearance } from './appearance';
import { applyOutfitLook, OUTFIT_LOOKS } from './wardrobeStyling';

export function OutfitLooks({ appearance, onChange }: { appearance: PlayerAppearance; onChange: (next: PlayerAppearance) => void }) {
  return <div className="player-model-wardrobe" role="group" aria-label="Outfit looks">
    <div className="player-model-wardrobe__heading"><h3>Style a complete look</h3><span>Mix and recolour after selecting</span></div>
    <div className="player-model-wardrobe__grid">
      {OUTFIT_LOOKS.map(look => <button type="button" key={look.name} onClick={() => onChange(applyOutfitLook(appearance, look))}>
        <span className="player-model-look-swatches" aria-hidden="true">{look.colours.map((colour, index) => <i key={index} style={{ background: colour }} />)}</span>
        {look.name}
      </button>)}
    </div>
  </div>;
}
