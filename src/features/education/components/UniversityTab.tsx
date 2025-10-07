import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface University {
  id: string;
  name: string;
  city: string | null;
  prestige: number | null;
  quality_of_learning: number | null;
  course_cost_modifier: number | null;
  description: string | null;
}

interface CourseCount {
  university_id: string;
  count: number;
}

export const UniversityTab = () => {
  const { data: universities, isLoading } = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .order("prestige", { ascending: false });
      if (error) throw error;
      return data as University[];
    },
  });

  const { data: courseCounts } = useQuery({
    queryKey: ["university_course_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("university_courses")
        .select("university_id")
        .eq("is_active", true);
      if (error) throw error;

      const counts = data.reduce((acc, course) => {
        acc[course.university_id] = (acc[course.university_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(counts).map(([university_id, count]) => ({
        university_id,
        count,
      })) as CourseCount[];
    },
  });

  const groupedUniversities = universities?.reduce((acc, uni) => {
    const city = uni.city || "Other";
    if (!acc[city]) acc[city] = [];
    acc[city].push(uni);
    return acc;
  }, {} as Record<string, University[]>);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Academic Routes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore universities across the globe and unlock new learning pathways, each contributing unique skills and reputation to your journey.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading universities...
        </div>
      )}

      {!isLoading &&
        Object.entries(groupedUniversities || {}).map(([city, cityUniversities]) => (
          <div key={city} className="space-y-4">
            <h3 className="text-lg font-semibold">{city}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cityUniversities.map((uni) => {
                const courseCount = courseCounts?.find((cc) => cc.university_id === uni.id)?.count ?? 0;

                return (
                  <Card key={uni.id} className="transition-all hover:border-primary/50 hover:shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base leading-snug">{uni.name}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Prestige {uni.prestige}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Quality {uni.quality_of_learning}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {uni.description && (
                        <p className="text-sm leading-relaxed text-muted-foreground">{uni.description}</p>
                      )}
                      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Cost modifier</span>
                          <span className="font-semibold">{uni.course_cost_modifier}x</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Courses</span>
                          <span className="font-semibold">{courseCount}</span>
                        </div>
                      </div>
                      <Button asChild variant="secondary" size="sm" className="w-full">
                        <Link to={`/university/${uni.id}`}>Browse Courses</Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
};
