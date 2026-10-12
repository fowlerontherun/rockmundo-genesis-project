import { useQuery } from "@tanstack/react-query";
import {
  fetchAllRadioContent,
  fetchPlayableRadioContent,
  radioContentKeys,
  type RadioContent,
} from "@/services/radioContentService";

export type { RadioContent } from "@/services/radioContentService";

export const useRadioContent = () => {
  return useQuery({
    queryKey: radioContentKeys.active,
    queryFn: fetchPlayableRadioContent,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useAllRadioContent = () => {
  return useQuery({
    queryKey: radioContentKeys.all,
    queryFn: fetchAllRadioContent,
    staleTime: 30 * 1000, // 30 seconds for admin
  });
};

// Get weighted random content
export const getRandomContent = (content: RadioContent[]): RadioContent | null => {
  if (content.length === 0) return null;

  // Weighted reservoir selection avoids allocating play_weight copies of each item.
  let total = 0;
  let selected: RadioContent | null = null;
  for (const item of content) {
    const weight = Number.isFinite(item.play_weight) && item.play_weight > 0 ? Math.min(item.play_weight, 10000) : 1;
    total += weight;
    if (Math.random() * total < weight) selected = item;
  }
  return selected;
};
