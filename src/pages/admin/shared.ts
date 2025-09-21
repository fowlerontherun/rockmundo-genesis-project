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

export const formatNumberInput = (value: number | null | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return "";
  }

  return `${value}`;
};

export const parseNumberInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseCommaSeparatedInput = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const formatCommaSeparatedList = (value: string[] | null | undefined): string =>
  Array.isArray(value) && value.length > 0 ? value.join(", ") : "";
