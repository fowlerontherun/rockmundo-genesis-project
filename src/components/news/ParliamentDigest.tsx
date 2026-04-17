import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark } from "lucide-react";
import { useParliamentMotions, useMayorPaySettings } from "@/hooks/useParliament";
import { MOTION_STATUS_COLOURS } from "@/types/parliament";

export function ParliamentDigest() {
  const { data: motions } = useParliamentMotions("all");
  const { data: pay } = useMayorPaySettings();
  const recent = (motions ?? []).slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          World Parliament Digest
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Mayor weekly salary: <span className="font-semibold text-foreground">${((pay?.weekly_salary_per_mayor ?? 0) / 100).toLocaleString()}</span>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No recent motions.</p>
        ) : (
          recent.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold font-serif truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {m.yes_votes} yes · {m.no_votes} no
                </p>
              </div>
              <Badge variant="outline" className={MOTION_STATUS_COLOURS[m.status]}>
                {m.status}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
