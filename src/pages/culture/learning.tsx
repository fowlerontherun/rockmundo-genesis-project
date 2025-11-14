import { useMemo } from "react";
import { Award, Compass, Flame, Globe2 } from "lucide-react";

import { LanguageCourseProgressTracker } from "@/components/culture/LanguageCourseProgressTracker";
import type { LanguageCourseProgress } from "@/components/culture/LanguageCourseProgressTracker";
import { LanguageExchangeProgramTracker } from "@/components/culture/LanguageExchangeProgramTracker";
import type { LanguageExchangeProgramProgress } from "@/components/culture/LanguageExchangeProgramTracker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LANGUAGE_PROFICIENCY_LABELS,
  LANGUAGE_PROFICIENCY_LEVELS,
  type LanguageProficiencyLevel,
  type LanguageProficiencyRecord,
} from "@/types/education";

const languageCourse: LanguageCourseProgress = {
  id: "course-japanese-01",
  language: "Japanese",
  provider: "Kyoto Arts Conservatory",
  format: "hybrid",
  startDate: "2025-01-15",
  endDate: "2025-04-28",
  level: "intermediate",
  xpEarned: 1820,
  xpTarget: 2400,
  dailyPracticeMinutes: 45,
  immersionHours: 62,
  studyStreakDays: 18,
  currentFocus: "Expressive phrasing for songwriting and stage banter with emphasis on Kansai dialect idioms.",
  modules: [
    {
      id: "module-1",
      title: "Songwriting Grammar Workshop",
      focus: "Lyric-focused grammar drills and creative writing prompts",
      completed: true,
    },
    {
      id: "module-2",
      title: "Conversation Lab",
      focus: "Role-play dialogues for tour press and fan meetups",
      completed: true,
    },
    {
      id: "module-3",
      title: "Kansai Dialect Immersion",
      focus: "Regional expressions for live performance crowd work",
      completed: false,
    },
    {
      id: "module-4",
      title: "Stagecraft Pronunciation",
      focus: "Projection techniques for amphitheaters and stadiums",
      completed: false,
    },
  ],
};

const exchangeProgram: LanguageExchangeProgramProgress = {
  id: "exchange-barcelona-2025",
  language: "Spanish",
  hostCity: "Barcelona, Spain",
  hostInstitution: "Institut de Cultura Musical",
  mentorName: "Lucía Fernández",
  cohortName: "Spring Resonance",
  immersionHours: 88,
  culturalActivitiesCompleted: 9,
  culturalActivitiesPlanned: 14,
  weeksCompleted: 6,
  totalWeeks: 10,
  proficiencyStartLevel: "elementary",
  proficiencyCurrentLevel: "upper_intermediate",
  proficiencyScoreDelta: 27,
  upcomingHighlight: "Collaborative songwriting session with Catalan indie artists at Casa de la Música.",
  milestones: [
    {
      id: "milestone-1",
      title: "Host Family Immersion Week",
      status: "completed",
      description: "Integrated with local host family, daily Catalan breakfast conversations.",
    },
    {
      id: "milestone-2",
      title: "Campus Jam Residency",
      status: "in_progress",
      description: "Leading jam nights to practice spontaneous stage banter in Spanish.",
    },
    {
      id: "milestone-3",
      title: "Festival Liaison Shadowing",
      status: "upcoming",
      description: "Assist festival liaison team with bilingual artist relations duties.",
    },
  ],
};

const proficiencySnapshot: LanguageProficiencyRecord[] = [
  {
    language: "Japanese",
    proficiencyLevel: "intermediate",
    proficiencyScore: 68,
    immersionHours: 62,
    certifications: ["JLPT N4"],
    studyStreakDays: 18,
    lastAssessedAt: "2025-03-01",
  },
  {
    language: "Spanish",
    proficiencyLevel: "upper_intermediate",
    proficiencyScore: 74,
    immersionHours: 88,
    certifications: ["DELE B1"],
    studyStreakDays: 24,
    lastAssessedAt: "2025-03-06",
  },
  {
    language: "French",
    proficiencyLevel: "elementary",
    proficiencyScore: 42,
    immersionHours: 28,
    certifications: [],
    studyStreakDays: 9,
    lastAssessedAt: "2025-02-18",
  },
];

const nextLevelFor = (level: LanguageProficiencyLevel) => {
  const index = LANGUAGE_PROFICIENCY_LEVELS.indexOf(level);
  if (index < 0 || index === LANGUAGE_PROFICIENCY_LEVELS.length - 1) {
    return null;
  }
  return LANGUAGE_PROFICIENCY_LEVELS[index + 1];
};

const formatAssessmentDate = (record: LanguageProficiencyRecord) => {
  if (!record.lastAssessedAt) return "Awaiting assessment";
  const date = new Date(record.lastAssessedAt);
  return Number.isNaN(date.getTime()) ? "Awaiting assessment" : date.toLocaleDateString();
};

export default function CultureLearningPage() {
  const averageImmersionHours = useMemo(() => {
    if (!proficiencySnapshot.length) return 0;
    const total = proficiencySnapshot.reduce((sum, record) => sum + record.immersionHours, 0);
    return Math.round(total / proficiencySnapshot.length);
  }, []);

  const highestLevel = useMemo(() => {
    return proficiencySnapshot.reduce<LanguageProficiencyRecord | null>((highest, record) => {
      if (!highest) return record;
      const highestIndex = LANGUAGE_PROFICIENCY_LEVELS.indexOf(highest.proficiencyLevel);
      const currentIndex = LANGUAGE_PROFICIENCY_LEVELS.indexOf(record.proficiencyLevel);
      return currentIndex > highestIndex ? record : highest;
    }, null);
  }, []);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <Badge className="text-sm uppercase tracking-wide">Culture &amp; Language Learning</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Language Courses &amp; Exchange Programs</h1>
          <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
            Track real-time progress across structured language courses and cultural exchange residencies.
            Blend classroom mastery with immersive experiences to elevate multilingual artistry on global stages.
          </p>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <LanguageCourseProgressTracker course={languageCourse} />
        <Card className="border-primary/30 bg-background/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Globe2 className="h-6 w-6 text-primary" />
              Fluency Snapshot
            </CardTitle>
            <CardDescription className="text-base">
              Consolidated language proficiency metrics across all active study paths.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Compass className="h-4 w-4" />
                  Average immersion per language
                </span>
                <span className="text-lg font-semibold text-foreground">{averageImmersionHours} hrs</span>
              </div>
              {highestLevel && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Highest fluency: {highestLevel.language} ({LANGUAGE_PROFICIENCY_LABELS[highestLevel.proficiencyLevel]})
                </p>
              )}
            </div>

            <div className="space-y-3">
              {proficiencySnapshot.map((record) => {
                const nextLevel = nextLevelFor(record.proficiencyLevel);
                const progressToNext = nextLevel ? Math.min(100, record.proficiencyScore) : 100;

                return (
                  <div key={record.language} className="rounded-lg border bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{record.language}</h3>
                          <Badge variant="outline">{LANGUAGE_PROFICIENCY_LABELS[record.proficiencyLevel]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Assessed {formatAssessmentDate(record)}</p>
                      </div>
                      {record.certifications?.length ? (
                        <Badge variant="secondary" className="text-xs">
                          {record.certifications.join(", ")}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      <Progress value={progressToNext} className="h-2" />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {record.proficiencyScore}% toward {nextLevel ? LANGUAGE_PROFICIENCY_LABELS[nextLevel] : "mastery"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5 text-orange-500" /> {record.studyStreakDays ?? 0} day streak
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {record.immersionHours} hrs immersed · {record.certifications?.length ? "Certified" : "Certification pending"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <LanguageExchangeProgramTracker program={exchangeProgram} />
        <Card className="border-primary/30 bg-background/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Award className="h-6 w-6 text-primary" />
              Cultural Impact Goals
            </CardTitle>
            <CardDescription className="text-base">
              Benchmarks for language-led collaborations and global release readiness.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="text-base font-semibold text-foreground">Multilingual release pipeline</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Prepare dual-language EP launch with localized marketing and fan engagement plans in Japan and Spain.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="text-base font-semibold text-foreground">Exchange amplification</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Host livestream recaps from residency cities featuring collaborative performances with local artists.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="text-base font-semibold text-foreground">Certification roadmap</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Target JLPT N3 and DELE B2 within 9 months to unlock festival bookings requiring bilingual hosts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
