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
      <header className="space-y-6 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Education Hub
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Build your creative intelligence
          </h1>
          <p className="mx-auto max-w-3xl text-sm text-muted-foreground md:text-base">
            Dive into curated resources, mentor networks, and collaborative learning experiences that keep your artistry growing with every session.
          </p>
        </div>
        <p className="mx-auto max-w-2xl text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:text-left">
          Choose a learning lane below to kickstart your next breakthrough.
        </p>
      </header>

      <Tabs defaultValue={defaultValue} className="mt-10 space-y-8">
        <TabsList className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-start gap-3 rounded-xl border bg-background/60 px-4 py-3 text-left shadow-sm transition hover:bg-background/80 data-[state=active]:border-primary data-[state=active]:bg-primary/10"
              >
                <Icon className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <span className="text-xs text-muted-foreground">{tab.description}</span>
                </span>
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
