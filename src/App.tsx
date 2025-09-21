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

const Layout = lazyWithRetry(() => import("./components/Layout"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const PerformGig = lazyWithRetry(() => import("./pages/PerformGig"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const BandManager = lazyWithRetry(() => import("./pages/BandManager"));
const GigBooking = lazyWithRetry(() => import("./pages/GigBooking"));
const MyCharacter = lazyWithRetry(() => import("./pages/MyCharacter"));
const MusicStudio = lazyWithRetry(() => import("./pages/MusicStudio"));
const Schedule = lazyWithRetry(() => import("./pages/Schedule"));
const EquipmentStore = lazyWithRetry(() => import("./pages/EquipmentStore"));
const FanManagement = lazyWithRetry(() => import("./pages/FanManagement"));
const Achievements = lazyWithRetry(() => import("./pages/Achievements"));
const FriendsHub = lazyWithRetry(() => import("./pages/FriendsHub"));
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
const WorldMap = lazyWithRetry(() => import("./pages/WorldMap"));
const Festivals = lazyWithRetry(() => import("./pages/Festivals"));
const SetlistDesigner = lazyWithRetry(() => import("./pages/SetlistDesigner"));
const EnhancedEquipmentStore = lazyWithRetry(() => import("./pages/EnhancedEquipmentStore"));
const EnhancedFanManagement = lazyWithRetry(() => import("./pages/EnhancedFanManagement"));
const AdvancedGigSystem = lazyWithRetry(() => import("./pages/AdvancedGigSystem"));
const CompetitiveCharts = lazyWithRetry(() => import("./pages/CompetitiveCharts"));
const TouringSystem = lazyWithRetry(() => import("./pages/TouringSystem"));
const Travel = lazyWithRetry(() => import("./pages/Travel"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const AdminExperienceRewards = lazyWithRetry(() => import("./pages/admin/ExperienceRewards"));
const AdminUniversities = lazyWithRetry(() => import("./pages/admin/Universities"));
const AdminCities = lazyWithRetry(() => import("./pages/admin/Cities"));
const AdminSkillBooks = lazyWithRetry(() => import("./pages/admin/SkillBooks"));
const AdminYoutubeVideos = lazyWithRetry(() => import("./pages/admin/YoutubeVideos"));
const AdminBandLearning = lazyWithRetry(() => import("./pages/admin/BandLearning"));
const AdminMentors = lazyWithRetry(() => import("./pages/admin/Mentors"));
const AdminStageSetup = lazyWithRetry(() => import("./pages/admin/StageSetup"));
const AdminUnderworldStore = lazyWithRetry(() => import("./pages/admin/UnderworldStore"));
const WorldEnvironment = lazyWithRetry(() => import("./pages/WorldEnvironment"));
const SongManager = lazyWithRetry(() => import("./pages/SongManager"));
const InventoryManager = lazyWithRetry(() => import("./pages/InventoryManager"));
const PlayerStatistics = lazyWithRetry(() => import("./pages/PlayerStatistics"));
const Busking = lazyWithRetry(() => import("./pages/Busking"));
const Education = lazyWithRetry(() => import("./pages/Education"));
const Health = lazyWithRetry(() => import("./pages/Health"));
const Therapy = lazyWithRetry(() => import("./pages/Therapy"));
const Rehab = lazyWithRetry(() => import("./pages/Rehab"));
const WonderDrugs = lazyWithRetry(() => import("./pages/WonderDrugs"));
const CosmeticSurgery = lazyWithRetry(() => import("./pages/CosmeticSurgery"));
const Doctor = lazyWithRetry(() => import("./pages/Doctor"));
const Underworld = lazyWithRetry(() => import("./pages/Underworld"));
const Finances = lazyWithRetry(() => import("./pages/Finances"));
const Merchandise = lazyWithRetry(() => import("./pages/Merchandise"));
const MyGear = lazyWithRetry(() => import("./pages/MyGear"));
const MyCharacterEdit = lazyWithRetry(() => import("./pages/MyCharacterEdit"));
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
                    <Route path="my-character" element={<MyCharacter />} />
                    <Route path="music" element={<MusicStudio />} />
                    <Route path="charts" element={<WorldPulsePage />} />
                    <Route path="schedule" element={<Schedule />} />
                    <Route path="equipment" element={<EquipmentStore />} />
                    <Route path="fans" element={<FanManagement />} />
                    <Route path="friends" element={<FriendsHub />} />
                    <Route path="achievements" element={<Achievements />} />
                    <Route path="cities" element={<WorldEnvironment />} />
                    <Route path="cities/:cityId" element={<City />} />
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
                    <Route path="finances" element={<Finances />} />
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
                    <Route path="admin/experience-rewards" element={<AdminExperienceRewards />} />
                    <Route path="admin/universities" element={<AdminUniversities />} />
                    <Route path="admin/cities" element={<AdminCities />} />
                    <Route path="admin/skill-books" element={<AdminSkillBooks />} />
                    <Route path="admin/youtube-videos" element={<AdminYoutubeVideos />} />
                    <Route path="admin/band-learning" element={<AdminBandLearning />} />
                    <Route path="admin/mentors" element={<AdminMentors />} />
                    <Route path="admin/stage-setup" element={<AdminStageSetup />} />
                    <Route path="admin/underworld-store" element={<AdminUnderworldStore />} />
                    <Route path="world" element={<WorldEnvironment />} />
                    <Route path="world-map" element={<WorldMap />} />
                    <Route path="songs" element={<SongManager />} />
                    <Route path="inventory" element={<InventoryManager />} />
                    <Route path="gear" element={<MyGear />} />
                    <Route path="merchandise" element={<Merchandise />} />
                    <Route path="statistics" element={<PlayerStatistics />} />
                    <Route path="health" element={<Health />} />
                    <Route path="health/therapy" element={<Therapy />} />
                    <Route path="health/rehab" element={<Rehab />} />
                    <Route path="health/wonder-drugs" element={<WonderDrugs />} />
                    <Route path="health/cosmetic-surgery" element={<CosmeticSurgery />} />
                    <Route path="health/doctor" element={<Doctor />} />
                    <Route path="my-character/edit" element={<MyCharacterEdit />} />
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
