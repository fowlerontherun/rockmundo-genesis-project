import { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { GameDataProvider } from "./hooks/useGameData";
import { StageEquipmentCatalogProvider } from "./features/stage-equipment/catalog-context";
import { BandCrewCatalogProvider } from "./features/band-crew/catalog-context";
import { NotificationProvider } from "./contexts/NotificationContext";
import { TutorialProvider } from "./contexts/TutorialContext";
import { RadioProvider } from "./components/radio/RMRadioPlayer";
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
import BandManager from "./pages/BandManager";
import InventoryManager from "./pages/InventoryManager";
import Sponsorships from "./pages/Sponsorships";

const Layout = lazyWithRetry(() => import("./components/Layout"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const PerformGig = lazyWithRetry(() => import("./pages/PerformGig"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const OffersDashboard = lazyWithRetry(() => import("./pages/OffersDashboard"));
const GigBooking = lazyWithRetry(() => import("./pages/GigBooking"));

const Schedule = lazyWithRetry(() => import("./pages/Schedule"));
// Equipment store pages removed - replaced by EnhancedEquipmentStore
const FanManagement = lazyWithRetry(() => import("./pages/FanManagement"));
const Onboarding = lazyWithRetry(() => import("./pages/onboarding/OnboardingWizard"));

const TourManager = lazyWithRetry(() => import("./pages/TourManager"));
const RecordLabel = lazyWithRetry(() => import("./pages/RecordLabel"));
const SocialMedia = lazyWithRetry(() => import("./pages/SocialMedia"));
const Relationships = lazyWithRetry(() => import("./pages/Relationships"));
const VenueManagement = lazyWithRetry(() => import("./pages/VenueManagement"));
const BandChemistry = lazyWithRetry(() => import("./pages/BandChemistry"));
const StreamingPlatforms = lazyWithRetry(() => import("./pages/StreamingPlatforms"));
const StreamingPlatformDetail = lazyWithRetry(() => import("./pages/StreamingPlatformDetail"));
const AdvisorPage = lazyWithRetry(() => import("./pages/advisor"));
const Gettit = lazyWithRetry(() => import("./pages/Gettit"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Songwriting = lazyWithRetry(() => import("./pages/Songwriting"));
const SongMarket = lazyWithRetry(() => import("./pages/SongMarket"));
const StageSetup = lazyWithRetry(() => import("./pages/StageSetup"));
const EnhancedBandManager = lazyWithRetry(() => import("./pages/EnhancedBandManager"));
const PublicRelations = lazyWithRetry(() => import("./pages/PublicRelations"));
const PRSubmissionsHistory = lazyWithRetry(() => import("./pages/media/PRSubmissionsHistory"));
const Legacy = lazyWithRetry(() => import("./pages/legacy"));
const AdminPlayerManagement = lazyWithRetry(() => import("./pages/admin/PlayerManagement"));
const AdminAchievements = lazyWithRetry(() => import("./pages/admin/Achievements"));
const AdminAnalytics = lazyWithRetry(() => import("./pages/admin/Analytics"));
const AwardsAdmin = lazyWithRetry(() => import("./pages/admin/AwardsAdmin"));
const FestivalsAdminPage = lazyWithRetry(() => import("./pages/admin/FestivalsAdmin"));
const EurovisionAdminPage = lazyWithRetry(() => import("./pages/admin/EurovisionAdmin"));
const AdvisorAdmin = lazyWithRetry(() => import("./pages/admin/AdvisorAdmin"));
const PublicRelationsAdmin = lazyWithRetry(() => import("./pages/admin/PublicRelationsAdmin"));
const UnderworldAdmin = lazyWithRetry(() => import("./pages/admin/UnderworldAdmin"));
const WellnessPage = lazyWithRetry(() => import("./pages/Wellness"));
const EducationBooking = lazyWithRetry(() => import("./pages/booking/EducationBooking"));
const PerformanceBooking = lazyWithRetry(() => import("./pages/booking/PerformanceBooking"));
const WorkBooking = lazyWithRetry(() => import("./pages/booking/WorkBooking"));
const SongwritingBooking = lazyWithRetry(() => import("./pages/booking/SongwritingBooking"));
const City = lazyWithRetry(() => import("./pages/City"));
const WorldMap = lazyWithRetry(() => import("./pages/WorldMap"));
const UnderworldNew = lazyWithRetry(() => import("./pages/UnderworldNew"));
const DikCok = lazyWithRetry(() => import("./pages/DikCok"));
// TourManagerNew removed - using TourManager instead
const StreamingNew = lazyWithRetry(() => import("./pages/StreamingNew"));
const ChartsPage = lazyWithRetry(() => import("./pages/music/charts"));
// const EurovisionResultsPage = lazyWithRetry(() => import("./pages/EurovisionResults"));
const FestivalsNew = lazyWithRetry(() => import("./pages/FestivalsNew"));
const FestivalBrowser = lazyWithRetry(() => import("./pages/FestivalBrowser"));
// const Awards = lazyWithRetry(() => import("./pages/Awards"));
const SetlistManager = lazyWithRetry(() => import("./pages/SetlistManager"));
const EnhancedEquipmentStore = lazyWithRetry(() => import("./pages/EnhancedEquipmentStore"));
const EnhancedFanManagement = lazyWithRetry(() => import("./pages/EnhancedFanManagement"));
const AdvancedGigSystem = lazyWithRetry(() => import("./pages/AdvancedGigSystem"));
const StageEquipmentSystemPlan = lazyWithRetry(() => import("./pages/StageEquipmentSystemPlan"));
const StageEquipmentSystem = lazyWithRetry(() => import("./pages/StageEquipmentSystem"));
const BandCrewManagement = lazyWithRetry(() => import("./pages/BandCrewManagement"));
const BandRepertoire = lazyWithRetry(() => import("./pages/BandRepertoire"));
const BandManagementPage = lazyWithRetry(() => import("./pages/bands/[bandId]/management"));
const CompetitiveCharts = lazyWithRetry(() => import("./pages/CompetitiveCharts"));
const CountryCharts = lazyWithRetry(() => import("./pages/CountryCharts"));
const TouringSystem = lazyWithRetry(() => import("./pages/TouringSystem"));
const Travel = lazyWithRetry(() => import("./pages/Travel"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Twaater = lazyWithRetry(() => import("./pages/Twaater"));
const TwaaterProfileView = lazyWithRetry(() => import("./pages/TwaaterProfileView"));
const TwaaterHashtagView = lazyWithRetry(() => import("./pages/TwaaterHashtagView"));
const TwaaterMessagesPage = lazyWithRetry(() => import("./pages/TwaaterMessagesPage"));
const TwaaterNotifications = lazyWithRetry(() => import("./pages/TwaaterNotifications"));
const TwaaterTwaatView = lazyWithRetry(() => import("./pages/TwaaterTwaatView"));
const CommunityFeed = lazyWithRetry(() => import("./pages/community/feed"));
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

const AdminGameCalendar = lazyWithRetry(() => import("./pages/admin/GameCalendar"));
const AdminMentors = lazyWithRetry(() => import("./pages/admin/Mentors"));
const AdminStreamingPlatforms = lazyWithRetry(() => import("./pages/admin/StreamingPlatforms"));
const AdminMarketplace = lazyWithRetry(() => import("./pages/admin/Marketplace"));
const AdminJobs = lazyWithRetry(() => import("./pages/admin/Jobs"));
const AdminVenues = lazyWithRetry(() => import("./pages/admin/Venues"));
const AdminRehearsalRooms = lazyWithRetry(() => import("./pages/admin/RehearsalRooms"));
const AdminTravel = lazyWithRetry(() => import("./pages/admin/Travel"));
const AdminSongGifts = lazyWithRetry(() => import("./pages/admin/SongGifts"));
const BrandsAdmin = lazyWithRetry(() => import("./pages/admin/BrandsAdmin"));
const AdminProducers = lazyWithRetry(() => import("./pages/admin/Producers"));
const AdminTwaaterModeration = lazyWithRetry(() => import("./pages/admin/TwaaterModeration"));
const AdminCronMonitor = lazyWithRetry(() => import("./pages/admin/CronMonitor"));
const AdminOfferAutomation = lazyWithRetry(() => import("./pages/admin/OfferAutomation"));
const AdminReleaseConfig = lazyWithRetry(() => import("./pages/admin/ReleaseConfig"));
const AdminRadioStations = lazyWithRetry(() => import("./pages/admin/RadioStations"));
const AdminRadioContent = lazyWithRetry(() => import("./pages/admin/RadioContent"));
const AdminStageEquipmentCatalog = lazyWithRetry(() => import("./pages/admin/StageEquipmentCatalog"));
const AdminCrewCatalog = lazyWithRetry(() => import("./pages/admin/CrewCatalog"));
const GearItemsAdmin = lazyWithRetry(() => import("./pages/admin/GearItemsAdmin"));
const PageGraphicsAdmin = lazyWithRetry(() => import("./pages/admin/PageGraphicsAdmin"));
// const StageTemplatesAdmin = lazyWithRetry(() => import("./pages/admin/StageTemplatesAdmin"));
const BandAvatarsAdmin = lazyWithRetry(() => import("./pages/admin/BandAvatarsAdmin"));
const CrowdBehaviorAdmin = lazyWithRetry(() => import("./pages/admin/CrowdBehaviorAdmin"));
const CrowdSoundsAdmin = lazyWithRetry(() => import("./pages/admin/CrowdSoundsAdmin"));
const Admin3DGigDemo = lazyWithRetry(() => import("./pages/admin/Admin3DGigDemo"));
const SkillDefinitionsAdmin = lazyWithRetry(() => import("./pages/admin/SkillDefinitions"));
const PlayerSearch = lazyWithRetry(() => import("./pages/PlayerSearch"));
const PlayerProfile = lazyWithRetry(() => import("./pages/PlayerProfile"));
const BandBrowser = lazyWithRetry(() => import("./pages/BandBrowser"));
const BandProfile = lazyWithRetry(() => import("./pages/BandProfile"));
const BandSearch = lazyWithRetry(() => import("./pages/BandSearch"));
const BandFinder = lazyWithRetry(() => import("./pages/BandFinder"));
const BandRankings = lazyWithRetry(() => import("./pages/BandRankings"));
const SongwritingAdmin = lazyWithRetry(() => import("./pages/admin/SongwritingAdmin"));
const GigsAdmin = lazyWithRetry(() => import("./pages/admin/GigsAdmin"));
const ChartsAdmin = lazyWithRetry(() => import("./pages/admin/ChartsAdmin"));
const TwaaterAdmin = lazyWithRetry(() => import("./pages/admin/TwaaterAdmin"));
const LabelsAdmin = lazyWithRetry(() => import("./pages/admin/LabelsAdmin"));
const BandAdmin = lazyWithRetry(() => import("./pages/admin/BandAdmin"));
const ReleasesAdmin = lazyWithRetry(() => import("./pages/admin/ReleasesAdmin"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const GameBalanceAdmin = lazyWithRetry(() => import("./pages/admin/GameBalanceAdmin"));
const TutorialsAdmin = lazyWithRetry(() => import("./pages/admin/TutorialsAdmin"));
const VipManagement = lazyWithRetry(() => import("./pages/admin/VipManagement"));
const SkinCollectionsAdmin = lazyWithRetry(() => import("./pages/admin/SkinCollectionsAdmin"));
const AISongGeneration = lazyWithRetry(() => import("./pages/admin/AISongGeneration"));
const RandomEventsAdmin = lazyWithRetry(() => import("./pages/admin/RandomEventsAdmin"));
const CollectionItemsAdmin = lazyWithRetry(() => import("./pages/admin/CollectionItemsAdmin"));
const FameFansGifting = lazyWithRetry(() => import("./pages/admin/FameFansGifting"));
const StreamMultiplier = lazyWithRetry(() => import("./pages/admin/StreamMultiplier"));
const About = lazyWithRetry(() => import("./pages/About"));
const WorldEnvironment = lazyWithRetry(() => import("./pages/WorldEnvironment"));
const Employment = lazyWithRetry(() => import("./pages/Employment"));
const RadioBrowser = lazyWithRetry(() => import("./pages/media/RadioBrowser"));
const MusicVideos = lazyWithRetry(() => import("./pages/MusicVideos"));
const RadioStationDetail = lazyWithRetry(() => import("./pages/RadioStationDetail"));
const TVShowsBrowser = lazyWithRetry(() => import("./pages/media/TVShowsBrowser"));
const NewspapersBrowser = lazyWithRetry(() => import("./pages/media/NewspapersBrowser"));
const MagazinesBrowser = lazyWithRetry(() => import("./pages/media/MagazinesBrowser"));
const PodcastsBrowser = lazyWithRetry(() => import("./pages/media/PodcastsBrowser"));
const FilmsBrowser = lazyWithRetry(() => import("./pages/media/FilmsBrowser"));
const SongManager = lazyWithRetry(() => import("./pages/SongManager"));
const PlayerStatistics = lazyWithRetry(() => import("./pages/PlayerStatistics"));
const OverviewPage = lazyWithRetry(() => import("./pages/Overview"));
const Busking = lazyWithRetry(() => import("./pages/Busking"));
const JamSessions = lazyWithRetry(() => import("./components/jam-sessions/JamSessionsEnhanced"));
const Rehearsals = lazyWithRetry(() => import("./pages/Rehearsals"));
const OpenMicNights = lazyWithRetry(() => import("./pages/OpenMicNights"));
const PerformOpenMic = lazyWithRetry(() => import("./pages/PerformOpenMic"));
const FestivalAdmin = lazyWithRetry(() => import("./pages/admin/FestivalAdmin"));
const Education = lazyWithRetry(() => import("./pages/Education"));
const RecordingStudio = lazyWithRetry(() => import("./pages/RecordingStudio"));
const ReleaseManager = lazyWithRetry(() => import("./pages/ReleaseManager"));
const MusicHub = lazyWithRetry(() => import("./pages/MusicHub"));
const ReleaseDetail = lazyWithRetry(() => import("./pages/ReleaseDetail"));
const MediaNetworks = lazyWithRetry(() => import("./pages/MediaNetworks"));
// const CharityPage = lazyWithRetry(() => import("./pages/community/charity"));

const Underworld = lazyWithRetry(() => import("./pages/UnderworldNew"));
const NarrativeStoryPage = lazyWithRetry(
  () => import("./pages/events/narratives/[storyId]"),
);
const EurovisionPage = lazyWithRetry(() => import("./pages/Eurovision"));
const Finances = lazyWithRetry(() => import("./pages/Finances"));
const Merchandise = lazyWithRetry(() => import("./pages/Merchandise"));
const MyGear = lazyWithRetry(() => import("./pages/MyGear"));
const MyCharacterEdit = lazyWithRetry(() => import("./pages/MyCharacterEdit"));
const TodaysNewsPage = lazyWithRetry(() => import("./pages/TodaysNews"));
const Gear = lazyWithRetry(() => import("./pages/Gear"));
const AvatarDesigner = lazyWithRetry(() => import("./pages/AvatarDesigner"));
const BandRiders = lazyWithRetry(() => import("./pages/BandRiders"));
const BandVehicles = lazyWithRetry(() => import("./pages/BandVehicles"));
const SkinStore = lazyWithRetry(() => import("./pages/SkinStore"));
const PublicSong = lazyWithRetry(() => import("./pages/PublicSong"));
const Prison = lazyWithRetry(() => import("./pages/Prison"));
const VersionHistory = lazyWithRetry(() => import("./pages/VersionHistory"));
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GameDataProvider>
          <NotificationProvider>
            <TutorialProvider>
              <RadioProvider>
                <StageEquipmentCatalogProvider>
                  <BandCrewCatalogProvider>
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
                  <Route path="/about" element={<About />} />
                  <Route path="/song/:songId" element={<PublicSong />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Index />} />
                    <Route path="todays-news" element={<TodaysNewsPage />} />
                    <Route path="wellness" element={<WellnessPage />} />
                    <Route path="underworld" element={<UnderworldNew />} />
                    <Route path="dikcok" element={<DikCok />} />
                    <Route path="tour-manager" element={<TourManager />} />
                    <Route path="streaming" element={<Navigate to="/streaming-platforms" replace />} />
                    <Route path="music/charts" element={<ChartsPage />} />
                    {/* <Route path="eurovision" element={<EurovisionResultsPage />} /> */}
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="offers-dashboard" element={<OffersDashboard />} />
                    <Route path="onboarding" element={<Onboarding />} />
                    <Route path="band" element={<BandManager />} />
                    <Route path="band/repertoire" element={<BandRepertoire />} />
                    <Route path="bands/:bandId/management" element={<BandManagementPage />} />
                    <Route path="gigs" element={<GigBooking />} />
                    <Route path="jams" element={<JamSessions />} />
                    <Route path="gigs/perform/:gigId" element={<PerformGig />} />
                    <Route path="busking" element={<Busking />} />
                    
                    <Route path="song-manager" element={<SongManager />} />
                    <Route path="streaming-platforms" element={<StreamingPlatforms />} />
                    <Route path="streaming/:platformId" element={<StreamingPlatformDetail />} />
                    <Route path="advisor" element={<AdvisorPage />} />
                    <Route path="competitive-charts" element={<CompetitiveCharts />} />
                    <Route path="country-charts" element={<CountryCharts />} />
                    <Route path="schedule" element={<Schedule />} />
                    <Route path="booking/education" element={<EducationBooking />} />
                    <Route path="booking/performance" element={<PerformanceBooking />} />
                    <Route path="booking/work" element={<WorkBooking />} />
                    <Route path="booking/songwriting" element={<SongwritingBooking />} />
                    <Route path="world-pulse" element={<WorldPulsePage />} />
                    <Route path="gettit" element={<Gettit />} />
                    <Route path="community/feed" element={<Navigate to="/gettit" replace />} />
                    <Route path="gig-booking" element={<GigBooking />} />
                    <Route path="jam-sessions" element={<JamSessions />} />
                    <Route path="rehearsals" element={<Rehearsals />} />
                    <Route path="open-mic" element={<OpenMicNights />} />
                    <Route path="open-mic/perform/:performanceId" element={<PerformOpenMic />} />
                    <Route path="band-riders" element={<BandRiders />} />
                    <Route path="radio" element={<Navigate to="/media/radio" replace />} />
                    <Route path="radio-stations" element={<Navigate to="/media/radio" replace />} />
                    <Route path="media/radio" element={<RadioBrowser />} />
                    <Route path="radio/:stationId" element={<RadioStationDetail />} />
                    <Route path="music-videos" element={<MusicVideos />} />
                    <Route path="media/tv-shows" element={<TVShowsBrowser />} />
                    <Route path="media/newspapers" element={<NewspapersBrowser />} />
                    <Route path="media/magazines" element={<MagazinesBrowser />} />
                    <Route path="media/podcasts" element={<PodcastsBrowser />} />
                    <Route path="media/films" element={<FilmsBrowser />} />
                    <Route path="media/pr-history" element={<PRSubmissionsHistory />} />
                    
                    <Route path="cities" element={<WorldEnvironment />} />
                    <Route path="cities/:cityId" element={<City />} />
                    <Route path="setlists" element={<SetlistManager />} />
                    <Route path="travel" element={<Travel />} />
                    <Route path="band-vehicles" element={<BandVehicles />} />
                    <Route path="relationships" element={<Relationships />} />
                    <Route path="public-relations" element={<PublicRelations />} />
                    <Route path="pr" element={<PublicRelations />} />
                    <Route path="legacy" element={<Legacy />} />
                    <Route path="version-history" element={<VersionHistory />} />
                    <Route path="venues" element={<VenueManagement />} />
                    {/* <Route path="community/charity" element={<CharityPage />} /> */}
                    <Route path="festivals" element={<FestivalBrowser />} />
                    <Route path="festivals/simulation" element={<FestivalsNew />} />
                    {/* <Route path="awards" element={<Awards />} /> */}
                    <Route path="chemistry" element={<BandChemistry />} />
                    <Route path="bands/finder" element={<BandFinder />} />
                    <Route path="stage-setup" element={<StageSetup />} />
                    <Route path="stage-equipment" element={<StageEquipmentSystem />} />
                    <Route path="band-crew" element={<BandCrewManagement />} />
                    <Route path="finances" element={<Finances />} />
                    <Route path="sponsorships" element={<Sponsorships />} />
                    <Route path="gear" element={<Gear />} />
                    <Route path="education" element={<Education />} />
                    <Route path="songwriting" element={<Songwriting />} />
                    <Route path="song-market" element={<SongMarket />} />
                    <Route path="recording-studio" element={<RecordingStudio />} />
                    <Route path="release-manager" element={<ReleaseManager />} />
                    <Route path="music-hub" element={<MusicHub />} />
                    <Route path="music" element={<MusicHub />} />
                    <Route path="release/:id" element={<ReleaseDetail />} />
                    <Route path="twaater" element={<Twaater />} />
                    <Route path="twaater/notifications" element={<TwaaterNotifications />} />
                    <Route path="twaater/tag/:hashtag" element={<TwaaterHashtagView />} />
                    <Route path="twaater/twaat/:twaatId" element={<TwaaterTwaatView />} />
                    <Route path="twaater/messages" element={<TwaaterMessagesPage />} />
                    <Route path="twaater/:handle" element={<TwaaterProfileView />} />
                    <Route path="events/eurovision" element={<EurovisionPage />} />
                    <Route path="events/narratives/:storyId" element={<NarrativeStoryPage />} />
                    <Route path="employment" element={<Employment />} />
                    <Route path="inventory" element={<InventoryManager />} />
                    <Route path="players/search" element={<PlayerSearch />} />
                    <Route path="player/:playerId" element={<PlayerProfile />} />
                    <Route path="bands/browse" element={<BandBrowser />} />
                    <Route path="bands/search" element={<BandSearch />} />
                    <Route path="band-rankings" element={<BandRankings />} />
                    <Route path="band/:bandId" element={<BandProfile />} />
                    <Route path="merchandise" element={<Merchandise />} />
                    <Route path="avatar-designer" element={<AvatarDesigner />} />
                    <Route path="skin-store" element={<SkinStore />} />
                    <Route path="labels" element={<RecordLabel />} />
                    
                    {/* Redirects */}
                    <Route path="record-label" element={<Navigate to="/labels" replace />} />
                    <Route path="gigs/advanced/:gigId" element={<AdvancedGigSystem />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="admin/players" element={<AdminPlayerManagement />} />
                    <Route path="admin/achievements" element={<AdminAchievements />} />
                    <Route path="admin/analytics" element={<AdminAnalytics />} />
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
                    <Route path="admin/festivals" element={<FestivalsAdminPage />} />
                    <Route path="admin/eurovision" element={<EurovisionAdminPage />} />
                    <Route path="admin/awards" element={<AwardsAdmin />} />
                    <Route path="admin/advisor" element={<AdvisorAdmin />} />
                    <Route path="admin/pr" element={<PublicRelationsAdmin />} />
                    <Route path="admin/underworld" element={<UnderworldAdmin />} />
                    <Route path="admin/stage-equipment" element={<AdminStageEquipmentCatalog />} />
                    {/* <Route path="admin/stage-templates" element={<StageTemplatesAdmin />} /> */}
                    {/* <Route path="admin/3d-gig-viewer" element={<Admin3DGigViewer />} /> */}
                    <Route path="admin/gear-items" element={<GearItemsAdmin />} />
                    <Route path="admin/page-graphics" element={<PageGraphicsAdmin />} />
                    <Route path="admin/crew" element={<AdminCrewCatalog />} />
                    <Route path="admin/producers" element={<AdminProducers />} />
                    <Route path="admin/streaming-platforms" element={<AdminStreamingPlatforms />} />
                    <Route path="admin/marketplace" element={<AdminMarketplace />} />
                    <Route path="admin/twaater-moderation" element={<AdminTwaaterModeration />} />
                    <Route path="admin/cron-monitor" element={<AdminCronMonitor />} />
                    <Route path="admin/offer-automation" element={<AdminOfferAutomation />} />
                    <Route path="admin/release-config" element={<AdminReleaseConfig />} />
                    <Route path="admin/radio-stations" element={<AdminRadioStations />} />
                    <Route path="admin/radio-content" element={<AdminRadioContent />} />
                    <Route path="admin/experience-rewards" element={<AdminExperienceRewards />} />
                    <Route path="admin/youtube-videos" element={<AdminYoutubeVideos />} />
                    
                    <Route path="admin/songwriting" element={<SongwritingAdmin />} />
                    <Route path="admin/ai-song-generation" element={<AISongGeneration />} />
                    <Route path="admin/gigs" element={<GigsAdmin />} />
                    <Route path="admin/charts" element={<ChartsAdmin />} />
                    <Route path="admin/twaater" element={<TwaaterAdmin />} />
                    <Route path="admin/brands" element={<BrandsAdmin />} />

                    <Route path="admin/labels" element={<LabelsAdmin />} />
                    <Route path="admin/bands" element={<BandAdmin />} />
                    <Route path="admin/fame-fans-gifting" element={<FameFansGifting />} />
                    <Route path="admin/releases" element={<ReleasesAdmin />} />
                    <Route path="admin/dashboard" element={<AdminDashboard />} />
                    <Route path="admin/game-balance" element={<GameBalanceAdmin />} />
                    <Route path="admin/tutorials" element={<TutorialsAdmin />} />
                    <Route path="admin/vip" element={<VipManagement />} />
                    <Route path="admin/skin-collections" element={<SkinCollectionsAdmin />} />
                    <Route path="admin/skin-collections/:collectionId/items" element={<CollectionItemsAdmin />} />
                    <Route path="admin/random-events" element={<RandomEventsAdmin />} />
                    <Route path="admin/skill-definitions" element={<SkillDefinitionsAdmin />} />
                    <Route path="admin/stream-multiplier" element={<StreamMultiplier />} />
                    {/* <Route path="admin/stage-templates" element={<StageTemplatesAdmin />} /> */}
                    <Route path="admin/band-avatars" element={<BandAvatarsAdmin />} />
                    <Route path="admin/crowd-behavior" element={<CrowdBehaviorAdmin />} />
                    <Route path="admin/crowd-sounds" element={<CrowdSoundsAdmin />} />
                    <Route path="admin/3d-gig-demo" element={<Admin3DGigDemo />} />
                    <Route path="employment" element={<Employment />} />
                    <Route path="music-videos" element={<MusicVideos />} />
                    <Route path="gig-booking" element={<GigBooking />} />
                    <Route path="jam-sessions" element={<JamSessions />} />
                    <Route path="rehearsals" element={<Rehearsals />} />
                    <Route path="performance/gig/:gigId" element={<PerformGig />} />
                    <Route path="world" element={<WorldEnvironment />} />
                    {/* <Route path="world-map" element={<WorldMap />} /> */}
                    <Route path="inventory" element={<InventoryManager />} />
                    <Route path="gear" element={<MyGear />} />
                    <Route path="gear-shop" element={<MyGear />} />
                    <Route path="merchandise" element={<Merchandise />} />
                    <Route path="statistics" element={<PlayerStatistics />} />
                    <Route path="my-character/edit" element={<MyCharacterEdit />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
                </BrowserRouter>
                    </TooltipProvider>
                  </BandCrewCatalogProvider>
                </StageEquipmentCatalogProvider>
              </RadioProvider>
            </TutorialProvider>
          </NotificationProvider>
        </GameDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
