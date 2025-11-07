import { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { GameDataProvider } from "./hooks/useGameData";
import Auth from "./pages/Auth";
import { lazyWithRetry } from "./utils/lazyWithRetry";

// Redirect component for removed placeholder pages
const RedirectTo = ({ to }: { to: string }) => {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
};
import WorldPulsePage from "./pages/WorldPulse";
import MusicHub from "./pages/MusicHub";
import BandManager from "./pages/BandManager";
import InventoryManager from "./pages/InventoryManager";

const Layout = lazyWithRetry(() => import("./components/Layout"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const PerformGig = lazyWithRetry(() => import("./pages/PerformGig"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const GigBooking = lazyWithRetry(() => import("./pages/GigBooking"));
const Performance = lazyWithRetry(() => import("./pages/Performance"));
const MyCharacter = lazyWithRetry(() => import("./pages/MyCharacter"));
const Schedule = lazyWithRetry(() => import("./pages/Schedule"));
const EquipmentStore = lazyWithRetry(() => import("./pages/EquipmentStore"));
const FanManagement = lazyWithRetry(() => import("./pages/FanManagement"));

const TourManager = lazyWithRetry(() => import("./pages/TourManager"));
const RecordLabel = lazyWithRetry(() => import("./pages/RecordLabel"));
const SocialMedia = lazyWithRetry(() => import("./pages/SocialMedia"));
const VenueManagement = lazyWithRetry(() => import("./pages/VenueManagement"));
const BandChemistry = lazyWithRetry(() => import("./pages/BandChemistry"));
const StreamingPlatforms = lazyWithRetry(() => import("./pages/StreamingPlatforms"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Songwriting = lazyWithRetry(() => import("./pages/Songwriting"));
const SongMarket = lazyWithRetry(() => import("./pages/SongMarket"));
const StageSetup = lazyWithRetry(() => import("./pages/StageSetup"));
const EnhancedBandManager = lazyWithRetry(() => import("./pages/EnhancedBandManager"));
const PublicRelations = lazyWithRetry(() => import("./pages/PublicRelations"));
const City = lazyWithRetry(() => import("./pages/City"));
const WorldMap = lazyWithRetry(() => import("./pages/WorldMap"));
const Festivals = lazyWithRetry(() => import("./pages/Festivals"));
const AwardShows = lazyWithRetry(() => import("./pages/AwardShows"));
const SetlistManager = lazyWithRetry(() => import("./pages/SetlistManager"));
const EnhancedEquipmentStore = lazyWithRetry(() => import("./pages/EnhancedEquipmentStore"));
const EnhancedFanManagement = lazyWithRetry(() => import("./pages/EnhancedFanManagement"));
const AdvancedGigSystem = lazyWithRetry(() => import("./pages/AdvancedGigSystem"));
const StageEquipmentSystemPlan = lazyWithRetry(() => import("./pages/StageEquipmentSystemPlan"));
const StageEquipmentSystem = lazyWithRetry(() => import("./pages/StageEquipmentSystem"));
const CompetitiveCharts = lazyWithRetry(() => import("./pages/CompetitiveCharts"));
const TouringSystem = lazyWithRetry(() => import("./pages/TouringSystem"));
const Travel = lazyWithRetry(() => import("./pages/Travel"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Twaater = lazyWithRetry(() => import("./pages/Twaater"));
const AdminExperienceRewards = lazyWithRetry(() => import("./pages/admin/ExperienceRewards"));
const AdminUniversities = lazyWithRetry(() => import("./pages/admin/Universities"));
const AdminCourses = lazyWithRetry(() => import("./pages/admin/Courses"));
const UniversityDetail = lazyWithRetry(() => import("./pages/UniversityDetail"));
const AdminCities = lazyWithRetry(() => import("./pages/admin/Cities"));
const AdminDistricts = lazyWithRetry(() => import("./pages/admin/Districts"));
const AdminSkillBooks = lazyWithRetry(() => import("./pages/admin/SkillBooks"));
const AdminStudios = lazyWithRetry(() => import("./pages/admin/Studios"));
const AdminCityStudios = lazyWithRetry(() => import("./pages/admin/CityStudios"));
const AdminProductionNotes = lazyWithRetry(() => import("./pages/admin/ProductionNotes"));
const AdminNightClubs = lazyWithRetry(() => import("./pages/admin/NightClubs"));
const AdminYoutubeVideos = lazyWithRetry(() => import("./pages/admin/YoutubeVideos"));
const AdminBandLearning = lazyWithRetry(() => import("./pages/admin/BandLearning"));
const AdminGameCalendar = lazyWithRetry(() => import("./pages/admin/GameCalendar"));
const AdminMentors = lazyWithRetry(() => import("./pages/admin/Mentors"));
const AdminStreamingPlatforms = lazyWithRetry(() => import("./pages/admin/StreamingPlatforms"));
const AdminMarketplace = lazyWithRetry(() => import("./pages/admin/Marketplace"));
const AdminJobs = lazyWithRetry(() => import("./pages/admin/Jobs"));
const AdminVenues = lazyWithRetry(() => import("./pages/admin/Venues"));
const AdminRehearsalRooms = lazyWithRetry(() => import("./pages/admin/RehearsalRooms"));
const AdminTravel = lazyWithRetry(() => import("./pages/admin/Travel"));
const AdminSongGifts = lazyWithRetry(() => import("./pages/admin/SongGifts"));
const AdminProducers = lazyWithRetry(() => import("./pages/admin/Producers"));
const AdminTwaaterModeration = lazyWithRetry(() => import("./pages/admin/TwaaterModeration"));
const AdminCronMonitor = lazyWithRetry(() => import("./pages/admin/CronMonitor"));
const AdminReleaseConfig = lazyWithRetry(() => import("./pages/admin/ReleaseConfig"));
const AdminRadioStations = lazyWithRetry(() => import("./pages/admin/RadioStations"));
const WorldEnvironment = lazyWithRetry(() => import("./pages/WorldEnvironment"));
const Employment = lazyWithRetry(() => import("./pages/Employment"));
const Radio = lazyWithRetry(() => import("./pages/Radio"));
const SongManager = lazyWithRetry(() => import("./pages/SongManager"));
const PlayerStatistics = lazyWithRetry(() => import("./pages/PlayerStatistics"));
const Busking = lazyWithRetry(() => import("./pages/Busking"));
const JamSessions = lazyWithRetry(() => import("./pages/JamSessions"));
const Education = lazyWithRetry(() => import("./pages/Education"));
const RecordingStudio = lazyWithRetry(() => import("./pages/RecordingStudio"));
const ReleaseManager = lazyWithRetry(() => import("./pages/ReleaseManager"));
const MediaNetworks = lazyWithRetry(() => import("./pages/MediaNetworks"));

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
                    <Route path="jams" element={<JamSessions />} />
                    <Route path="gigs/perform/:gigId" element={<PerformGig />} />
                    <Route path="busking" element={<Busking />} />
                    <Route path="my-character" element={<MyCharacter />} />
                    <Route path="music" element={<MusicHub />} />
                    <Route path="song-manager" element={<SongManager />} />
                    <Route path="streaming-platforms" element={<StreamingPlatforms />} />
                    <Route path="competitive-charts" element={<CompetitiveCharts />} />
                    <Route path="schedule" element={<Schedule />} />
                    <Route path="equipment" element={<EquipmentStore />} />
                    <Route path="fans" element={<FanManagement />} />
                    
                    <Route path="cities" element={<WorldEnvironment />} />
                    <Route path="cities/:cityId" element={<City />} />
                    <Route path="setlists" element={<SetlistManager />} />
                    <Route path="travel" element={<Travel />} />
                    <Route path="social" element={<SocialMedia />} />
                    <Route path="pr" element={<PublicRelations />} />
                    <Route path="venues" element={<VenueManagement />} />
                    <Route path="festivals" element={<Festivals />} />
                    <Route path="awards" element={<AwardShows />} />
                    <Route path="chemistry" element={<BandChemistry />} />
                    <Route path="stage-setup" element={<StageSetup />} />
                    <Route path="stage-equipment" element={<StageEquipmentSystem />} />
                    <Route path="stage-equipment-system-plan" element={<StageEquipmentSystemPlan />} />
                    <Route path="finances" element={<Finances />} />
                    <Route path="underworld" element={<Underworld />} />
                    <Route path="education" element={<Education />} />
                    <Route path="songwriting" element={<Songwriting />} />
                    <Route path="song-market" element={<SongMarket />} />
                    <Route path="recording-studio" element={<RecordingStudio />} />
                    <Route path="release-manager" element={<ReleaseManager />} />
                    
                    {/* Redirects for removed placeholder pages */}
                    <Route path="tours" element={<RedirectTo to="/travel" />} />
                    <Route path="schedule" element={<RedirectTo to="/dashboard" />} />
                    <Route path="equipment" element={<RedirectTo to="/gear" />} />
                    <Route path="equipment-enhanced" element={<RedirectTo to="/gear" />} />
                    <Route path="fans" element={<RedirectTo to="/pr" />} />
                    <Route path="fans-enhanced" element={<RedirectTo to="/pr" />} />
                    <Route path="band-enhanced" element={<RedirectTo to="/band" />} />
                    <Route path="streaming" element={<StreamingPlatforms />} />
                    <Route path="labels" element={<RecordLabel />} />
                    <Route path="record-label" element={<Navigate to="/labels" replace />} />
                    <Route path="tours-system" element={<RedirectTo to="/travel" />} />
                    <Route path="charts" element={<RedirectTo to="/dashboard" />} />
                    <Route path="charts-competitive" element={<RedirectTo to="/dashboard" />} />
                    <Route path="songs" element={<RedirectTo to="/music" />} />
                    <Route path="gigs/advanced/:gigId" element={<AdvancedGigSystem />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="university/:id" element={<UniversityDetail />} />
                    <Route path="admin/universities" element={<AdminUniversities />} />
                    <Route path="admin/courses" element={<AdminCourses />} />
                    <Route path="admin/cities" element={<AdminCities />} />
                    <Route path="admin/districts" element={<AdminDistricts />} />
                    <Route path="admin/city-studios" element={<AdminCityStudios />} />
                    <Route path="admin/production-notes" element={<AdminProductionNotes />} />
                    <Route path="admin/skill-books" element={<AdminSkillBooks />} />
                    <Route path="admin/night-clubs" element={<AdminNightClubs />} />
                    <Route path="admin/game-calendar" element={<AdminGameCalendar />} />
                    <Route path="admin/mentors" element={<AdminMentors />} />
                    <Route path="admin/jobs" element={<AdminJobs />} />
                    <Route path="admin/venues" element={<AdminVenues />} />
                    <Route path="admin/rehearsal-rooms" element={<AdminRehearsalRooms />} />
                    <Route path="admin/travel" element={<AdminTravel />} />
                    <Route path="admin/song-gifts" element={<AdminSongGifts />} />
                    <Route path="admin/producers" element={<AdminProducers />} />
                    <Route path="admin/streaming-platforms" element={<AdminStreamingPlatforms />} />
                    <Route path="admin/marketplace" element={<AdminMarketplace />} />
                    <Route path="admin/twaater-moderation" element={<AdminTwaaterModeration />} />
                    <Route path="admin/cron-monitor" element={<AdminCronMonitor />} />
                    <Route path="admin/release-config" element={<AdminReleaseConfig />} />
                    <Route path="admin/radio-stations" element={<AdminRadioStations />} />
                    <Route path="employment" element={<Employment />} />
                    <Route path="radio" element={<Radio />} />
                    <Route path="performance" element={<Performance />} />
                    <Route path="performance/gig/:gigId" element={<PerformGig />} />
                    <Route path="media" element={<MediaNetworks />} />
                    <Route path="busking" element={<Navigate to="/performance?tab=busking" replace />} />
                    <Route path="jams" element={<Navigate to="/performance?tab=jams" replace />} />
                    <Route path="world" element={<WorldEnvironment />} />
                    {/* <Route path="world-map" element={<WorldMap />} /> */}
                    <Route path="inventory" element={<InventoryManager />} />
                    <Route path="gear" element={<MyGear />} />
                    <Route path="merchandise" element={<Merchandise />} />
                    <Route path="statistics" element={<PlayerStatistics />} />
                    <Route path="my-character/edit" element={<MyCharacterEdit />} />
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
