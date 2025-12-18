import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import { BooksTab } from "@/features/education/components/BooksTab";
import { UniversityTab } from "@/features/education/components/UniversityTab";
import { VideosTab } from "@/features/education/components/VideosTab";
import { MentorsTab } from "@/features/education/components/MentorsTab";
import { useEducationTabs } from "@/features/education/hooks/useEducationTabs";

const Education = () => {
  const tabs = useEducationTabs();
  const defaultValue = tabs[0]?.value ?? "books";

  const tabContentMap: Record<string, JSX.Element> = {
    books: <BooksTab />,
    university: <UniversityTab />,
    videos: <VideosTab />,
    mentors: <MentorsTab />,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10 sm:px-6 lg:px-8">
      <header className="space-y-3 sm:space-y-4 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Education Hub
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          Build your creative intelligence
        </h1>
        <p className="max-w-3xl text-sm sm:text-base text-muted-foreground">
          Dive into curated resources, mentor networks, and collaborative learning experiences that keep your artistry growing with every session.
        </p>
      </header>

      <Tabs defaultValue={defaultValue} className="mt-6 sm:mt-8 space-y-6">
        {/* Mobile: Scrollable tabs */}
        <div className="lg:hidden">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto w-max gap-1 bg-transparent p-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Desktop: Grid tabs */}
        <div className="hidden lg:block">
          <TabsList className="grid w-full grid-cols-4 gap-2 bg-muted/50 p-1">
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
        </div>

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
