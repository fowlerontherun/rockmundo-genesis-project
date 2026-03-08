import { useQuery } from "@tanstack/react-query";

/** Maps tile path keys to static image filenames in /hub-tiles/ */
function getTileImagePath(tileKey: string): string {
  return `/hub-tiles/${tileKey}.png`;
}

export function useHubTileImage(tileKey: string, _prompt: string) {
  return useQuery({
    queryKey: ["hub-tile-image", tileKey],
    queryFn: async () => {
      const path = getTileImagePath(tileKey);
      // Verify the image exists
      try {
        const res = await fetch(path, { method: "HEAD" });
        if (res.ok) return path;
      } catch {
        // fall through
      }
      return null;
    },
    staleTime: Infinity,
    retry: 0,
  });
}
