import type { PostgrestError } from "@supabase/supabase-js";

const TABLE_SCHEMA_CACHE_CODES = new Set(["42P01", "PGRST301"]);

const normalizeCode = (code: string | null | undefined): string => {
  if (typeof code !== "string") {
    return "";
  }

  return code.trim().toUpperCase();
};

const normalizeMessage = (message: string | null | undefined): string => {
  if (typeof message !== "string") {
    return "";
  }

  return message.trim().toLowerCase();
};

export const isTableMissingFromSchemaCache = (error: unknown): error is PostgrestError => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { code, message } = error as {
    code?: string | null;
    message?: string | null;
  };

  const normalizedCode = normalizeCode(code);
  if (normalizedCode && TABLE_SCHEMA_CACHE_CODES.has(normalizedCode)) {
    return true;
  }

  const normalizedMessage = normalizeMessage(message);
  if (
    normalizedMessage.includes("schema cache") &&
    (normalizedMessage.includes("table") || normalizedMessage.includes("relation"))
  ) {
    return true;
  }

  return false;
};

export type SchemaCacheTableError = PostgrestError & {
  code: "42P01" | "PGRST301";
};
