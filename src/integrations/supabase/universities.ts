import { supabase } from "./client";

export interface University {
  id: string;
  name: string;
  city: string | null;
  prestige: number | null;
  quality_of_learning: number | null;
  course_cost_modifier: number | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const fetchUniversities = async (): Promise<University[]> => {
  const { data, error } = await supabase
    .from("universities")
    .select(
      "id, name, city, prestige, quality_of_learning, course_cost_modifier, description, created_at, updated_at",
    )
    .order("prestige", { ascending: false })
    .order("quality_of_learning", { ascending: false });

  if (error) throw error;
  return (data ?? []) as University[];
};
