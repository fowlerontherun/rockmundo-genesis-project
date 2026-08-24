import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeaveFestivalEarly } from "./useFestivalAttendance";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import { FestivalModeActivityHub } from "./FestivalModeActivityHub";
import { FestivalModeMyDay } from "./FestivalModeMyDay";

export type FestivalModeSection = "home" | "my-day" | "food-drink" | "activities";

const festivalSections = [
  { id: "home", label: "Festival Home", enabled: true },
  { id: "my-day", label: "My Day", enabled: true },
  { id: "stages", label: "Stages", enabled: false },
  { id: "food-drink", label: "Food & Drink", enabled: true },
  { id: "activities", label: "Activities", enabled: true },
  { id: "social", label: "Social", enabled: false },
  { id: "campsite", label: "Campsite", enabled: false },
  { id: "map", label: "Festival Map", enabled: false },
  { id: "character", label: "My Character", enabled: false },
] as const;

export const FestivalModeShell = ({
  attendance,
  children,
}: {
  attendance: FestivalPlayerAttendance;
  children: ReactNode;
}) => {
  const leaveEarly = useLeaveFestivalEarly();
  const [activeSection, setActiveSection] = useState<FestivalModeSection>("home");

  const confirmLeave = () => {
    const confirmed = window.confirm(
      "Leave this festival early? Your Festival Mode session will end immediately and future festival activities will no longer be available.",
    );
    if (confirmed) leaveEarly.mutate({ attendanceId: attendance.id });
  };

  const content = (() => {
    switch (activeSection) {
      case "my-day":
        return <FestivalModeMyDay attendance={attendance} />;
      case "food-drink":
        return <FestivalModeActivityHub attendance={attendance} kind="food-drink" />;
      case "activities":
        return <FestivalModeActivityHub attendance={attendance} kind="activities" />;
      default:
        return children;
    }
  })();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-fuchsia-700">Festival Mode</Badge>
              <span className="font-semibold">{attendance.festivalName}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Wristband active · {attendance.ticketType.replaceAll("_", " ")}
              {attendance.includesCamping ? " · Camping" : ""}
              {attendance.includesVipArea ? " · VIP" : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={leaveEarly.isPending}
            onClick={confirmLeave}
          >
            {leaveEarly.isPending ? "Leaving…" : "Leave festival"}
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-3 md:grid-cols-[220px_minmax(0,1fr)] md:p-5">
        <nav aria-label="Festival navigation" className="rounded-xl border bg-card p-2">
          <div className="grid grid-cols-3 gap-1 md:grid-cols-1">
            {festivalSections.map((section) => {
              const isCurrent = section.enabled && section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  disabled={!section.enabled}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => {
                    if (section.enabled && ["home", "my-day", "food-drink", "activities"].includes(section.id)) {
                      setActiveSection(section.id as FestivalModeSection);
                    }
                  }}
                  className={[
                    "rounded-lg px-3 py-2 text-left text-sm transition",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : section.enabled
                        ? "hover:bg-muted"
                        : "cursor-not-allowed text-muted-foreground opacity-60",
                  ].join(" ")}
                  title={section.enabled ? undefined : "This Festival area is added in a later implementation phase"}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 hidden px-2 text-xs text-muted-foreground md:block">
            While checked in, RockMundo is intentionally reduced to Festival gameplay.
          </p>
        </nav>

        <main id="festival-main-content" className="min-w-0">
          {leaveEarly.isError && (
            <p role="alert" className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {leaveEarly.error.message.replaceAll("_", " ")}
            </p>
          )}
          {content}
        </main>
      </div>
    </div>
  );
};

export default FestivalModeShell;
