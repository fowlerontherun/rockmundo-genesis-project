import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";

export const CurrentLearningSection = () => {
  const { user } = useAuth();

  const { data: activeEnrollment } = useQuery({
    queryKey: ["current_enrollment", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return null;

      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select(`
          *,
          universities (name),
          university_courses (name, skill_slug)
        `)
        .eq("profile_id", profile.id)
        .in("status", ["enrolled", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: activeReading } = useQuery({
    queryKey: ["current_reading", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return null;

      const { data, error } = await supabase
        .from("player_book_reading_sessions")
        .select(`
          *,
          skill_books (title, skill_slug)
        `)
        .eq("profile_id", profile.id)
        .eq("status", "reading")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!activeEnrollment && !activeReading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Learning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeEnrollment && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <GraduationCap className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-sm">{activeEnrollment.university_courses?.name}</p>
              <p className="text-xs text-muted-foreground">
                at {activeEnrollment.universities?.name}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {activeEnrollment.university_courses?.skill_slug}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Day {activeEnrollment.days_attended}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeReading && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <BookOpen className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-sm">{activeReading.skill_books?.title}</p>
              <p className="text-xs text-muted-foreground">Book Reading</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {activeReading.skill_books?.skill_slug}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Day {activeReading.days_read}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
