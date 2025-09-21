// Temporary stub for useGameData hook until Supabase types are fixed
import { useQuery } from '@tanstack/react-query';

export const useGameData = () => {
  return {
    profile: null,
    playerSkills: {},
    playerAttributes: {},
    loading: false,
    error: null,
    refetch: () => {},
    achievements: [],
    activityFeed: [],
    refreshData: () => Promise.resolve(),
    updateProfile: () => Promise.resolve(),
    createProfile: () => Promise.resolve(),
    deleteProfile: () => Promise.resolve(),
  };
};