export interface CreatedAtId {
  created_at: string;
  id: string;
}

/**
 * PostgREST filters: rows strictly earlier in descending (created_at, id).
 * The unique ID disambiguates a batch of rows written at the same timestamp.
 */
export function beforeCreatedAtId(cursor: CreatedAtId): string {
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}

export function lastCreatedAtIdCursor(rows: ReadonlyArray<CreatedAtId>): CreatedAtId | null {
  const last = rows[rows.length - 1];
  return last ? { created_at: last.created_at, id: last.id } : null;
}
