import { useEffect, useRef } from "react";
import { Outlet, useNavigate, Navigate, useLocation } from "react-router-dom";
import CharacterGate from "@/components/CharacterGate";
import NoActiveCharacterGate from "@/components/character/NoActiveCharacterGate";
import { useIsMobileDevice } from "@/hooks/useIsMobileDevice";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAutoGigStart } from "@/hooks/useAutoGigStart";
import { useAutoRehearsalCompletion } from "@/hooks/useAutoRehearsalCompletion";
import { useGlobalGigExecution } from "@/hooks/useGlobalGigExecution";
import { usePlaytimeTracker } from "@/hooks/usePlaytimeTracker";
import { useAutoManufacturingCompletion } from "@/hooks/useAutoManufacturingCompletion";
import { useAutoMajorEventCompletion } from "@/hooks/useAutoMajorEventCompletion";
import { useAutoRejoinTour } from "@/hooks/useAutoRejoinTour";
import { TutorialTooltip } from "@/components/tutorial/TutorialTooltip";
import { useGameEventNotifications } from "@/hooks/useGameEventNotifications";
import { EventNotificationModal } from "@/components/events/EventNotificationModal";
import { RehearsalCompletionReport } from "@/components/rehearsal/RehearsalCompletionReport";
import { useGigDayReminders } from "@/hooks/useGigDayReminders";
import { useReachMilestoneReminders } from "@/hooks/useReachMilestoneReminders";
import { InterviewModal } from "@/components/pr/InterviewModal";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { FMShell } from "@/components/fm/FMShell";
import { MobileShell } from "@/mobile/shell/MobileShell";
import MobileHome from "@/mobile/pages/MobileHome";
import MobileCareer from "@/mobile/pages/MobileCareer";
import MobileSocial from "@/mobile/pages/MobileSocial";
import MobileWorld from "@/mobile/pages/MobileWorld";
import MobileMe from "@/mobile/pages/MobileMe";
import { getMobileRouteMeta } from "@/mobile/routeRegistry";
import { getMobileBridgeTarget } from "@/mobile/routeBridge";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { useAutoRecordingCompletion } from "@/hooks/useAutoRecordingCompletion";
import { hasGigViewerDemoTestAccess } from "@/lib/gigViewerDemoTestAccess";
import { useMyFestivalAttendance } from "@/features/festival-company/attendance/useFestivalAttendance";
import { FestivalModeShell } from "@/features/festival-company/attendance/FestivalModeShell";
import { FestivalModeHome } from "@/features/festival-company/attendance/FestivalModeHome";
import {
  clearFestivalModeReturnPath,
  isFestivalModeSupportPath,
  readFestivalModeReturnPath,
  rememberFestivalModeReturnPath,
} from "@/features/festival-company/attendance/festivalModeRouting";

const Layout = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, error: profileError } = useGameData();
  const { profileId } = useActiveProfile();
  const isMobile = useIsMobileDevice();
  const location = useLocation();
  const {
    data: festivalAttendance = [],
    isLoading: festivalAttendanceLoading,
    isError: festivalAttendanceError,
  } = useMyFestivalAttendance(Boolean(user && profileId));
  const activeFestivalAttendance = festivalAttendance.find((attendance) => attendance.status === "attending");
  const festivalSupportRoute = isFestivalModeSupportPath(location.pathname);
  const wasFestivalModeRef = useRef(false);

  useAutoGigStart();
  const { pendingReport, clearPendingReport } = useAutoRehearsalCompletion(user?.id || null);
  useGlobalGigExecution(user?.id || null);
  usePlaytimeTracker(profileId || null);
  useAutoManufacturingCompletion(user?.id || null);
  useAutoRecordingCompletion(user?.id || null, profileId || null);
  useAutoMajorEventCompletion(user?.id || null);
  useAutoRejoinTour();
  useGameEventNotifications();
  useGigDayReminders();
  useReachMilestoneReminders();
  const { data: calendar } = useGameCalendar();
  void profile;
  void calendar;

  const devGuestBypass = import.meta.env.DEV;
  const gigViewerDemoTestAccess = hasGigViewerDemoTestAccess(location);

  useEffect(() => {
    if (!authLoading && !user && !devGuestBypass && !gigViewerDemoTestAccess) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate, devGuestBypass, gigViewerDemoTestAccess]);

  useEffect(() => {
    if (!profileId || festivalAttendanceLoading || festivalAttendanceError) return;

    if (activeFestivalAttendance) {
      if (!wasFestivalModeRef.current) {
        rememberFestivalModeReturnPath(window.sessionStorage, profileId, {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        });
        wasFestivalModeRef.current = true;
      }
      return;
    }

    if (!wasFestivalModeRef.current) {
      clearFestivalModeReturnPath(window.sessionStorage, profileId);
      return;
    }

    const returnPath = readFestivalModeReturnPath(window.sessionStorage, profileId) ?? "/home";
    wasFestivalModeRef.current = false;
    clearFestivalModeReturnPath(window.sessionStorage, profileId);

    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    if (currentPath !== returnPath) navigate(returnPath, { replace: true });
  }, [
    activeFestivalAttendance,
    festivalAttendanceError,
    festivalAttendanceLoading,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    profileId,
  ]);

  if (
    authLoading ||
    (dataLoading && user) ||
    (Boolean(user && profileId) && festivalAttendanceLoading)
  ) {
    return (
      <div className={isMobile ? "rm-mobile flex min-h-[100dvh] items-center justify-center bg-background" : "flex h-screen items-center justify-center bg-gradient-stage"} role="status" aria-live="polite" aria-busy="true">
        <div className="text-center">
          <div className={isMobile ? "mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" : "mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-primary"} aria-hidden="true"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (!user && !devGuestBypass && !gigViewerDemoTestAccess) {
    return null;
  }

  if (activeFestivalAttendance) {
    return (
      <FestivalModeShell
        attendance={activeFestivalAttendance}
        isMobile={isMobile}
        supportContent={festivalSupportRoute ? <Outlet /> : undefined}
      >
        <FestivalModeHome attendance={activeFestivalAttendance} />
      </FestivalModeShell>
    );
  }

  if (
    festivalAttendanceError &&
    profileId &&
    readFestivalModeReturnPath(window.sessionStorage, profileId)
  ) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6" role="status" aria-live="polite">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Festival Mode</p>
          <h1 className="mt-2 text-xl font-bold">Reconnecting to the festival…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not confirm your attendee state yet. Normal gameplay stays locked until RockMundo reconnects to the authoritative festival session.
          </p>
        </div>
      </div>
    );
  }

  // The gig-viewer test fixture deliberately renders the desktop viewer at
  // narrow viewport widths to certify its own responsive controls. Keep that
  // one build-time-gated route out of the product mobile shell so the test is
  // measuring the viewer, not mobile route bridging.
  if (isMobile && !gigViewerDemoTestAccess) {
    const path = location.pathname;
    const routeMeta = getMobileRouteMeta(path);
    const bridgeTarget = getMobileBridgeTarget(path);

    if (bridgeTarget && bridgeTarget !== path) {
      return <Navigate to={`${bridgeTarget}${location.search}`} replace />;
    }

    if (import.meta.env.DEV && routeMeta?.fallbackStatus === "wrapped-desktop") {
      console.warn(`[RockMundo mobile] Contained desktop fallback rendered in MobileShell: ${path}`);
    }

    const dedicatedEntry = (() => {
      if (path === "/" || path === "/home" || path === "/index") return <MobileHome />;
      if (path === "/career" || path === "/career/overview") return <MobileCareer />;
      if (path === "/social" || path === "/social/overview") return <MobileSocial />;
      if (path === "/world" || path === "/world/overview") return <MobileWorld />;
      if (path === "/me" || path === "/character" || path === "/character/overview") return <MobileMe />;
      return null;
    })();

    return (
      <MobileShell>
        <NoActiveCharacterGate>
          <CharacterGate>
            {dedicatedEntry ?? <Outlet />}
          </CharacterGate>
        </NoActiveCharacterGate>
      </MobileShell>
    );
  }

  return (
    <ConditionalDesktopGate bypass={isMobile || gigViewerDemoTestAccess}>
      <FMShell>
        {profileError && (
          <Alert variant="destructive" className="mb-4 max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Profile error</AlertTitle>
            <AlertDescription>{profileError}</AlertDescription>
          </Alert>
        )}
        <MaintenanceBanner />
        <NoActiveCharacterGate>
          <CharacterGate>
            <Breadcrumbs />
            <Outlet />
          </CharacterGate>
        </NoActiveCharacterGate>
        <TutorialTooltip />
        <EventNotificationModal />
        <InterviewModal />
        {pendingReport && (
          <RehearsalCompletionReport
            open={!!pendingReport}
            onClose={clearPendingReport}
            results={pendingReport.results}
            chemistryGain={pendingReport.chemistryGain}
            xpGained={pendingReport.xpGained}
            durationHours={pendingReport.durationHours}
          />
        )}
      </FMShell>
    </ConditionalDesktopGate>
  );
};

const ConditionalDesktopGate = ({ bypass, children }: { bypass: boolean; children: React.ReactNode }) =>
  bypass ? <>{children}</> : <DesktopOnlyGate>{children}</DesktopOnlyGate>;

export default Layout;
