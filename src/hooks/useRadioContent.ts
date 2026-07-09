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

  // Build weighted array
  const weightedArray: RadioContent[] = [];
  for (const item of content) {
    const weight = item.play_weight || 1;
    for (let i = 0; i < weight; i++) {
      weightedArray.push(item);
    }
  }

  return weightedArray[Math.floor(Math.random() * weightedArray.length)] ?? null;
};
