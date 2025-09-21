import type { TierName } from "@/data/skillTree";

export const parseString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseTier = (value: unknown): TierName | undefined => {
  const normalized = parseString(value);
  if (!normalized) {
    return undefined;
  }

  if (normalized === "Basic" || normalized === "Professional" || normalized === "Mastery") {
    return normalized;
  }

  return undefined;
};

export const getMetadataValue = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): unknown => {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  return metadata[key];
};

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
