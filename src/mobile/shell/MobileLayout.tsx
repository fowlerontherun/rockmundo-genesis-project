import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import CharacterGate from "@/components/CharacterGate";
import NoActiveCharacterGate from "@/components/character/NoActiveCharacterGate";
import { MobileShell } from "./MobileShell";

/**
 * Mobile-only layout. Skips DesktopOnlyGate so small viewports can render.
 * Reuses the same auth and active-character gates as the desktop gameplay shell.
 */
export default function MobileLayout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: dataLoading } = useGameData();
  const devGuestBypass = import.meta.env.DEV;

  useEffect(() => {
    if (!authLoading && !user && !devGuestBypass) navigate("/auth");
  }, [authLoading, user, navigate, devGuestBypass]);

  if (authLoading || (dataLoading && user)) {
    return (
      <div className="rm-mobile flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user && !devGuestBypass) return null;

  return (
    <MobileShell>
      <NoActiveCharacterGate>
        <CharacterGate>
          <Outlet />
        </CharacterGate>
      </NoActiveCharacterGate>
    </MobileShell>
  );
}