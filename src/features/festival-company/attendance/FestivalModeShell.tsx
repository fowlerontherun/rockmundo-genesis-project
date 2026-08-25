import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BugReportButton } from "@/components/bug-report/BugReportButton";
import { useLeaveFestivalEarly } from "./useFestivalAttendance";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import { FestivalModeActivityHub } from "./FestivalModeActivityHub";
import { FestivalModeMoments } from "./FestivalModeMoments";
import { FestivalModeMyDay } from "./FestivalModeMyDay";
import { FestivalModeRewards } from "./FestivalModeRewards";
import { FestivalModeStageSchedule } from "./FestivalModeStageSchedule";
import { isFestivalModeSupportPath } from "./festivalModeRouting";

export type FestivalModeSection = "home" | "my-day" | "stages" | "food-drink" | "activities" | "moments" | "rewards";

const festivalSections: Array<{ id: FestivalModeSection; label: string; mobileLabel: string }> = [
  { id: "home", label: "Festival Home", mobileLabel: "Home" },
  { id: "my-day", label: "My Day", mobileLabel: "My Day" },
  { id: "stages", label: "Stages", mobileLabel: "Stages" },
  { id: "food-drink", label: "Food & Drink", mobileLabel: "Food" },
  { id: "activities", label: "Activities", mobileLabel: "Do" },
  { id: "moments", label: "Moments", mobileLabel: "Moments" },
  { id: "rewards", label: "Rewards & memories", mobileLabel: "Rewards" },
];

const futureSections = ["Festival Map"];

const supportLinks = [
  { to: "/inbox", label: "Inbox" },
  { to: "/settings/safety/reports", label: "Safety & reports" },
  { to: "/settings/privacy/blocked-players", label: "Blocked players" },
] as const;

const FestivalHeader = ({ attendance, leavePending, onLeave }: { attendance: FestivalPlayerAttendance; leavePending: boolean; onLeave: () => void }) => (
  <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 md:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-fuchsia-700">Festival Mode</Badge>
          <span className="truncate font-semibold">{attendance.festivalName}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          Wristband active · {attendance.ticketType.replaceAll("_", " ")}{attendance.includesCamping ? " · Camping" : ""}{attendance.includesVipArea ? " · VIP" : ""}
        </p>
      </div>
      <Button variant="outline" size="sm" disabled={leavePending} onClick={onLeave}>{leavePending ? "Leaving…" : "Leave festival"}</Button>
    </div>
  </header>
);

const SupportLinks = ({ pathname, compact = false }: { pathname: string; compact?: boolean }) => (
  <div className={compact ? "flex flex-wrap gap-2" : "space-y-1"} aria-label="Account and support">
    {supportLinks.map((item) => {
      const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
      return (
        <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={[
          compact ? "rounded-full border px-3 py-1.5 text-xs font-medium" : "block rounded-lg px-3 py-2 text-sm transition",
          active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        ].join(" ")}>{item.label}</Link>
      );
    })}
  </div>
);

export const FestivalModeShell = ({ attendance, children, supportContent, isMobile }: { attendance: FestivalPlayerAttendance; children: ReactNode; supportContent?: ReactNode; isMobile: boolean }) => {
  const leaveEarly = useLeaveFestivalEarly();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<FestivalModeSection>("home");
  const supportRoute = isFestivalModeSupportPath(location.pathname);

  const confirmLeave = () => {
    const confirmed = window.confirm("Leave this festival early? Your Festival Mode session will end immediately and future festival activities will no longer be available.");
    if (confirmed) leaveEarly.mutate({ attendanceId: attendance.id });
  };

  const selectFestivalSection = (section: FestivalModeSection) => {
    setActiveSection(section);
    if (supportRoute) navigate("/", { replace: false });
  };

  const festivalContent = (() => {
    switch (activeSection) {
      case "my-day": return <FestivalModeMyDay attendance={attendance} />;
      case "stages": return <FestivalModeStageSchedule attendance={attendance} />;
      case "food-drink": return <FestivalModeActivityHub attendance={attendance} kind="food-drink" />;
      case "activities": return <FestivalModeActivityHub attendance={attendance} kind="activities" />;
      case "moments": return <FestivalModeMoments attendance={attendance} />;
      case "rewards": return <FestivalModeRewards attendance={attendance} />;
      default: return children;
    }
  })();
  const content = supportRoute && supportContent ? supportContent : festivalContent;

  if (isMobile) {
    return (
      <div data-festival-mode="true" data-festival-mode-device="mobile" className="rm-mobile min-h-[100dvh] bg-background text-foreground">
        <FestivalHeader attendance={attendance} leavePending={leaveEarly.isPending} onLeave={confirmLeave} />
        <main id="festival-main-content" className="mx-auto max-w-3xl space-y-3 px-3 pb-32 pt-3">
          <div className="rounded-xl border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account & support</p>
            <SupportLinks pathname={location.pathname} compact />
          </div>
          {leaveEarly.isError && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{leaveEarly.error.message.replaceAll("_", " ")}</p>}
          {content}
        </main>
        <nav aria-label="Festival navigation" className="fixed inset-x-0 bottom-0 z-50 overflow-x-auto border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          <div className="mx-auto flex min-w-max max-w-3xl gap-1">
            {festivalSections.map((section) => {
              const isCurrent = !supportRoute && section.id === activeSection;
              return <button key={section.id} type="button" aria-current={isCurrent ? "page" : undefined} onClick={() => selectFestivalSection(section.id)} className={["min-w-[62px] rounded-lg px-2 py-2 text-center text-[11px] font-medium transition", isCurrent ? "bg-primary text-primary-foreground" : "hover:bg-muted"].join(" ")}>{section.mobileLabel}</button>;
            })}
            <Link to="/inbox" aria-current={location.pathname === "/inbox" ? "page" : undefined} className={["min-w-[62px] rounded-lg px-2 py-2 text-center text-[11px] font-medium transition", location.pathname === "/inbox" ? "bg-primary text-primary-foreground" : "hover:bg-muted"].join(" ")}>Inbox</Link>
          </div>
        </nav>
        <BugReportButton />
      </div>
    );
  }

  return (
    <div data-festival-mode="true" data-festival-mode-device="desktop" className="min-h-[100dvh] bg-background text-foreground">
      <FestivalHeader attendance={attendance} leavePending={leaveEarly.isPending} onLeave={confirmLeave} />
      <div className="mx-auto grid max-w-7xl gap-4 p-5 md:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Festival navigation" className="self-start rounded-xl border bg-card p-2">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Festival</p>
          <div className="space-y-1">
            {festivalSections.map((section) => {
              const isCurrent = !supportRoute && section.id === activeSection;
              return <button key={section.id} type="button" aria-current={isCurrent ? "page" : undefined} onClick={() => selectFestivalSection(section.id)} className={["block w-full rounded-lg px-3 py-2 text-left text-sm transition", isCurrent ? "bg-primary text-primary-foreground" : "hover:bg-muted"].join(" ")}>{section.label}</button>;
            })}
          </div>
          <div className="my-3 border-t" />
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account & support</p>
          <SupportLinks pathname={location.pathname} />
          <div className="my-3 border-t" />
          <p className="px-3 pb-1 text-xs text-muted-foreground">Coming in later attendee phases</p>
          <div className="px-3 text-xs text-muted-foreground opacity-70">{futureSections.join(" · ")}</div>
          <p className="mt-3 px-3 text-xs text-muted-foreground">While checked in, normal RockMundo gameplay navigation is intentionally unavailable.</p>
        </nav>
        <main id="festival-main-content" className="min-w-0">
          {leaveEarly.isError && <p role="alert" className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{leaveEarly.error.message.replaceAll("_", " ")}</p>}
          {content}
        </main>
      </div>
      <BugReportButton />
    </div>
  );
};

export default FestivalModeShell;
