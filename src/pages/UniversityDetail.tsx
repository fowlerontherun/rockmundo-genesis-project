import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, GraduationCap, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-context";

interface University {
  id: string;
  name: string;
  city: string | null;
  prestige: number | null;
  quality_of_learning: number | null;
  course_cost_modifier: number | null;
  description: string | null;
}

interface Course {
  id: string;
  skill_slug: string;
  name: string;
  description: string | null;
  base_price: number;
  base_duration_days: number;
  required_skill_level: number;
  xp_per_day_min: number;
  xp_per_day_max: number;
  max_enrollments: number | null;
  is_active: boolean;
}

interface SkillProgress {
  current_level: number;
}

export default function UniversityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: university } = useQuery({
    queryKey: ["university", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as University;
    },
    enabled: !!id,
  });

  const { data: courses } = useQuery({
    queryKey: ["university_courses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("university_courses")
        .select("*")
        .eq("university_id", id)
        .eq("is_active", true)
        .order("required_skill_level");
      if (error) throw error;
      return data as Course[];
    },
    enabled: !!id,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: skillProgress } = useQuery({
    queryKey: ["skill_progress", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_progress")
        .select("skill_slug, current_level")
        .eq("profile_id", profile!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      if (!profile || !university) throw new Error("Missing profile or university");

      const course = courses?.find((c) => c.id === courseId);
      if (!course) throw new Error("Course not found");

      const finalPrice = Math.floor(
        course.base_price * (university.course_cost_modifier || 1.0)
      );

      if (profile.cash < finalPrice) {
        throw new Error("Insufficient funds");
      }

      // Calculate duration based on quality
      const quality = university.quality_of_learning || 50;
      const durationMultiplier = (200 - quality) / 100;
      const adjustedDays = Math.ceil(course.base_duration_days * durationMultiplier);

      const scheduledEndDate = new Date();
      scheduledEndDate.setDate(scheduledEndDate.getDate() + adjustedDays);

      const { error: enrollError } = await supabase
        .from("player_university_enrollments")
        .insert({
          user_id: user!.id,
          profile_id: profile.id,
          university_id: university.id,
          course_id: courseId,
          scheduled_end_date: scheduledEndDate.toISOString(),
          payment_amount: finalPrice,
          status: "enrolled",
        });

      if (enrollError) throw enrollError;

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - finalPrice })
        .eq("id", profile.id);

      if (cashError) throw cashError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Enrollment Successful!",
        description: "You're enrolled! Classes start at 10am tomorrow.",
      });
      navigate("/education");
    },
    onError: (error: any) => {
      toast({
        title: "Enrollment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const calculateDuration = (baseDays: number) => {
    if (!university) return baseDays;
    const quality = university.quality_of_learning || 50;
    const durationMultiplier = (200 - quality) / 100;
    return Math.ceil(baseDays * durationMultiplier);
  };

  const calculatePrice = (basePrice: number) => {
    if (!university) return basePrice;
    return Math.floor(basePrice * (university.course_cost_modifier || 1.0));
  };

  const getSkillLevel = (skillSlug: string) => {
    return skillProgress?.find((sp) => sp.skill_slug === skillSlug)?.current_level || 0;
  };

  const canEnroll = (course: Course) => {
    const skillLevel = getSkillLevel(course.skill_slug);
    const hasPrerequisite = skillLevel >= course.required_skill_level;
    const hasEnoughCash = (profile?.cash || 0) >= calculatePrice(course.base_price);
    return hasPrerequisite && hasEnoughCash;
  };

  const getEnrollmentMessage = (course: Course) => {
    const skillLevel = getSkillLevel(course.skill_slug);
    const price = calculatePrice(course.base_price);

    if (skillLevel < course.required_skill_level) {
      return `Requires skill level ${course.required_skill_level} (you have ${skillLevel})`;
    }
    if ((profile?.cash || 0) < price) {
      return `Insufficient funds (need $${price.toLocaleString()})`;
    }
    return "";
  };

  if (!university) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="container mx-auto max-w-6xl space-y-6">
        <Button variant="ghost" onClick={() => navigate("/education")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Education
        </Button>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl">{university.name}</CardTitle>
                <CardDescription className="text-lg mt-2">
                  {university.city && `${university.city} • `}
                  <Badge variant="secondary">Prestige: {university.prestige}</Badge>
                  {" "}
                  <Badge variant="secondary">Quality: {university.quality_of_learning}</Badge>
                </CardDescription>
              </div>
              <GraduationCap className="h-12 w-12 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{university.description}</p>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-2xl font-bold mb-4">Available Courses</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {courses?.map((course) => {
              const duration = calculateDuration(course.base_duration_days);
              const price = calculatePrice(course.base_price);
              const enrollmentMsg = getEnrollmentMessage(course);

              return (
                <Card key={course.id}>
                  <CardHeader>
                    <CardTitle>{course.name}</CardTitle>
                    <CardDescription>{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{duration} days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>${price.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {course.xp_per_day_min}-{course.xp_per_day_max} XP/day
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Level {course.required_skill_level}+ required</span>
                      </div>
                    </div>

                    {enrollmentMsg && (
                      <p className="text-sm text-destructive">{enrollmentMsg}</p>
                    )}

                    <Button
                      className="w-full"
                      disabled={!canEnroll(course) || enrollMutation.isPending}
                      onClick={() => enrollMutation.mutate(course.id)}
                    >
                      {enrollMutation.isPending ? "Enrolling..." : "Enroll Now"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
