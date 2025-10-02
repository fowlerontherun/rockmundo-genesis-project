// Type helpers to handle mismatches between auto-generated types and actual database schema
// These are temporary workarounds until the types are regenerated

export const asAny = <T>(value: T): any => value as any;

export const safeInsert = <T>(data: Partial<T>): any => data as any;

export const safeUpdate = <T>(data: Partial<T>): any => data as any;

export const safeSelect = <T>(data: any): T => data as T;
