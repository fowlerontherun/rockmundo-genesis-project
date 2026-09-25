import { supabase } from "@/integrations/supabase/client";

type CrewError = { message: string; code?: string };
type CrewResponse<T> = { data: T[] | null; error: CrewError | null };

/**
 * Small typed projection for the new crew tables and RPCs until the generated
 * database types are refreshed in the normal Supabase generation workflow.
 */
interface CrewQuery<T> extends PromiseLike<CrewResponse<T>> {
  eq(column: string, value: string): CrewQuery<T>;
  order(column: string, options?: { ascending?: boolean }): CrewQuery<T>;
  limit(count: number): CrewQuery<T>;
}

interface CrewDatabase {
  from<T>(table: string): { select(columns: string): CrewQuery<T> };
  rpc(name: string, args: Record<string, unknown>): Promise<{ error: CrewError | null; data?: unknown }>;
}

export const crewDb = supabase as unknown as CrewDatabase;
