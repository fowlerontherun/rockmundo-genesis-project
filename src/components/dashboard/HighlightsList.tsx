import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface HighlightItem {
  title: string;
  value?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export interface HighlightsListProps {
  title: string;
  description?: string;
  items: HighlightItem[];
  emptyMessage?: string;
  className?: string;
}

export const HighlightsList = ({
  title,
  description,
  items,
  emptyMessage = "No data available yet.",
  className,
}: HighlightsListProps) => {
  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item, index) => (
              <li key={index} className={cn("flex items-start gap-3", item.className)}>
                {item.icon ? (
                  <div className="mt-0.5 rounded-md bg-muted p-1.5 text-muted-foreground">
                    {item.icon}
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                    {item.value ? (
                      <span className="text-sm text-muted-foreground">{item.value}</span>
                    ) : null}
                  </div>
                  {item.description ? (
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  ) : null}
                  {item.meta ? <div className="text-xs text-muted-foreground">{item.meta}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default HighlightsList;
