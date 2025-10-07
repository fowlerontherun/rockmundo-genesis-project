import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BooksTab } from "@/features/education/components/BooksTab";
import { UniversityTab } from "@/features/education/components/UniversityTab";
import { VideosTab } from "@/features/education/components/VideosTab";
import { MentorsTab } from "@/features/education/components/MentorsTab";
import { BandLearningTab } from "@/features/education/components/BandLearningTab";
import { useEducationTabs } from "@/features/education/hooks/useEducationTabs";

const Education = () => {
  const tabs = useEducationTabs();
  const defaultValue = tabs[0]?.value ?? "books";

  const tabContentMap: Record<string, JSX.Element> = {
    books: <BooksTab />,
    university: <UniversityTab />,
    videos: <VideosTab />,
    mentors: <MentorsTab />,
    band: <BandLearningTab />,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Education Hub
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Build your creative intelligence
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Dive into curated resources, mentor networks, and collaborative learning experiences that keep your artistry growing with every session.
        </p>
      </header>

      <Tabs defaultValue={defaultValue} className="mt-8 space-y-6">
        <TabsList className="grid w-full gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center justify-center gap-2 py-2.5"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-medium">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-6 focus-visible:outline-none">
            <div className="space-y-6">{tabContentMap[tab.value] ?? null}</div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Education;
