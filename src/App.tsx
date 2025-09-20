import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { GameDataProvider } from "./hooks/useGameData";
import Auth from "./pages/Auth";
import { lazyWithRetry } from "./utils/lazyWithRetry";
import WorldPulsePage from "./pages/WorldPulse";
import CharacterCreation from "./pages/CharacterCreation";

const Layout = lazyWithRetry(() => import("./components/Layout"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const PerformGig = lazyWithRetry(() => import("./pages/PerformGig"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const BandManager = lazyWithRetry(() => import("./pages/BandManager"));
const GigBooking = lazyWithRetry(() => import("./pages/GigBooking"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const MusicStudio = lazyWithRetry(() => import("./pages/MusicStudio"));
const Schedule = lazyWithRetry(() => import("./pages/Schedule"));
const EquipmentStore = lazyWithRetry(() => import("./pages/EquipmentStore"));
const FanManagement = lazyWithRetry(() => import("./pages/FanManagement"));
const Achievements = lazyWithRetry(() => import("./pages/Achievements"));
const TourManager = lazyWithRetry(() => import("./pages/TourManager"));
const RecordLabel = lazyWithRetry(() => import("./pages/RecordLabel"));
const SocialMedia = lazyWithRetry(() => import("./pages/SocialMedia"));
const VenueManagement = lazyWithRetry(() => import("./pages/VenueManagement"));
const BandChemistry = lazyWithRetry(() => import("./pages/BandChemistry"));
const StreamingPlatforms = lazyWithRetry(() => import("./pages/StreamingPlatforms"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const MusicCreation = lazyWithRetry(() => import("./pages/MusicCreation"));
const StageSetup = lazyWithRetry(() => import("./pages/StageSetup"));
const EnhancedBandManager = lazyWithRetry(() => import("./pages/EnhancedBandManager"));
const PublicRelations = lazyWithRetry(() => import("./pages/PublicRelations"));
const City = lazyWithRetry(() => import("./pages/City"));
const Festivals = lazyWithRetry(() => import("./pages/Festivals"));
const SetlistDesigner = lazyWithRetry(() => import("./pages/SetlistDesigner"));
const EnhancedEquipmentStore = lazyWithRetry(() => import("./pages/EnhancedEquipmentStore"));
const EnhancedFanManagement = lazyWithRetry(() => import("./pages/EnhancedFanManagement"));
const AdvancedGigSystem = lazyWithRetry(() => import("./pages/AdvancedGigSystem"));
const CompetitiveCharts = lazyWithRetry(() => import("./pages/CompetitiveCharts"));
const TouringSystem = lazyWithRetry(() => import("./pages/TouringSystem"));
const Travel = lazyWithRetry(() => import("./pages/Travel"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const WorldEnvironment = lazyWithRetry(() => import("./pages/WorldEnvironment"));
const SongManager = lazyWithRetry(() => import("./pages/SongManager"));
const InventoryManager = lazyWithRetry(() => import("./pages/InventoryManager"));
const PlayerStatistics = lazyWithRetry(() => import("./pages/PlayerStatistics"));
const Busking = lazyWithRetry(() => import("./pages/Busking"));
const Education = lazyWithRetry(() => import("./pages/Education"));
const Health = lazyWithRetry(() => import("./pages/Health"));
const Underworld = lazyWithRetry(() => import("./pages/Underworld"));

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GameDataProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense
                fallback={
                  <div className="flex h-screen w-full items-center justify-center">
                    <p className="text-lg font-semibold">Loading page...</p>
                  </div>
                }
              >
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Index />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="band" element={<BandManager />} />
                    <Route path="gigs" element={<GigBooking />} />
                    <Route path="gigs/perform/:gigId" element={<PerformGig />} />
                    <Route path="busking" element={<Busking />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="character-create" element={<CharacterCreation />} />
                    <Route path="music" element={<MusicStudio />} />
                    <Route path="charts" element={<WorldPulsePage />} />
                    <Route path="schedule" element={<Schedule />} />
                    <Route path="equipment" element={<EquipmentStore />} />
                    <Route path="fans" element={<FanManagement />} />
                    <Route path="achievements" element={<Achievements />} />
                    <Route path="city" element={<City />} />
                    <Route path="tours" element={<TourManager />} />
                    <Route path="setlists" element={<SetlistDesigner />} />
                    <Route path="travel" element={<Travel />} />
                    <Route path="labels" element={<RecordLabel />} />
                    <Route path="social" element={<SocialMedia />} />
                    <Route path="pr" element={<PublicRelations />} />
                    <Route path="venues" element={<VenueManagement />} />
                    <Route path="festivals" element={<Festivals />} />
                    <Route path="chemistry" element={<BandChemistry />} />
                    <Route path="streaming" element={<StreamingPlatforms />} />
                    <Route path="stage-setup" element={<StageSetup />} />
                    <Route path="underworld" element={<Underworld />} />
                    <Route path="education" element={<Education />} />
                    <Route path="create" element={<MusicCreation />} />
                    <Route path="band-enhanced" element={<EnhancedBandManager />} />
                    <Route path="equipment-enhanced" element={<EnhancedEquipmentStore />} />
                    <Route path="fans-enhanced" element={<EnhancedFanManagement />} />
                    <Route path="gigs/advanced/:gigId" element={<AdvancedGigSystem />} />
                    <Route path="charts-competitive" element={<CompetitiveCharts />} />
                    <Route path="tours-system" element={<TouringSystem />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="world" element={<WorldEnvironment />} />
                    <Route path="songs" element={<SongManager />} />
                    <Route path="inventory" element={<InventoryManager />} />
                    <Route path="statistics" element={<PlayerStatistics />} />
                    <Route path="health" element={<Health />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </GameDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
