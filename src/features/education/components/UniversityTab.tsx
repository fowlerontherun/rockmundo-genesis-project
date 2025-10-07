import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, MapPin, TrendingUp, DollarSign } from "lucide-react";

interface University {
  id: string;
  name: string;
  city: string | null;
  prestige: number | null;
  quality_of_learning: number | null;
  course_cost_modifier: number | null;
  description: string | null;
}

export const UniversityTab = () => {
  const navigate = useNavigate();

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
        .select("university_id, is_active");
      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((course) => {
        if (course.is_active) {
          counts[course.university_id] = (counts[course.university_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>Loading universities...</p>
        </CardContent>
      </Card>
    );
  }

  const groupedByCity = universities?.reduce((acc, uni) => {
    const city = uni.city || "Other";
    if (!acc[city]) acc[city] = [];
    acc[city].push(uni);
    return acc;
  }, {} as Record<string, University[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Universities</CardTitle>
        <CardDescription>
          Enroll in courses to improve your skills and advance your career.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedByCity || {}).map(([city, universities]) => (
          <div key={city} className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {city}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {universities.map((uni) => (
                <Card key={uni.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base line-clamp-1">
                          {uni.name}
                        </CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {uni.prestige}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Quality: {uni.quality_of_learning}
                          </Badge>
                        </div>
                      </div>
                      <GraduationCap className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {uni.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {uni.course_cost_modifier}x cost
                      </span>
                      <span>
                        {courseCounts?.[uni.id] || 0} courses
                      </span>
                    </div>
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => navigate(`/university/${uni.id}`)}
                    >
                      Browse Courses
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
