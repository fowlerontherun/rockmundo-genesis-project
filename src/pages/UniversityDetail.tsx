import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, GraduationCap, Clock, DollarSign, TrendingUp, Users, ChevronDown, CalendarCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { EnrollmentProgressCard } from "@/components/university/EnrollmentProgressCard";
import { AttendanceCard } from "@/components/university/AttendanceCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUniversityAttendance } from "@/hooks/useUniversityAttendance";
import { format } from "date-fns";

const formatClassWindowLabel = (startHour: number, endHour: number) => {
  const sanitizedStart = Math.min(Math.max(Math.floor(startHour), 0), 23);
  const sanitizedEnd = Math.min(Math.max(Math.floor(endHour), sanitizedStart + 1), 24);
  const startDate = new Date();
  startDate.setHours(sanitizedStart, 0, 0, 0);
  const endDate = new Date();
  endDate.setHours(sanitizedEnd, 0, 0, 0);
  return `${format(startDate, "h a")} - ${format(endDate, "h a")}`;
};

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
  class_start_hour: number | null;
  class_end_hour: number | null;
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

  const { data: courseEnrollmentCounts } = useQuery({
    queryKey: ["university_course_enrollment_counts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select("course_id")
        .eq("university_id", id)
        .in("status", ["enrolled", "in_progress"]);

      if (error) throw error;

      return (data || []).reduce((acc, enrollment) => {
        const courseId = (enrollment as { course_id: string }).course_id;
        acc[courseId] = (acc[courseId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: !!id,
  });

  const { data: coursePerformance } = useQuery({
    queryKey: ["university_course_performance", id],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const since = sevenDaysAgo.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("player_university_attendance")
        .select(`
          xp_earned,
          player_university_enrollments!inner (
            course_id,
            university_id
          )
        `)
        .eq("player_university_enrollments.university_id", id)
        .gte("attendance_date", since);

      if (error) throw error;

      return (data || []).reduce((acc, record) => {
        const enrollment = (record as any).player_university_enrollments;
        if (!enrollment?.course_id) {
          return acc;
        }

        const stats = acc[enrollment.course_id] || { totalXp: 0, count: 0 };
        stats.totalXp += record.xp_earned;
        stats.count += 1;
        acc[enrollment.course_id] = stats;
        return acc;
      }, {} as Record<string, { totalXp: number; count: number }>);
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

  // Fetch ANY current enrollment (not just this university)
  const { data: currentEnrollment } = useQuery({
    queryKey: ["current_enrollment", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select(`
          id,
          status,
          course_id,
          university_id,
          days_attended,
          total_xp_earned,
          scheduled_end_date,
          payment_amount,
          auto_attend,
          university_courses (
            name,
            base_duration_days
          ),
          universities (
            name
          ),
          player_university_attendance (
            attendance_date,
            xp_earned,
            was_locked_out
          )
        `)
        .eq("profile_id", profile.id)
        .in("status", ["enrolled", "in_progress"])
        .order("enrolled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      if (!profile || !university) throw new Error("Missing profile or university");

      // Check if already enrolled in ANY course
      if (currentEnrollment) {
        throw new Error("You are already enrolled in a course. Complete or quit it first.");
      }

      const course = courses?.find((c) => c.id === courseId);
      if (!course) throw new Error("Course not found");

      const finalPrice = Math.floor(
        course.base_price * (university.course_cost_modifier || 1.0)
      );

      if (profile.cash < finalPrice) {
        throw new Error("Insufficient funds");
      }

      if (course.max_enrollments !== null) {
        const { count, error: capacityError } = await supabase
          .from("player_university_enrollments")
          .select("id", { count: "exact", head: true })
          .eq("course_id", courseId)
          .in("status", ["enrolled", "in_progress"]);

        if (capacityError) throw capacityError;

        if ((count ?? 0) >= course.max_enrollments) {
          throw new Error("This course has reached its maximum capacity.");
        }
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

      return {
        courseName: course.name,
        classWindow: formatClassWindowLabel(
          course.class_start_hour ?? 10,
          course.class_end_hour ?? 14,
        ),
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["current_enrollment"] });
      queryClient.invalidateQueries({ queryKey: ["current_enrollment_full"] });
      queryClient.invalidateQueries({ queryKey: ["university_course_enrollment_counts", id] });
      queryClient.invalidateQueries({ queryKey: ["course_enrollment_usage"] });
      toast({
        title: "Enrollment Successful! 🎓",
        description: result
          ? `You're enrolled in ${result.courseName}! Attend between ${result.classWindow} or enable auto-attend.`
          : "You're enrolled! Enable auto-attend or attend during the class window.",
      });
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

  const calculatePrice = (basePrice?: number | null): number => {
    const normalizedPrice = typeof basePrice === "number" && !Number.isNaN(basePrice) ? basePrice : 0;
    if (!university) return normalizedPrice;
    const calculatedPrice = Math.floor(normalizedPrice * (university.course_cost_modifier || 1.0));
    return Number.isFinite(calculatedPrice) ? calculatedPrice : 0;
  };

  const getSkillLevel = (skillSlug: string) => {
    return skillProgress?.find((sp) => sp.skill_slug === skillSlug)?.current_level || 0;
  };

  const canEnroll = (course: Course) => {
    const skillLevel = getSkillLevel(course.skill_slug);
    const hasPrerequisite = skillLevel >= course.required_skill_level;
    const hasEnoughCash = (profile?.cash || 0) >= calculatePrice(course.base_price);
    const currentEnrollments = courseEnrollmentCounts?.[course.id] || 0;
    const hasCapacity =
      course.max_enrollments === null || currentEnrollments < course.max_enrollments;
    return hasPrerequisite && hasEnoughCash && hasCapacity;
  };

  const getEnrollmentMessage = (course: Course) => {
    const skillLevel = getSkillLevel(course.skill_slug);
    const price = calculatePrice(course.base_price);
    const currentEnrollments = courseEnrollmentCounts?.[course.id] || 0;

    if (skillLevel < course.required_skill_level) {
      return `Requires skill level ${course.required_skill_level} (you have ${skillLevel})`;
    }
    if ((profile?.cash || 0) < price) {
      return `Insufficient funds (need $${price.toLocaleString()})`;
    }
    if (course.max_enrollments !== null && currentEnrollments >= course.max_enrollments) {
      return "Course is at capacity";
    }
    return "";
  };

  const renderCourseCard = (course: Course) => {
    const duration = calculateDuration(course.base_duration_days);
    const price = calculatePrice(course.base_price);
    const enrollmentMsg = getEnrollmentMessage(course);
    const currentEnrollments = courseEnrollmentCounts?.[course.id] || 0;
    const atCapacity =
      course.max_enrollments !== null && currentEnrollments >= course.max_enrollments;
    const capacityLabel =
      course.max_enrollments === null
        ? `${currentEnrollments} enrolled`
        : `${currentEnrollments}/${course.max_enrollments} seats`;
    const stats = coursePerformance?.[course.id];
    const avgXp = stats && stats.count > 0 ? Math.round(stats.totalXp / stats.count) : null;
    const classWindowLabel = formatClassWindowLabel(
      course.class_start_hour ?? 10,
      course.class_end_hour ?? 14,
    );

    return (
      <Card key={course.id} className={atCapacity ? "border-destructive/40" : undefined}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>{course.name}</CardTitle>
              {course.description && <CardDescription>{course.description}</CardDescription>}
            </div>
            {atCapacity && (
              <Badge variant="destructive" className="shrink-0">
                At Capacity
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{classWindowLabel}</Badge>
            <Badge variant="outline">{capacityLabel}</Badge>
            {avgXp !== null && <Badge variant="outline">Avg {avgXp} XP (7d)</Badge>}
          </div>
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
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <span>{capacityLabel}</span>
            </div>
          </div>

          {enrollmentMsg && (
            <p className="text-sm text-destructive">{enrollmentMsg}</p>
          )}

          <Button
            className="w-full"
            disabled={!canEnroll(course) || enrollMutation.isPending || !!currentEnrollment}
            onClick={() => enrollMutation.mutate(course.id)}
          >
            {currentEnrollment
              ? "Already Enrolled Elsewhere"
              : enrollMutation.isPending
              ? "Enrolling..."
              : "Enroll Now"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const dropCourseMutation = useMutation({
    mutationFn: async () => {
      if (!currentEnrollment) return;
      
      const { error } = await supabase
        .from("player_university_enrollments")
        .update({ status: "dropped" })
        .eq("id", currentEnrollment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Course Dropped",
        description: "You have withdrawn from the course.",
      });
      queryClient.invalidateQueries({ queryKey: ["current_enrollment"] });
      queryClient.invalidateQueries({ queryKey: ["university_course_enrollment_counts", id] });
      queryClient.invalidateQueries({ queryKey: ["course_enrollment_usage"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const {
    activityStatus: universityActivityStatus,
    todayAttendance,
    canAttendClass,
    attendClass,
    isAttending,
    toggleAutoAttend,
    isTogglingAuto,
    classWindow,
  } = useUniversityAttendance(profile?.id);

  const autoAttendEnabled = Boolean((currentEnrollment as any)?.auto_attend);

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


        {/* Show enrollment progress if user is enrolled */}
        {currentEnrollment && (
          <div className="space-y-4">
            <EnrollmentProgressCard
              enrollment={currentEnrollment as any}
              onDropCourse={() => dropCourseMutation.mutate()}
            />

            {/* Attend Class Section - only show if enrolled at THIS university */}
            {currentEnrollment.university_id === id && (
              <AttendanceCard
                canAttendClass={canAttendClass}
                isAttending={isAttending}
                activityStatus={universityActivityStatus}
                autoAttendEnabled={autoAttendEnabled}
                todayAttendance={todayAttendance}
                onAttendClass={attendClass}
                onToggleAutoAttend={toggleAutoAttend}
                isTogglingAuto={isTogglingAuto}
                classWindow={classWindow}
              />
            )}

            {currentEnrollment.university_id !== id && (
              <Card className="border-amber-500/50 bg-amber-500/10">
                <CardContent className="py-4">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    You are currently enrolled at <strong>{currentEnrollment.universities?.name}</strong>. 
                    Complete or quit that course before enrolling here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

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

        {/* Collapse course list if enrolled at THIS university */}
        {currentEnrollment && currentEnrollment.university_id === id ? (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <ChevronDown className="mr-2 h-4 w-4" />
                Browse Other Courses at {university.name}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {courses?.map(renderCourseCard)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">Available Courses</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {courses?.map(renderCourseCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
