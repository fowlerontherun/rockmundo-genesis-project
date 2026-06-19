import { MagazineTile } from "./MagazineTile";
import type { HubTile } from "./types";

export const TileGrid = ({ tiles }: { tiles: HubTile[] }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
    {tiles.map((tile) => (
      <MagazineTile key={tile.path} tile={tile} />
    ))}
  </div>
);
