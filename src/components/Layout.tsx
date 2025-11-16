import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import CharacterGate from "@/components/CharacterGate";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { VersionHeader } from "@/components/VersionHeader";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ActivityStatusIndicator } from "@/components/ActivityStatusIndicator";

const BUILD_VERSION = "v1.0.0";
const BUILD_DATE = "2025-01-16";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, error: profileError } = useGameData();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const isOnProfile = location.pathname === "/my-character";

    if (!authLoading && !dataLoading && user && !profile && !isOnProfile) {
      navigate("/my-character");
    }
  }, [authLoading, dataLoading, user, profile, location.pathname, navigate]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center">
          <div className="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <VersionHeader />
          <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <ActivityStatusIndicator />
              <ThemeSwitcher />
              <LanguageSwitcher />
              <HowToPlayDialog />
            </div>
          </header>
          
          <main className="flex-1 p-3 md:p-4">
            {profileError && (
              <Alert variant="destructive" className="mb-4 max-w-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Profile error</AlertTitle>
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}
            <CharacterGate>
              <Outlet />
            </CharacterGate>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
