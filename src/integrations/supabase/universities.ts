import { supabase } from './client';
import type { Database } from './types';

export type University = Database['public']['Tables']['universities']['Row'];

export const fetchUniversities = async (): Promise<University[]> => {
  const { data, error } = await supabase
    .from('universities')
    .select('id, name, city, prestige, quality_of_learning, course_cost, created_at, updated_at')
    .order('prestige', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch universities: ${error.message}`);
  }

  return (data ?? []).map((university) => ({
    ...university,
    course_cost:
      typeof university.course_cost === 'string'
        ? Number.parseFloat(university.course_cost)
        : university.course_cost,
  }));
};
