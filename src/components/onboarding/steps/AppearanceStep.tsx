import { lazy, Suspense } from "react";
const PlayerModelEditor = lazy(() => import("@/features/player-model/PlayerModelEditor"));

export const AppearanceStep = () => <div className="space-y-6">
  <div className="text-center">
    <h2 className="text-xl font-bold text-foreground">Create Your Look</h2>
    <p className="mt-2 text-sm text-muted-foreground">Create your full-body avatar with 18 free starter clothing pieces and your own colours. Choose Save avatar to use this look in gigs.</p>
    <p className="mt-2 text-xs text-muted-foreground">Optional — you can keep your starter look and customise it later in the Avatar Creator.</p>
  </div>
  <Suspense fallback={<p role="status">Loading avatar creator…</p>}><PlayerModelEditor /></Suspense>
</div>;
