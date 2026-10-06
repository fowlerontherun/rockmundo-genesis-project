import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, Hammer, Lock, PlayCircle, Sparkles, Store, Wrench } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { useSkillSystem } from "@/hooks/useSkillSystem";

const TIERS = [
  { slug: "luthiery_basic_technical", label: "Luthiery Basics", prerequisite: null },
  { slug: "luthiery_professional_technical", label: "Professional Luthiery", prerequisite: "luthiery_basic_technical" },
  { slug: "luthiery_mastery_technical", label: "Master Luthier", prerequisite: "luthiery_professional_technical" },
] as const;

const learningRoutes = [
  { label: "Books", tab: "books", icon: BookOpen, description: "Buy and read a Luthiery handbook." },
  { label: "Mentors", tab: "mentors", icon: Sparkles, description: "Train with a specialist Luthier mentor." },
  { label: "YouTube", tab: "videos", icon: PlayCircle, description: "Use Luthiery video learning resources." },
  { label: "University", tab: "university", icon: GraduationCap, description: "Enrol on a structured Luthiery course." },
] as const;

function LuthierCareerInner() {
  const { progress, loading } = useSkillSystem();
  const levelFor = (slug: string) => Number(progress.find((entry) => entry.skill_slug === slug)?.current_level ?? 0);
  const basicLevel = levelFor("luthiery_basic_technical");
  const unlocked = basicLevel > 0;

  return (
    <FMPageScaffold
      title="Luthier"
      subtitle="Build a specialist career crafting, improving and selling player-made guitars and basses."
      icon={Hammer}
      backTo="/hub/career"
      backLabel="Back to Career"
    >
      <div className="space-y-6">
        <Card className={unlocked ? "border-primary/30" : "border-amber-500/30"}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {unlocked ? <Wrench className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-amber-500" />}
                  {unlocked ? "Luthier career unlocked" : "Luthier career locked"}
                </CardTitle>
                <CardDescription className="mt-2">
                  {unlocked
                    ? "Your character knows Luthiery Basics and can develop the craft through progressively harder builds."
                    : "Learn Luthiery Basics to unlock the career. You can start through a book, mentor, video lesson or university course below."}
                </CardDescription>
              </div>
              <Badge variant={unlocked ? "default" : "secondary"}>{loading ? "Checking…" : unlocked ? "Unlocked" : "Locked"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {unlocked ? (
              <Button asChild><Link to="/crafting"><Hammer className="mr-2 h-4 w-4" />Open Luthiery Workshop</Link></Button>
            ) : (
              <Button disabled><Lock className="mr-2 h-4 w-4" />Learn Luthiery Basics first</Button>
            )}
            <Button asChild variant="outline">
              <a href="/wiki/guides/luthiery-and-crafting.html">Read the Compendium guide</a>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier, index) => {
            const level = levelFor(tier.slug);
            const prerequisiteLevel = tier.prerequisite ? levelFor(tier.prerequisite) : 20;
            const tierUnlocked = index === 0 || prerequisiteLevel >= 20;
            return (
              <Card key={tier.slug}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{tier.label}</CardTitle>
                    <Badge variant={tierUnlocked ? "outline" : "secondary"}>{tierUnlocked ? `Level ${level}/20` : "Locked"}</Badge>
                  </div>
                  <CardDescription>
                    {tierUnlocked ? "Available to learn and improve." : "Reach level 20 in the previous Luthiery tier to unlock."}
                  </CardDescription>
                </CardHeader>
                <CardContent><Progress value={Math.min(100, level * 5)} /></CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to learn Luthiery</CardTitle>
            <CardDescription>Every Luthiery tier has visible learning routes in Education. Higher tiers appear once the previous tier reaches level 20.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {learningRoutes.map(({ label, tab, icon: Icon, description }) => (
              <Button key={tab} asChild variant="outline" className="h-auto min-h-24 justify-start whitespace-normal p-4 text-left">
                <Link to={`/education?tab=${tab}&skill=luthiery`}>
                  <Icon className="mr-3 h-5 w-5 shrink-0" />
                  <span><strong className="block">{label}</strong><span className="mt-1 block text-xs font-normal text-muted-foreground">{description}</span></span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>What a Luthier can do</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div><Hammer className="mb-2 h-5 w-5 text-primary" /><strong>Craft instruments</strong><p className="mt-1 text-sm text-muted-foreground">Choose a guitar or bass shape, five structural parts, materials, components, finish and colours.</p></div>
            <div><Wrench className="mb-2 h-5 w-5 text-primary" /><strong>Improve your workshop</strong><p className="mt-1 text-sm text-muted-foreground">Invest in workshop quality as your skill and ambitions grow.</p></div>
            <div><Store className="mb-2 h-5 w-5 text-primary" /><strong>Become a maker</strong><p className="mt-1 text-sm text-muted-foreground">Qualified Luthiers can open an instrument shop and sell unique player-made instruments.</p></div>
          </CardContent>
        </Card>
      </div>
    </FMPageScaffold>
  );
}

export default function LuthierCareer() {
  return <SkillSystemProvider><LuthierCareerInner /></SkillSystemProvider>;
}
