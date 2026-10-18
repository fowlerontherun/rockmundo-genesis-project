import { useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { GraduationCap, LayoutDashboard, ListChecks, Search } from "lucide-react";
import { EducationOverviewTab } from "@/features/education/components/EducationOverviewTab";
import { EducationMySkillsTab } from "@/features/education/components/EducationMySkillsTab";
import { EducationExploreTab } from "@/features/education/components/EducationExploreTab";

type EducationMainTab = "overview" | "skills" | "find";

/** Preserve old deep links so existing schedules, hubs and bookmarks still work. */
const resolveTab = (requested: string | null): EducationMainTab => {
  if (requested === "skills") return "skills";
  if (["find", "books", "university", "videos", "mentors", "players"].includes(requested ?? "")) return "find";
  return "overview";
};

const Education = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = resolveTab(requestedTab);
  const luthieryFocus = searchParams.get("skill") === "luthiery";

  const switchTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    if (value === "find" && !next.get("method") && ["books", "university", "videos", "mentors", "players"].includes(requestedTab ?? "")) {
      next.set("method", requestedTab!);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <FMPageScaffold
      title="Education"
      subtitle="See what you know, track your progress and discover what to learn next."
      icon={GraduationCap}
      backTo="/hub/character"
      backLabel="Back to Character Hub"
    >
      {luthieryFocus && (
        <Alert className="mt-6 border-primary/30 bg-primary/5">
          <AlertTitle>Learning Luthiery</AlertTitle>
          <AlertDescription>Start with Luthiery Basics. Professional and Mastery study become visible when the preceding tier reaches its configured maximum level.</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={switchTab} className="mt-6 space-y-5">
        <TabsList className="grid grid-cols-3 w-full h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm">
            <ListChecks className="h-4 w-4" /> My Skills
          </TabsTrigger>
          <TabsTrigger value="find" className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm">
            <Search className="h-4 w-4" /> Find Learning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
          <EducationOverviewTab />
        </TabsContent>
        <TabsContent value="skills" className="space-y-6 focus-visible:outline-none">
          <EducationMySkillsTab />
        </TabsContent>
        <TabsContent value="find" className="space-y-6 focus-visible:outline-none">
          <EducationExploreTab />
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
};

export default Education;
