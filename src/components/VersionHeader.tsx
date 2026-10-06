import { Badge } from "@/components/ui/badge";

export const version = "1.0";
export const releaseLabel = "Live V1";

export function VersionHeader() {
  return (
    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
      {releaseLabel}
    </Badge>
  );
}
