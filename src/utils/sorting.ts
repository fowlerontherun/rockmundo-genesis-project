export type SortableRecord = Record<string, unknown>;

const normalizeNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeString = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

export const sortByOptionalKeys = <T extends SortableRecord>(
  records: T[],
  numericKeys: (keyof T | string)[] = [],
  textKeys: (keyof T | string)[] = []
): T[] => {
  const sorted = [...records];

  sorted.sort((aRecord, bRecord) => {
    const a = aRecord as SortableRecord;
    const b = bRecord as SortableRecord;

    for (const key of numericKeys) {
      const keyName = String(key);
      const aValue = normalizeNumber(a[keyName]);
      const bValue = normalizeNumber(b[keyName]);

      const aHasValue = aValue !== null;
      const bHasValue = bValue !== null;

      if (aHasValue && bHasValue && aValue !== bValue) {
        return (aValue as number) - (bValue as number);
      }

      if (aHasValue && !bHasValue) {
        return -1;
      }

      if (!aHasValue && bHasValue) {
        return 1;
      }
    }

    for (const key of textKeys) {
      const keyName = String(key);
      const aValue = normalizeString(a[keyName]);
      const bValue = normalizeString(b[keyName]);

      const aHasValue = typeof aValue === "string";
      const bHasValue = typeof bValue === "string";

      if (aHasValue && bHasValue) {
        const comparison = (aValue as string).localeCompare(bValue as string);
        if (comparison !== 0) {
          return comparison;
        }
      } else if (aHasValue) {
        return -1;
      } else if (bHasValue) {
        return 1;
      }
    }

    return 0;
  });

  return sorted;
};
