import { supabase } from './client';
import type { Database } from './types';

export type University = Database['public']['Tables']['universities']['Row'];

export const fetchUniversities = async (): Promise<University[]> => {
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .order('prestige', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch universities: ${error.message}`);
  }

  return data ?? [];
};
