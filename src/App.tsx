import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { GameDataProvider } from "./hooks/useGameData";

const Layout = lazy(() => import("./components/Layout"));
const Index = lazy(() => import("./pages/Index"));
const PerformGig = lazy(() => import("./pages/PerformGig"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const BandManager = lazy(() => import("./pages/BandManager"));
const GigBooking = lazy(() => import("./pages/GigBooking"));
const Profile = lazy(() => import("./pages/Profile"));
const CharacterCreation = lazy(() => import("./pages/CharacterCreation"));
const MusicStudio = lazy(() => import("./pages/MusicStudio"));
const WorldPulse = lazy(() => import("./pages/WorldPulse"));
const Schedule = lazy(() => import("./pages/Schedule"));
const EquipmentStore = lazy(() => import("./pages/EquipmentStore"));
const FanManagement = lazy(() => import("./pages/FanManagement"));
const Achievements = lazy(() => import("./pages/Achievements"));
const TourManager = lazy(() => import("./pages/TourManager"));
const RecordLabel = lazy(() => import("./pages/RecordLabel"));
const SocialMedia = lazy(() => import("./pages/SocialMedia"));
const VenueManagement = lazy(() => import("./pages/VenueManagement"));
const BandChemistry = lazy(() => import("./pages/BandChemistry"));
const StreamingPlatforms = lazy(() => import("./pages/StreamingPlatforms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SkillTraining = lazy(() => import("./pages/SkillTraining"));
const MusicCreation = lazy(() => import("./pages/MusicCreation"));
const EnhancedBandManager = lazy(() => import("./pages/EnhancedBandManager"));
const EnhancedEquipmentStore = lazy(() => import("./pages/EnhancedEquipmentStore"));
const EnhancedFanManagement = lazy(() => import("./pages/EnhancedFanManagement"));
const AdvancedGigSystem = lazy(() => import("./pages/AdvancedGigSystem"));
const CompetitiveCharts = lazy(() => import("./pages/CompetitiveCharts"));
const TouringSystem = lazy(() => import("./pages/TouringSystem"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RealtimeCommunication = lazy(() => import("./pages/RealtimeCommunication"));
const WorldEnvironment = lazy(() => import("./pages/WorldEnvironment"));
const SongManager = lazy(() => import("./pages/SongManager"));
const InventoryManager = lazy(() => import("./pages/InventoryManager"));
const PlayerStatistics = lazy(() => import("./pages/PlayerStatistics"));
const Busking = lazy(() => import("./pages/Busking"));

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
                    <Route path="charts" element={<WorldPulse />} />
                    <Route path="schedule" element={<Schedule />} />
                    <Route path="equipment" element={<EquipmentStore />} />
                    <Route path="fans" element={<FanManagement />} />
                    <Route path="achievements" element={<Achievements />} />
                    <Route path="tours" element={<TourManager />} />
                    <Route path="labels" element={<RecordLabel />} />
                    <Route path="social" element={<SocialMedia />} />
                    <Route path="venues" element={<VenueManagement />} />
                    <Route path="chemistry" element={<BandChemistry />} />
                    <Route path="streaming" element={<StreamingPlatforms />} />
                    <Route path="training" element={<SkillTraining />} />
                    <Route path="create" element={<MusicCreation />} />
                    <Route path="band-enhanced" element={<EnhancedBandManager />} />
                    <Route path="equipment-enhanced" element={<EnhancedEquipmentStore />} />
                    <Route path="fans-enhanced" element={<EnhancedFanManagement />} />
                    <Route path="gigs/advanced/:gigId" element={<AdvancedGigSystem />} />
                    <Route path="charts-competitive" element={<CompetitiveCharts />} />
                    <Route path="tours-system" element={<TouringSystem />} />
                    <Route path="admin" element={<AdminDashboard />} />
                    <Route path="communication" element={<RealtimeCommunication />} />
                    <Route path="world" element={<WorldEnvironment />} />
                    <Route path="songs" element={<SongManager />} />
                    <Route path="inventory" element={<InventoryManager />} />
                    <Route path="statistics" element={<PlayerStatistics />} />
                    <Route path="character/create" element={<CharacterCreation />} />
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
