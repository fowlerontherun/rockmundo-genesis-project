import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, GraduationCap, Search, MapPin, Globe, Filter, Music, Mic, Headphones, Radio, Zap, PenTool, Cpu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface CourseWithUniversity {
  id: string;
  name: string;
  skill_slug: string;
  base_price: number;
  base_duration_days: number | null;
  required_skill_level: number | null;
  university_id: string;
  universities: {
    id: string;
    name: string;
    city: string | null;
    prestige: number | null;
  } | null;
}

// Skill category mapping for filters
const SKILL_CATEGORIES = [
  { value: "all", label: "All Categories", icon: Filter },
  { value: "instrument", label: "Instruments", icon: Music },
  { value: "vocals", label: "Vocals & Lyrics", icon: Mic },
  { value: "genre", label: "Genres", icon: Radio },
  { value: "production", label: "Production", icon: Headphones },
  { value: "performance", label: "Performance", icon: Zap },
  { value: "composition", label: "Composition", icon: PenTool },
  { value: "technology", label: "Technology", icon: Cpu },
] as const;

type SkillCategory = (typeof SKILL_CATEGORIES)[number]["value"];

function getSkillCategory(slug: string): SkillCategory {
  // Instruments
  if (
    /^(guitar|bass|drums|piano|basic_keyboard|basic_strings|basic_brass|basic_woodwinds|basic_percussions|basic_electronic_instruments|professional_keyboard|professional_strings|professional_bass|guitar_mastery|drums_mastery|piano_mastery)/.test(slug)
  ) return "instrument";
  // Vocals
  if (/^(basic_singing|basic_lyrics|professional_singing|lead_vocals)/.test(slug)) return "vocals";
  // Production
  if (/(daw|beatmaking|mixing|mastering|record_production|sampling|sound_design|vocal_tuning)/.test(slug)) return "production";
  // Performance
  if (/(showmanship|crowd|stage|streaming|social_media|visual_performance|live_looping|dj|midi|rapping)/.test(slug)) return "performance";
  // Composition
  if (/(composing|songwriting|arrangement)/.test(slug)) return "composition";
  // Technology
  if (/(ai_music)/.test(slug)) return "technology";
  // Genre
  if (/(rock|pop|rnb|country|reggae|classical|metal|jazz|blues|hip_hop|edm|punk|flamenco|trap|drill|synthwave|hyperpop|indie|lofi|world|african|afrobeats|latin|kpop|jpop|electronica|soul|metalcore|neo_soul|amapiano)/.test(slug)) return "genre";
  return "genre"; // default to genre for remaining skill slugs
}

function formatSkillSlug(slug: string): string {
  return slug
    .replace(/^(basic_|professional_|instruments_basic_|genres_basic_)/, "")
    .replace(/_mastery$/, " (mastery)")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const UniversityTab = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("current");
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>("all");
  const [viewMode, setViewMode] = useState<"universities" | "courses">("universities");

  // Fetch profile with current city
  const { data: profile } = useQuery({
    queryKey: ["profile_with_city", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          current_city_id,
          cities:current_city_id (
            id,
            name
          )
        `)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const currentCityName = (profile?.cities as any)?.name || null;

  const { data: currentEnrollment } = useQuery({
    queryKey: ["current_enrollment", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select(`
          id,
          university_id,
          course_id,
          university_courses (
            name
          ),
          universities (
            name
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

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["all_courses_with_unis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("university_courses")
        .select(`
          id,
          name,
          skill_slug,
          base_price,
          base_duration_days,
          required_skill_level,
          university_id,
          universities (
            id,
            name,
            city,
            prestige
          )
        `)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CourseWithUniversity[];
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

  // Get unique cities from universities
  const availableCities = useMemo(() => {
    if (!universities) return [];
    const cities = new Set(universities.map(u => u.city).filter(Boolean) as string[]);
    return Array.from(cities).sort();
  }, [universities]);

  // Determine which city to filter by
  const filterCity = useMemo(() => {
    if (selectedCity === "all") return null;
    if (selectedCity === "current") return currentCityName;
    return selectedCity;
  }, [selectedCity, currentCityName]);

  // Filter universities
  const filteredUniversities = useMemo(() => {
    if (!universities) return [];
    
    let result = universities;
    
    if (filterCity) {
      result = result.filter(u => u.city === filterCity);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const queryWords = query.split(/\s+/);
      result = result.filter(u => {
        const searchText = [u.name, u.city, u.description].filter(Boolean).join(" ").toLowerCase();
        return queryWords.every(word => searchText.includes(word));
      });
    }
    
    return result;
  }, [universities, filterCity, searchQuery]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    
    let result = courses;
    
    // Filter by city
    if (filterCity) {
      result = result.filter(c => c.universities?.city === filterCity);
    }

    // Filter by skill category
    if (selectedCategory !== "all") {
      result = result.filter(c => getSkillCategory(c.skill_slug) === selectedCategory);
    }
    
    // Filter by search query — match against name, formatted skill, university name, city
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const queryWords = query.split(/\s+/);
      result = result.filter(c => {
        const formattedSkill = formatSkillSlug(c.skill_slug);
        const searchText = [
          c.name,
          c.skill_slug.replace(/_/g, " "),
          formattedSkill,
          c.universities?.name,
          c.universities?.city,
        ].filter(Boolean).join(" ").toLowerCase();
        return queryWords.every(word => searchText.includes(word));
      });
    }
    
    return result;
  }, [courses, filterCity, searchQuery, selectedCategory]);

  // Group filtered universities by city
  const groupedUniversities = useMemo(() => {
    const groups = new Map<string, University[]>();
    for (const uni of filteredUniversities) {
      const city = uni.city || "Other";
      const existing = groups.get(city) || [];
      existing.push(uni);
      groups.set(city, existing);
    }
    return Object.fromEntries(groups.entries());
  }, [filteredUniversities]);

  // Count courses per category for badges
  const categoryCounts = useMemo(() => {
    if (!courses) return {};
    const counts: Record<string, number> = {};
    let cityFiltered = courses;
    if (filterCity) {
      cityFiltered = cityFiltered.filter(c => c.universities?.city === filterCity);
    }
    for (const c of cityFiltered) {
      const cat = getSkillCategory(c.skill_slug);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [courses, filterCity]);

  const hasActiveFilters = searchQuery.trim() || selectedCity !== "current" || selectedCategory !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCity("current");
    setSelectedCategory("all");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Academic Routes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore universities and courses across the globe.
        </p>
      </div>

      {currentEnrollment && (
        <Alert className="border-primary/50 bg-primary/10">
          <GraduationCap className="h-4 w-4" />
          <AlertDescription>
            You are currently enrolled in <strong>{currentEnrollment.university_courses?.name}</strong> at{" "}
            <strong>{currentEnrollment.universities?.name}</strong>.{" "}
            <Link to={`/university/${currentEnrollment.university_id}`} className="underline hover:text-primary">
              View enrollment details
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={viewMode === "universities" ? "Search universities..." : "Search courses by name, skill, university..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <MapPin className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {currentCityName ? `My City (${currentCityName})` : "My City"}
                </div>
              </SelectItem>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  All Cities
                </div>
              </SelectItem>
              {availableCities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category filter chips — only show in courses view */}
        {viewMode === "courses" && (
          <div className="flex flex-wrap gap-2">
            {SKILL_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = cat.value === "all" ? undefined : categoryCounts[cat.value];
              const isActive = selectedCategory === cat.value;
              return (
                <Button
                  key={cat.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                  {count !== undefined && (
                    <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 px-1.5 py-0 text-[10px]">
                      {count}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {searchQuery.trim() && (
              <Badge variant="secondary" className="gap-1 text-xs">
                "{searchQuery}"
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
              </Badge>
            )}
            {selectedCity !== "current" && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {selectedCity === "all" ? "All Cities" : selectedCity}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCity("current")} />
              </Badge>
            )}
            {selectedCategory !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {SKILL_CATEGORIES.find(c => c.value === selectedCategory)?.label}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory("all")} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAllFilters}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "universities" | "courses")}>
        <TabsList>
          <TabsTrigger value="universities" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Universities</span>
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Browse Courses</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="universities" className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading universities...
            </div>
          )}

          {!isLoading && filteredUniversities.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <GraduationCap className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-4">No universities found{filterCity ? ` in ${filterCity}` : ""}.</p>
              {filterCity && (
                <Button
                  variant="link"
                  onClick={() => setSelectedCity("all")}
                  className="mt-2"
                >
                  View all cities
                </Button>
              )}
            </div>
          )}

          {!isLoading &&
            Object.entries(groupedUniversities).map(([city, cityUniversities]) => (
              <div key={city} className="mb-6 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">{city}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {cityUniversities.length} {cityUniversities.length === 1 ? "university" : "universities"}
                  </Badge>
                </div>
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
                            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                              {uni.description}
                            </p>
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
        </TabsContent>

        <TabsContent value="courses" className="mt-4">
          {coursesLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading courses...
            </div>
          )}

          {!coursesLoading && filteredCourses.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Filter className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-4">No courses found{searchQuery ? ` matching "${searchQuery}"` : ""}.</p>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={clearAllFilters}
                  className="mt-2"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          )}

          {!coursesLoading && filteredCourses.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Found {filteredCourses.length} courses
                {filterCity ? ` in ${filterCity}` : ""}
                {selectedCategory !== "all" ? ` in ${SKILL_CATEGORIES.find(c => c.value === selectedCategory)?.label}` : ""}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.slice(0, 50).map((course) => (
                  <Card key={course.id} className="transition-all hover:border-primary/50">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-tight">{course.name}</h4>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {formatSkillSlug(course.skill_slug)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            ${course.base_price}
                          </Badge>
                          {course.base_duration_days && (
                            <Badge variant="secondary" className="text-xs">
                              {course.base_duration_days}d
                            </Badge>
                          )}
                          {course.required_skill_level != null && course.required_skill_level > 0 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Lvl {course.required_skill_level}+
                            </Badge>
                          )}
                        </div>
                        {course.universities && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <GraduationCap className="h-3 w-3" />
                            <span className="truncate">{course.universities.name}</span>
                          </div>
                        )}
                        {course.universities?.city && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{course.universities.city}</span>
                          </div>
                        )}
                        <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                          <Link to={`/university/${course.university_id}`}>View University</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filteredCourses.length > 50 && (
                <p className="text-center text-sm text-muted-foreground">
                  Showing first 50 of {filteredCourses.length} courses. Refine your search for more specific results.
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
