import { Link } from "react-router-dom";
import { ArrowRight, Award, Gamepad2, GraduationCap, Music2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EducationLearningActionsProps {
  isMobile: boolean;
  canTeach: boolean;
  certificatesEarned: number;
}

/** Lightweight entry points to existing practice, rehearsal, mastery and teaching systems. */
export function EducationLearningActions({ isMobile, canTeach, certificatesEarned }: EducationLearningActionsProps) {
  const educationBase = isMobile ? "/mobile/education" : "/education";
  return (
    <section className="space-y-3" aria-label="Other ways to learn">
      <div>
        <h2 className="text-lg font-semibold">Learn by playing</h2>
        <p className="text-sm text-muted-foreground">
          Keep making music through gigs, songs and recordings. For focused skill XP, try a quick challenge, rehearse or learn together.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium"><Gamepad2 className="h-4 w-4 text-primary" /> Practice challenge</div>
          <p className="text-sm text-muted-foreground">Play a short rhythm challenge. Better accuracy earns more practice XP.</p>
          {isMobile ? <p className="text-xs text-muted-foreground">Play in the full desktop game.</p> : (
            <Button size="sm" variant="outline" asChild><Link to="/stage-practice">Start practice <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium"><Music2 className="h-4 w-4 text-primary" /> Band rehearsal</div>
          <p className="text-sm text-muted-foreground">Completed rehearsals build chemistry and earn XP. Stronger bandmates give a small skill-learning boost.</p>
          {isMobile ? <p className="text-xs text-muted-foreground">Schedule rehearsals in the full desktop game.</p> : (
            <Button size="sm" variant="outline" asChild><Link to="/rehearsals">Manage rehearsals <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          )}
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4 text-primary" /> Learn together</div>
          <p className="text-sm text-muted-foreground">
            {canTeach ? "Your skills qualify you to offer mentoring or paid player classes." : "Find a mentor or player class. At skill level 5, you can teach others too."}
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to={`${educationBase}?tab=find&method=players`}>{canTeach ? "Teach or find a mentor" : "Find a mentor"} <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium"><GraduationCap className="h-4 w-4 text-primary" /> Qualifications & mastery</div>
          <p className="text-sm text-muted-foreground">
            {certificatesEarned} completed university {certificatesEarned === 1 ? "course" : "courses"} on your record. Specialisations are a longer-term goal once a skill is mastered.
          </p>
          {isMobile ? (
            <Button size="sm" variant="outline" asChild><Link to={`${educationBase}?tab=find&method=university`}>Explore courses <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          ) : (
            <Button size="sm" variant="outline" asChild><Link to="/skills?tab=mastery"><Award className="mr-1.5 h-3.5 w-3.5" /> View specialisations</Link></Button>
          )}
        </CardContent></Card>
      </div>
    </section>
  );
}
