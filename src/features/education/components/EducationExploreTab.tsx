import { useSearchParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { BookOpen, GraduationCap, PlaySquare, Users, UserRoundSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BooksTab } from "./BooksTab";
import { UniversityTab } from "./UniversityTab";
import { VideosTab } from "./VideosTab";
import { MentorsTab } from "./MentorsTab";
import { PlayerLearningNetwork } from "./PlayerLearningNetwork";
import { formatEducationSkillName } from "../utils/educationUi";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useSkillTierAccess } from "../hooks/useSkillTierAccess";
import { useLearningMethodCounts } from "../hooks/useLearningMethodCounts";

const methods = [
  { value: "books", label: "Books", icon: BookOpen },
  { value: "university", label: "University", icon: GraduationCap },
  { value: "videos", label: "Videos", icon: PlaySquare },
  { value: "mentors", label: "Mentors", icon: Users },
  { value: "players", label: "Players", icon: UserRoundSearch },
] as const;

type LearningMethod = (typeof methods)[number]["value"];

export const EducationExploreTab = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("method") ?? params.get("tab");
  const method: LearningMethod = methods.some((item) => item.value === requested)
    ? requested as LearningMethod : "books";
  const skill = params.get("skill");
  const { profileId } = useActiveProfile();
  const access = useSkillTierAccess(profileId, skill ? [skill] : []);
  const skillVisible = Boolean(skill && access.data?.get(skill) === true);
  const counts = useLearningMethodCounts(skill, skillVisible);

  // A manually constructed URL must never reveal higher-tier discovery details.
  useEffect(() => {
    if (!skill || !access.isSuccess || skillVisible) return;
    const next = new URLSearchParams(params);
    next.delete("skill");
    setParams(next, { replace: true });
  }, [skill, skillVisible, access.isSuccess, params, setParams]);

  const selectMethod = (nextMethod: LearningMethod) => {
    const next = new URLSearchParams(params);
    next.set("tab", "find");
    next.set("method", nextMethod);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Find Learning</h2>
        <p className="text-sm text-muted-foreground">Choose a skill, then compare the ways you can learn it. Only unlocked tiers are shown.</p>
      </div>
      {skill && skillVisible ? (
        <div className="rounded-lg border bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">Focused skill: <strong>{formatEducationSkillName(skill)}</strong></span>
          <Button asChild size="sm" variant="outline"><Link to="/education?tab=skills">Change skill</Link></Button>
        </div>
      ) : (
        <Card className="border-dashed"><CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">{skill ? "Checking skill access..." : "Not sure what to learn?"}</p>
            <p className="text-muted-foreground">{skill ? "Only previously unlocked skills can be selected here." : "Start with a skill and the available learning options will follow."}</p>
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/education?tab=skills"><Search className="mr-2 h-4 w-4" /> Choose skill</Link></Button>
        </CardContent></Card>
      )}
      {skillVisible && (
        <p className="text-xs text-muted-foreground" role="status">
          {counts.isLoading ? "Checking learning resources..." : "Resource counts show catalogue entries, not guaranteed class places or mentor bookings."}
        </p>
      )}
      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Learning methods">
        {methods.map((item) => {
          const Icon = item.icon;
          return (
            <Button key={item.value} type="button" size="sm"
              variant={method === item.value ? "default" : "outline"}
              onClick={() => selectMethod(item.value)}
              aria-current={method === item.value ? "page" : undefined}
              className="shrink-0"
            >
              <Icon className="mr-2 h-4 w-4" />{item.label}
              {skillVisible && counts.data && item.value !== "players" && counts.data[item.value] !== null && (
                <span className="ml-1 text-xs opacity-80">({counts.data[item.value]})</span>
              )}
            </Button>
          );
        })}
      </nav>
      {(!skill || skillVisible) && (
        <>
          {method === "books" && <BooksTab />}
          {method === "university" && <UniversityTab />}
          {method === "videos" && <VideosTab />}
          {method === "mentors" && <MentorsTab />}
          {method === "players" && <PlayerLearningNetwork />}
        </>
      )}
    </div>
  );
};
