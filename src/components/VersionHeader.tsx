import { Badge } from "@/components/ui/badge";

export const version = "1.1.750";

export function VersionHeader() {
  return (
    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
      v{version}
    </Badge>
  );
}
