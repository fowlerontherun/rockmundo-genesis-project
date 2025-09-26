// Stub implementation for universities functionality
// This table will be implemented in a future update

export interface University {
  id: string;
  name: string;
  city?: string;
  prestige: number;
  quality_of_learning: number;
  course_cost: number;
  created_at: string;
  updated_at: string;
}

export const fetchUniversities = async (): Promise<University[]> => {
  console.warn('Universities table not yet implemented');
  return [];
};
