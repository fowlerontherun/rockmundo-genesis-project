import { usePageGraphics } from '@/hooks/usePageGraphics';
import { ArtworkImage } from './GameArtwork';

/** Optional admin art must not block navigation or city information. */
export function CityArtwork({ cityId }: { cityId: string }) {
  const { data } = usePageGraphics();
  const graphics = Array.isArray(data) ? data : [];
  const imageFor = (key: string) => {
    const graphic = graphics.find(row => row.page_key === key);
    return graphic?.banner_image_url || graphic?.hero_image_url || graphic?.background_image_url;
  };
  const src = imageFor(`city:${cityId}`) || imageFor('current-city') || imageFor('city');
  return <div className="city-art" aria-hidden="true">
    <ArtworkImage src={src} fallback="/hub-tiles/current-city.png" />
  </div>;
}
