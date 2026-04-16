import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyRivalriesProps {
  companyId: string;
}

export function CompanyRivalries({ companyId }: CompanyRivalriesProps) {
  const { data: rivalries = [], isLoading } = useQuery({
    queryKey: ['company-rivalries', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_rivalries')
        .select('*, company_a:companies!company_rivalries_company_a_id_fkey(id, name, company_type), company_b:companies!company_rivalries_company_b_id_fkey(id, name, company_type)')
        .or(`company_a_id.eq.${companyId},company_b_id.eq.${companyId}`)
        .order('intensity', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse h-24 bg-muted rounded" />;
  }

  if (rivalries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Swords className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No active rivalries. Competing for contracts may spark one.</p>
        </CardContent>
      </Card>
    );
  }

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 8) return "text-destructive";
    if (intensity >= 5) return "text-amber-400";
    if (intensity >= 3) return "text-blue-400";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-2">
      {rivalries.map((rivalry: any) => {
        const rival = rivalry.company_a_id === companyId ? rivalry.company_b : rivalry.company_a;
        return (
          <Card key={rivalry.id} className="bg-card/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Swords className={cn("h-4 w-4", getIntensityColor(rivalry.intensity))} />
                  <span className="text-sm font-medium">{rival?.name || 'Unknown'}</span>
                  <Badge variant="outline" className="text-[10px]">{rivalry.rivalry_type}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(rivalry.intensity, 10))].map((_, i) => (
                    <Flame key={i} className={cn("h-3 w-3", getIntensityColor(rivalry.intensity))} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
