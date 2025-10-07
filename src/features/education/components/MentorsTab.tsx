import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useEducationMentorPrograms } from "../hooks/useEducationMentorPrograms";

export const MentorsTab = () => {
  const programs = useEducationMentorPrograms();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Guided Mentorship</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Partner with mentors who accelerate your growth with actionable feedback and steady accountability.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <Card key={program.title} className="border-dashed">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">{program.title}</CardTitle>
              <CardDescription>{program.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {program.cohorts.map((cohort) => (
                  <div key={cohort.name} className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{cohort.name}</p>
                        <p className="text-xs text-muted-foreground">{cohort.focus}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {cohort.cadence}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{cohort.support}</p>
                  </div>
                ))}
              </div>
              {program.action ? (
                <Button asChild variant="secondary" className="w-full">
                  <a href={program.action.href} target="_blank" rel="noreferrer">
                    {program.action.label}
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
