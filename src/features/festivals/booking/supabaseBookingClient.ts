import { supabase } from '@/integrations/supabase/client';

type QueryResult<T> = PromiseLike<{ data: T | null; error: Error | null }>;
interface QueryBuilder<T> extends QueryResult<T[]> { select(columns?: string): QueryBuilder<T>; eq(column: string, value: string): QueryBuilder<T>; order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>; single(): QueryResult<T>; }
interface BookingSupabaseClient { rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }>; from<T = unknown>(table: string): QueryBuilder<T>; }

export const bookingSupabase = supabase as unknown as BookingSupabaseClient;
