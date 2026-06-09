import { ReactNode, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Render the cell. If omitted, falls back to `row[key]`. */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting (default: row[key]). */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  width?: string;
  sortable?: boolean;
};

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  /** Default sort key */
  defaultSort?: { key: string; dir: "asc" | "desc" };
}

export function DataTable<T extends Record<string, any>>({
  columns, rows, rowKey, onRowClick, emptyMessage = "No data", className, defaultSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getter = col.sortValue ?? ((r: T) => r[sort.key]);
    return [...rows].sort((a, b) => {
      const av = getter(a); const bv = getter(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const handleHeader = (col: DataTableColumn<T>) => {
    if (col.sortable === false) return;
    setSort((s) =>
      s?.key === col.key
        ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: col.key, dir: "asc" }
    );
  };

  return (
    <div className={cn("border border-fm-border rounded-sm overflow-hidden bg-fm-panel", className)}>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-fm-panel-2 border-b border-fm-border">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const alignCls = col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    onClick={() => handleHeader(col)}
                    className={cn(
                      "px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-fm-fg-muted",
                      alignCls,
                      col.sortable !== false && "cursor-pointer select-none hover:text-fm-fg"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable !== false && (
                        isSorted
                          ? (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                          : <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-fm-fg-muted">{emptyMessage}</td></tr>
            ) : sorted.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-fm-border/60 h-7 transition-colors",
                  i % 2 === 0 ? "bg-fm-panel" : "bg-fm-panel-2/40",
                  onRowClick && "cursor-pointer hover:bg-fm-accent/10"
                )}
              >
                {columns.map((col) => {
                  const alignCls = col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";
                  return (
                    <td key={col.key} className={cn("px-2.5 py-1 text-fm-fg", alignCls)}>
                      {col.cell ? col.cell(row) : row[col.key]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
