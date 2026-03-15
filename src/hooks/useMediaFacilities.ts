import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MediaFacility {
  id: string;
  name: string;
  facility_type: "tv" | "podcast" | "radio";
  city_id: string | null;
  specialization: string | null;
  reputation: number;
  sponsor_tier: string;
  weekly_cost: number;
  created_at: string;
}

export interface MediaShow {
  id: string;
  facility_id: string;
  show_name: string;
  show_format: string | null;
  target_audience: string | null;
  viewership: number;
  rating: number;
  episodes_count: number;
  is_active: boolean;
}

export const useMediaFacilities = (profileId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all facilities
  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery({
    queryKey: ["media-facilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_facilities")
        .select("*")
        .order("reputation", { ascending: false });

      if (error) throw error;
      return data as MediaFacility[];
    },
  });

  // Fetch user's facilities
  const { data: myFacilities = [], isLoading: myFacilitiesLoading } = useQuery({
    queryKey: ["my-media-facilities", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("media_facilities")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MediaFacility[];
    },
    enabled: !!profileId,
  });

  // Fetch shows for a facility
  const { data: shows = [] } = useQuery({
    queryKey: ["media-shows", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("media_shows")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MediaShow[];
    },
    enabled: !!profileId,
  });

  // Create facility mutation
  const createFacility = useMutation({
    mutationFn: async (facility: {
      name: string;
      facility_type: "tv" | "podcast" | "radio";
      city_id?: string;
      specialization?: string;
    }) => {
      if (!profileId) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("media_facilities")
        .insert({ ...facility, profile_id: profileId } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-media-facilities", profileId] });
      toast.success("Facility created successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to create facility", { description: error.message });
    },
  });

  // Create show mutation
  const createShow = useMutation({
    mutationFn: async (show: {
      facility_id: string;
      show_name: string;
      show_format?: string;
      target_audience?: string;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("media_shows")
        .insert({ ...show, user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-shows", userId] });
      toast.success("Show created successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to create show", { description: error.message });
    },
  });

  return {
    facilities,
    myFacilities,
    shows,
    isLoading: facilitiesLoading || myFacilitiesLoading,
    createFacility: createFacility.mutate,
    createShow: createShow.mutate,
    isCreatingFacility: createFacility.isPending,
    isCreatingShow: createShow.isPending,
  };
};
