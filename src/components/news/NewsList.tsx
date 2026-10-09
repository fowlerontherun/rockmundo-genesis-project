import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

type NewsListProps<T> = {
  title: string;
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyText?: string;
  defaultOpen?: boolean;
  className?: string;
};

export function NewsList<T>({
  title, items, itemKey, renderItem, emptyText = "No news to report.",
  defaultOpen = false, className = "",
}: NewsListProps<T>) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  useEffect(() => { setPage(0); }, [items.length]);
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  return (
    <details open={undefined} className={`group rounded-md border border-foreground/30 bg-card/60 ${className}`} {...(defaultOpen ? { open: true } : {})}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 font-serif font-bold [&::-webkit-details-marker]:hidden">
        <span>{title} <span className="ml-1 text-xs font-normal text-muted-foreground">({items.length})</span></span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-3 pb-3">
        {items.length ? items.slice(start, start + PAGE_SIZE).map(item => (
          <div key={itemKey(item)} className="border-b border-border/40 py-2 last:border-0">{renderItem(item)}</div>
        )) : <p className="py-3 text-sm text-muted-foreground">{emptyText}</p>}
        {totalPages > 1 && (
          <nav aria-label={`${title} pages`} className="mt-3 flex items-center justify-between gap-2">
            <Button type="button" size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {safePage + 1} of {totalPages}</span>
            <Button type="button" size="sm" variant="outline" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </nav>
        )}
      </div>
    </details>
  );
}
