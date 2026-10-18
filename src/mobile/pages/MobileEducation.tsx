import { useSearchParams } from "react-router-dom";
import { LayoutDashboard, ListChecks, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EducationOverviewTab } from "@/features/education/components/EducationOverviewTab";
import { EducationMySkillsTab } from "@/features/education/components/EducationMySkillsTab";
import { EducationExploreTab } from "@/features/education/components/EducationExploreTab";
import { MobileSectionHeader } from "../components/MobilePrimitives";

type EducationTab = "overview" | "skills" | "find";
const resolveTab = (tab: string | null): EducationTab =>
  tab === "skills" ? "skills" : ["find", "books", "university", "videos", "mentors", "players"].includes(tab ?? "") ? "find" : "overview";

/** Same learning queries, skill gating and study actions as the desktop education screen. */
export default function MobileEducation() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const activeTab = resolveTab(requestedTab);

  const switchTab = (tab: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    if (tab === "find" && !next.get("method") && ["books", "university", "videos", "mentors", "players"].includes(requestedTab ?? "")) {
      next.set("method", requestedTab!);
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="min-w-0 space-y-4">
      <MobileSectionHeader eyebrow="Mobile Companion" title="Education" description="Track your skills, keep learning and choose what to study next." />
      {params.get("skill") === "luthiery" && (
        <Alert><AlertDescription>Start with Luthiery Basics. Professional and Mastery study unlock once you complete the earlier tier.</AlertDescription></Alert>
      )}
      <Tabs value={activeTab} onValueChange={switchTab} className="min-w-0 space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="overview" className="min-w-0 gap-1 px-1 py-3 text-xs"><LayoutDashboard className="h-4 w-4 shrink-0" />Overview</TabsTrigger>
          <TabsTrigger value="skills" className="min-w-0 gap-1 px-1 py-3 text-xs"><ListChecks className="h-4 w-4 shrink-0" />My Skills</TabsTrigger>
          <TabsTrigger value="find" className="min-w-0 gap-1 px-1 py-3 text-xs"><Search className="h-4 w-4 shrink-0" />Find Learning</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="min-w-0 space-y-4"><EducationOverviewTab /></TabsContent>
        <TabsContent value="skills" className="min-w-0 space-y-4"><EducationMySkillsTab /></TabsContent>
        <TabsContent value="find" className="min-w-0 space-y-4"><EducationExploreTab /></TabsContent>
      </Tabs>
    </div>
  );
}
