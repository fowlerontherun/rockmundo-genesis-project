import { useQuery } from "@tanstack/react-query";
import { fetchBlockedPlayers } from "@/services/social-safety/PlayerBlockService";

export function useBlockedPlayers(search: string, page: number) {
  return useQuery({ queryKey: ["blocked-players", search, page], queryFn: () => fetchBlockedPlayers(search, page) });
}
