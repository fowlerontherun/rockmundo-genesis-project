import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTranslation } from "@/hooks/useTranslation";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";

import { SummaryTab } from "@/features/education/components/SummaryTab";
import { BooksTab } from "@/features/education/components/BooksTab";
import { UniversityTab } from "@/features/education/components/UniversityTab";
import { VideosTab } from "@/features/education/components/VideosTab";
import { MentorsTab } from "@/features/education/components/MentorsTab";
import { useEducationTabs } from "@/features/education/hooks/useEducationTabs";

const Education = () => {
  const { t } = useTranslation();
  const tabs = useEducationTabs();
  const defaultValue = tabs[0]?.value ?? "summary";

  const tabContentMap: Record<string, JSX.Element> = {
    summary: <SummaryTab />,
    books: <BooksTab />,
    university: <UniversityTab />,
    videos: <VideosTab />,
    mentors: <MentorsTab />,
  };

  return (
    <PageLayout>
      <PageHeader
        title={t('education.title', 'Build your creative intelligence')}
        subtitle={t('education.subtitle', 'Dive into curated resources, mentor networks, and collaborative learning experiences that keep your artistry growing with every session.')}
      />

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
          <TabsList className="grid w-full grid-cols-5 gap-2 bg-muted/50 p-1">
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
    </PageLayout>
  );
};

export default Education;
