import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GigExperienceDTO } from "@/features/gig-experience/types";
import { metricValue } from "@/features/gig-experience/reportMetric";
import { bestSong, weakestSong, songScore } from "./reportUtils";

export function buildLessons(experience: GigExperienceDTO) {
  const worked = [...experience.lessons.worked];
  const heldBack = [...experience.lessons.heldBack];
  const recommendations = [...experience.lessons.recommendations];
  const attendance = metricValue(experience.headline.attendance, 0);
  const capacity = metricValue(experience.headline.capacity, experience.gig.venue.capacity);
  const fill = capacity > 0 ? attendance / capacity : 0;
  const best = bestSong(experience.songs);
  const weak = weakestSong(experience.songs);
  const equipment = metricValue(experience.analysis.equipmentQuality, 0);
  const crew = metricValue(experience.analysis.crewSkill, 0);
  const chemistry = metricValue(experience.analysis.bandChemistry, 0);

  if (best && songScore(best) >= 18) worked.push(`${best.title} connected strongly with the crowd.`);
  if (fill >= 0.75) worked.push("Venue demand was healthy for this room size.");
  if (equipment >= 18) worked.push("Equipment quality supported a consistent show.");
  if (chemistry >= 18) worked.push("Band chemistry helped the set hold together.");

  if (capacity > 0 && fill < 0.45) {
    heldBack.push("The room was too empty for strong atmosphere.");
    recommendations.push("Book smaller venue");
  }
  if (weak && songScore(weak) < 12) {
    heldBack.push(`${weak.title} was the weakest point in the set.`);
    recommendations.push(`Rehearse ${weak.title}`);
  }
  if (experience.songs[0] && songScore(experience.songs[0]) < 13) recommendations.push("Replace weak opener");
  if (equipment > 0 && equipment < 12) recommendations.push("Improve equipment");
  if (crew > 0 && crew < 12) recommendations.push("Hire crew");
  if (chemistry > 0 && chemistry < 12) recommendations.push("Increase chemistry");

  return {
    worked: [...new Set(worked)].slice(0, 5),
    heldBack: [...new Set(heldBack)].slice(0, 5),
    recommendations: [...new Set(recommendations)].slice(0, 5),
  };
}

export function LessonsPanel({ experience }: { experience: GigExperienceDTO }) {
  const lessons = buildLessons(experience);
  const empty = lessons.worked.length + lessons.heldBack.length + lessons.recommendations.length === 0;
  return <Card aria-labelledby="lessons-heading" className="border-primary/30 bg-primary/5">
    <CardHeader><CardTitle id="lessons-heading" className="flex items-center gap-2"><Lightbulb className="h-5 w-5" />Lessons for next gig</CardTitle></CardHeader>
    <CardContent>{empty ? <p className="text-sm text-muted-foreground">No evidence-based recommendations are available yet.</p> : <div className="grid gap-4 md:grid-cols-3">
      <LessonList icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} title="What worked" items={lessons.worked} />
      <LessonList icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} title="What didn't" items={lessons.heldBack} />
      <LessonList icon={<Lightbulb className="h-4 w-4 text-primary" />} title="Recommended actions" items={lessons.recommendations} />
    </div>}</CardContent>
  </Card>;
}
function LessonList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return <section><h3 className="mb-2 flex items-center gap-2 font-semibold">{icon}{title}</h3>{items.length ? <ul className="space-y-2 text-sm">{items.map((item) => <li key={item} className="rounded-md bg-background/80 p-2">{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">No confirmed issue.</p>}</section>;
}
