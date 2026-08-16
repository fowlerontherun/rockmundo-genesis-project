import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

type OrderSpec = { column: string; ascending?: boolean };

/**
 * Fetches every venue row, paging past Supabase's 1000-row response cap.
 * Without this, players only ever see the first 1000 venues in the world.
 */
export async function fetchAllVenues<T = any>(
  select: string,
  order: OrderSpec = { column: "name", ascending: true },
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  // Hard safety bound so a bad query can never loop forever.
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("venues")
      .select(select)
      .order(order.column, { ascending: order.ascending ?? true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
