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

  // Global auto-start for gigs - runs regardless of which page user is on
  useAutoGigStart();

  // Global auto-complete for rehearsals - get pending report for UI display
  const { pendingReport, clearPendingReport } = useAutoRehearsalCompletion(user?.id || null);

  // Global gig execution - processes active gigs
  useGlobalGigExecution(user?.id || null);

  // Track total hours played
  usePlaytimeTracker(profileId || null);

  // Global auto-complete for release manufacturing
  useAutoManufacturingCompletion(user?.id || null);

  // Global auto-complete for recording sessions so finished studio bookings become recorded songs
  useAutoRecordingCompletion(user?.id || null, profileId || null);

  // Auto-complete major events when game date passes event date
  useAutoMajorEventCompletion(user?.id || null);

  // Auto-rejoin nearest tour leg if the player missed a pickup
  useAutoRejoinTour();

  // Global game event notifications (gig results, offers, completions, etc.)
  useGameEventNotifications();

  // Reminders for gigs in the next 24h
  useGigDayReminders();

  // Reminders when close to unlocking the next reach tier (local/regional/national)
  useReachMilestoneReminders();

  // Global game calendar for seasonal effects
  const { data: calendar } = useGameCalendar();
  void profile;
  void calendar;

  // Dev-only guest bypass: in `vite dev` we skip the /auth redirect and the
  // unauthenticated null-render so pages can be inspected without logging in.
  // Production builds keep the original behavior.
  const devGuestBypass = import.meta.env.DEV;
  const gigViewerDemoTestAccess = hasGigViewerDemoTestAccess(location);

  useEffect(() => {
    if (!authLoading && !user && !devGuestBypass && !gigViewerDemoTestAccess) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate, devGuestBypass, gigViewerDemoTestAccess]);

  // Capture the route that Festival Mode interrupted once per authoritative
  // attending session. Support routes never replace that return target. When
  // the server moves the attendee to left/completed/cancelled/refunded, restore
  // the captured route and clear the session marker.
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

    if (!wasFestivalModeRef.current) return;

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

  // Festival Mode is driven solely by authoritative attendee state. It sits
  // above both desktop and mobile shells so navigation/back/refresh cannot
  // escape the reduced experience while the active character is attending.
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

  // If a refresh/reconnect cannot yet re-confirm attendance but this tab was
  // already in Festival Mode, fail closed instead of exposing normal gameplay.
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

  if (isMobile) {
    const path = location.pathname;
    const routeMeta = getMobileRouteMeta(path);
    const bridgeTarget = getMobileBridgeTarget(path);

    // Forward mobile users from desktop paths to the dedicated mobile screen.
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
    <ConditionalDesktopGate bypass={isMobile}>
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
