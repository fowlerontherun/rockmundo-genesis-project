import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BandLearningTab } from "@/features/education/components/BandLearningTab";
import { BooksTab } from "@/features/education/components/BooksTab";
import { MentorsTab } from "@/features/education/components/MentorsTab";
import { UniversityTab } from "@/features/education/components/UniversityTab";
import { VideosTab } from "@/features/education/components/VideosTab";
import { useEducationTabs } from "@/features/education/hooks/useEducationTabs";

const Education = () => {
  const tabs = useEducationTabs();

  return (
    <div className="space-y-10 pb-16">
      <header className="space-y-3 text-center">
        <Badge variant="outline" className="mx-auto w-fit px-4 py-1 text-sm font-semibold">
          Education Hub
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Level Up Your Musical Journey</h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
          Tap into curated learning paths—from foundational study to collaborative band growth—to keep your skills
          sharp and your career momentum steady.
        </p>
      </header>

      <Tabs defaultValue="books" className="space-y-8">
        <TabsList className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col gap-1 py-3">
                <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </span>
                <span className="hidden text-xs font-normal text-muted-foreground lg:block">{tab.description}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="books" className="space-y-6">
          <BooksTab />
        </TabsContent>

        <TabsContent value="university" className="space-y-6">
          <UniversityTab />
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <VideosTab />
        </TabsContent>

        <TabsContent value="mentors" className="space-y-6">
          <MentorsTab />
        </TabsContent>

        <TabsContent value="band" className="space-y-6">
          <BandLearningTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Education;
