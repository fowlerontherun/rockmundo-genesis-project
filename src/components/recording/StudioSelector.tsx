import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Star, Zap, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface StudioSelectorProps {
  cityId: string;
  selectedStudio: any;
  onSelect: (studio: any) => void;
  labelCompanyId?: string | null;
}

export const StudioSelector = ({ cityId, selectedStudio, onSelect, labelCompanyId }: StudioSelectorProps) => {
  const { data: studios, isLoading } = useQuery({
    queryKey: ['city-studios', cityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('city_studios')
        .select('*, cities(name)')
        .eq('city_id', cityId);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading studios...</div>;
  }

  if (!studios || studios.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No recording studios available in this city.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Select a recording studio in your current city
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {studios.map((studio) => {
          const isLabelOwned = !!(labelCompanyId && studio.company_id && studio.company_id === labelCompanyId);

          return (
            <Card
              key={studio.id}
              className={`transition-all hover:shadow-md cursor-pointer ${
                selectedStudio?.id === studio.id ? 'ring-2 ring-primary' : ''
              } ${isLabelOwned ? 'border-green-500/50 bg-green-500/5' : ''}`}
              onClick={() => onSelect({ ...studio, isLabelOwned })}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  {studio.name}
                  {isLabelOwned && (
                    <Badge className="bg-green-600 text-white border-green-700 text-xs">
                      FREE — Label Studio
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      Quality
                    </span>
                    <span className="font-semibold">{studio.quality_rating}/100</span>
                  </div>
                  <Progress value={studio.quality_rating} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      Equipment
                    </span>
                    <span className="font-semibold">{studio.equipment_rating}/100</span>
                  </div>
                  <Progress value={studio.equipment_rating} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Hourly Rate
                  </span>
                  {isLabelOwned ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm line-through text-muted-foreground">
                        ${studio.hourly_rate.toLocaleString()}
                      </span>
                      <span className="text-lg font-bold text-green-600">FREE</span>
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      ${studio.hourly_rate.toLocaleString()}
                    </span>
                  )}
                </div>

                {studio.specialties && studio.specialties.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Specialties:</span> {studio.specialties.join(', ')}
                  </div>
                )}

                <Button
                  variant={selectedStudio?.id === studio.id ? 'default' : 'outline'}
                  className="w-full"
                  size="sm"
                >
                  {selectedStudio?.id === studio.id ? 'Selected' : 'Select Studio'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};