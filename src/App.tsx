import { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, matchPath, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { GameDataProvider, useGameData } from "./hooks/useGameData";
import { StageEquipmentCatalogProvider } from "./features/stage-equipment/catalog-context";
import { BandCrewCatalogProvider } from "./features/band-crew/catalog-context";
import { NotificationProvider } from "./contexts/NotificationContext";
import { FeedbackProvider } from "./contexts/FeedbackContext";
import { TutorialProvider } from "./contexts/TutorialContext";
import { RadioProvider } from "./components/radio/RMRadioPlayer";
import Auth from "./pages/Auth";
import { lazyWithRetry } from "./utils/lazyWithRetry";
import { FM_MODULES, findModuleForPath } from "./config/fmNavigation";
import { bandHubNavigation, businessHubNavigation, careerHubNavigation, characterHubNavigation, musicHubNavigation, scheduleHubNavigation, socialHubNavigation, worldHubNavigation } from "./config/hubNavigation";
import { isHubNavigationItemActive } from "@/components/hub/HubLayout";
import ErrorBoundary from "@/components/ui/error-boundary";
import { PageLoadingState } from "@/components/ui/page-state";

// Redirect component for removed placeholder pages
const RedirectTo = ({ to }: { to: string }) => {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
};

const PreserveQueryRedirect = ({ to }: { to: string }) => {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
};

const CurrentCityRedirect = () => {
  const { currentCity } = useGameData();
  return <Navigate to={currentCity?.id ? `/cities/${currentCity.id}` : "/cities"} replace />;
};
import WorldPulsePage from "./pages/WorldPulse";
import BandManager from "./pages/BandManager";
const Modeling = lazyWithRetry(() => import("./pages/Modeling"));
import InventoryManager from "./pages/InventoryManager";
import Sponsorships from "./pages/Sponsorships";

const Layout = lazyWithRetry(() => import("./components/Layout"));
const MobileLayout = lazyWithRetry(() => import("./mobile/shell/MobileLayout"));
const MobileHome = lazyWithRetry(() => import("./mobile/pages/MobileHome"));
const MobileCareer = lazyWithRetry(() => import("./mobile/pages/MobileCareerRoutes"));
const MobileSocial = lazyWithRetry(() => import("./mobile/pages/MobileSocial"));
const MobileWorld = lazyWithRetry(() => import("./mobile/pages/MobileWorld"));
const MobileWorldPhase5 = lazyWithRetry(() => import("./mobile/pages/MobileWorldPhase5"));
const MobileMe = lazyWithRetry(() => import("./mobile/pages/MobileMe"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Inbox = lazyWithRetry(() => import("./pages/Inbox"));
const PerformGig = lazyWithRetry(() => import("./pages/PerformGig"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));

const OffersDashboard = lazyWithRetry(() => import("./pages/OffersDashboard"));
const GigBooking = lazyWithRetry(() => import("./pages/GigBooking"));

const Schedule = lazyWithRetry(() => import("./pages/Schedule"));
// Equipment store pages removed - replaced by EnhancedEquipmentStore
const FanManagement = lazyWithRetry(() => import("./pages/FanManagement"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));

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
const SongRankings = lazyWithRetry(() => import("./pages/SongRankings"));
const StageSetup = lazyWithRetry(() => import("./pages/StageSetup"));
const EnhancedBandManager = lazyWithRetry(() => import("./pages/EnhancedBandManager"));
const PublicRelations = lazyWithRetry(() => import("./pages/PublicRelations"));
const PRSubmissionsHistory = lazyWithRetry(() => import("./pages/media/PRSubmissionsHistory"));
const Legacy = lazyWithRetry(() => import("./pages/legacy"));
const AdminPlayerManagement = lazyWithRetry(() => import("./pages/admin/PlayerManagement"));
const AdminPlayerReports = lazyWithRetry(() => import("./pages/admin/PlayerReports"));
const AdminAchievements = lazyWithRetry(() => import("./pages/admin/Achievements"));
const AchievementsProgress = lazyWithRetry(() => import("./pages/AchievementsProgress"));
const AdminAnalytics = lazyWithRetry(() => import("./pages/admin/Analytics"));
const AwardsAdmin = lazyWithRetry(() => import("./pages/admin/AwardsAdmin"));
const FestivalsAdminPage = lazyWithRetry(() => import("./pages/admin/FestivalsAdmin"));
const SystemStatusAdminPage = lazyWithRetry(() => import("./pages/admin/SystemStatus"));
const EurovisionAdminPage = lazyWithRetry(() => import("./pages/admin/EurovisionAdmin"));
const AdvisorAdmin = lazyWithRetry(() => import("./pages/admin/AdvisorAdmin"));
const PublicRelationsAdmin = lazyWithRetry(() => import("./pages/admin/PublicRelationsAdmin"));
const MediaOutletsAdmin = lazyWithRetry(() => import("./pages/admin/MediaOutletsAdmin"));
const UnderworldAdmin = lazyWithRetry(() => import("./pages/admin/UnderworldAdmin"));
const WellnessPage = lazyWithRetry(() => import("./pages/Wellness"));
const CharacterOverview = lazyWithRetry(() => import("./pages/CharacterOverview"));
const EducationBooking = lazyWithRetry(() => import("./pages/booking/EducationBooking"));
const PerformanceBooking = lazyWithRetry(() => import("./pages/booking/PerformanceBooking"));
const WorkBooking = lazyWithRetry(() => import("./pages/booking/WorkBooking"));
const SongwritingBooking = lazyWithRetry(() => import("./pages/booking/SongwritingBooking"));
const City = lazyWithRetry(() => import("./pages/City"));
const CitiesTreasury = lazyWithRetry(() => import("./pages/CitiesTreasury"));
const WorldMap = lazyWithRetry(() => import("./pages/WorldMap"));
const UnderworldNew = lazyWithRetry(() => import("./pages/UnderworldNew"));
const DikCok = lazyWithRetry(() => import("./pages/DikCok"));
// TourManagerNew removed - using TourManager instead
// StreamingNew removed in v1.1.194 — consolidated into StreamingPlatforms
const ChartsPage = lazyWithRetry(() => import("./pages/music/charts"));
// const EurovisionResultsPage = lazyWithRetry(() => import("./pages/EurovisionResults"));
const FestivalsNew = lazyWithRetry(() => import("./pages/FestivalsNew"));
const FestivalBrowser = lazyWithRetry(() => import("./pages/FestivalBrowser"));
const FestivalPerformance = lazyWithRetry(() => import("./pages/FestivalPerformance"));
const FestivalDetail = lazyWithRetry(() => import("./pages/FestivalDetail"));
const FestivalOwnerConsole = lazyWithRetry(() => import("./pages/FestivalOwnerConsole"));
const FestivalMarketplace = lazyWithRetry(() => import("./pages/FestivalMarketplace"));
const FestivalDirectory = lazyWithRetry(() => import("./pages/FestivalDirectory"));
const FestivalBookingCalendar = lazyWithRetry(() => import("./pages/FestivalBookingCalendar"));
const FestivalSessionPage = lazyWithRetry(() => import("./pages/festivals/FestivalSessionPage"));
const FestivalRunWizard = lazyWithRetry(() => import("./pages/FestivalRunWizard"));
const Awards = lazyWithRetry(() => import("./pages/Awards"));
const SetlistManager = lazyWithRetry(() => import("./pages/SetlistManager"));
const EnhancedEquipmentStore = lazyWithRetry(() => import("./pages/EnhancedEquipmentStore"));
const TattooParlour = lazyWithRetry(() => import("./pages/TattooParlour"));
const ProducerCareer = lazyWithRetry(() => import("./pages/ProducerCareer"));
const ClothingDesigner = lazyWithRetry(() => import("./pages/ClothingDesigner"));
const Teaching = lazyWithRetry(() => import("./pages/Teaching"));
const ClothingShop = lazyWithRetry(() => import("./pages/ClothingShop"));
const EnhancedFanManagement = lazyWithRetry(() => import("./pages/EnhancedFanManagement"));
const AdvancedGigSystem = lazyWithRetry(() => import("./pages/AdvancedGigSystem"));
const StageEquipmentSystemPlan = lazyWithRetry(() => import("./pages/StageEquipmentSystemPlan"));
const StageEquipmentSystem = lazyWithRetry(() => import("./pages/StageEquipmentSystem"));
const BandCrewManagement = lazyWithRetry(() => import("./pages/BandCrewManagement"));
const BandRepertoire = lazyWithRetry(() => import("./pages/BandRepertoire"));
const BandManagementPage = lazyWithRetry(() => import("./pages/bands/[bandId]/management"));
const CompetitiveCharts = lazyWithRetry(() => import("./pages/CompetitiveCharts"));
const ChristmasCharts = lazyWithRetry(() => import("./pages/ChristmasCharts"));
const SeasonalEventsCalendar = lazyWithRetry(() => import("./pages/SeasonalEventsCalendar"));
const CountryCharts = lazyWithRetry(() => import("./pages/CountryCharts"));
const TouringSystem = lazyWithRetry(() => import("./pages/TouringSystem"));
const Travel = lazyWithRetry(() => import("./pages/Travel"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const AdminGigViewerDemo = lazyWithRetry(() => import("./pages/admin/GigViewerDemo"));
const Twaater = lazyWithRetry(() => import("./pages/Twaater"));
const TwaaterProfileView = lazyWithRetry(() => import("./pages/TwaaterProfileView"));
const TwaaterHashtagView = lazyWithRetry(() => import("./pages/TwaaterHashtagView"));
const TwaaterMessagesPage = lazyWithRetry(() => import("./pages/TwaaterMessagesPage"));
const TwaaterNotifications = lazyWithRetry(() => import("./pages/TwaaterNotifications"));
const TwaaterTwaatView = lazyWithRetry(() => import("./pages/TwaaterTwaatView"));
const TwaaterAnalytics = lazyWithRetry(() => import("./pages/TwaaterAnalytics"));
const CommunityFeed = lazyWithRetry(() => import("./pages/community/feed"));
const BandRecruitmentDiscovery = lazyWithRetry(() => import("./pages/community/BandRecruitment"));
const BandRecruitmentManagement = lazyWithRetry(() => import("./pages/bands/[bandId]/recruitment"));
const BandGovernanceDashboard = lazyWithRetry(() => import("./pages/bands/[bandId]/governance"));
const BandAgreementsDashboard = lazyWithRetry(() => import("./pages/bands/[bandId]/agreements"));
const NewBandAgreementPage = lazyWithRetry(() => import("./pages/bands/[bandId]/agreements/new"));
const BandLeavePage = lazyWithRetry(() => import("./pages/bands/[bandId]/leave"));
const CharacterAgreementsPage = lazyWithRetry(() => import("./pages/character/agreements"));
const NewBandProposalPage = lazyWithRetry(() => import("./pages/bands/[bandId]/governance/new"));
const BandProposalDetailPage = lazyWithRetry(() => import("./pages/bands/[bandId]/governance/detail"));
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
const NightClubDetail = lazyWithRetry(() => import("./pages/NightClubDetail"));
const NightclubHub = lazyWithRetry(() => import("./pages/NightclubHub"));
const NightclubManagement = lazyWithRetry(() => import("./pages/NightclubManagement"));
const CraftingWorkshop = lazyWithRetry(() => import("./pages/CraftingWorkshop"));
const HallOfImmortals = lazyWithRetry(() => import("./pages/HallOfImmortals"));
const BuyCharacterSlot = lazyWithRetry(() => import("./pages/BuyCharacterSlot"));
const Characters = lazyWithRetry(() => import("./pages/Characters"));
const SlotPurchaseSuccess = lazyWithRetry(() => import("./pages/SlotPurchaseSuccess"));
const CreateCharacter = lazyWithRetry(() => import("./pages/CreateCharacter"));
const AdminYoutubeVideos = lazyWithRetry(() => import("./pages/admin/YoutubeVideos"));
const MyCompanies = lazyWithRetry(() => import("./pages/MyCompanies"));
const WorldCompanies = lazyWithRetry(() => import("./pages/WorldCompanies"));
const CompanyDetail = lazyWithRetry(() => import("./pages/CompanyDetail"));
const SecurityFirmManagement = lazyWithRetry(() => import("./pages/SecurityFirmManagement"));
const MerchFactoryManagement = lazyWithRetry(() => import("./pages/MerchFactoryManagement"));
const LogisticsCompanyManagement = lazyWithRetry(() => import("./pages/LogisticsCompanyManagement"));
const VenueBusinessManagement = lazyWithRetry(() => import("./pages/VenueBusinessManagement"));
const RehearsalStudioBusinessManagement = lazyWithRetry(() => import("./pages/RehearsalStudioBusinessManagement"));
const RecordingStudioBusinessManagement = lazyWithRetry(() => import("./pages/RecordingStudioBusinessManagement"));
const LabelManagement = lazyWithRetry(() => import("./pages/LabelManagement"));
const CompanyAdmin = lazyWithRetry(() => import("./pages/admin/CompanyAdmin"));
const SecurityFirmsAdmin = lazyWithRetry(() => import("./pages/admin/SecurityFirmsAdmin"));
const MerchFactoriesAdmin = lazyWithRetry(() => import("./pages/admin/MerchFactoriesAdmin"));
const LogisticsCompaniesAdmin = lazyWithRetry(() => import("./pages/admin/LogisticsCompaniesAdmin"));
const AdminReleasePump = lazyWithRetry(() => import("./pages/admin/ReleasePump"));
const PlayerSurveyAdmin = lazyWithRetry(() => import("./pages/admin/PlayerSurveyAdmin"));

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
const AdminWorldReset = lazyWithRetry(() => import("./pages/admin/WorldReset"));
const AdminDebugPanel = lazyWithRetry(() => import("./pages/admin/DebugPanel"));
const AdminDeathSystem = lazyWithRetry(() => import("./pages/admin/DeathSystemAdmin"));
const AdminOfferAutomation = lazyWithRetry(() => import("./pages/admin/OfferAutomation"));
const AdminReleaseConfig = lazyWithRetry(() => import("./pages/admin/ReleaseConfig"));
const AdminRadioStations = lazyWithRetry(() => import("./pages/admin/RadioStations"));
const AdminRadioContent = lazyWithRetry(() => import("./pages/admin/RadioContent"));
const AdminStageEquipmentCatalog = lazyWithRetry(() => import("./pages/admin/StageEquipmentCatalog"));
const AdminCrewCatalog = lazyWithRetry(() => import("./pages/admin/CrewCatalog"));
const GearItemsAdmin = lazyWithRetry(() => import("./pages/admin/GearItemsAdmin"));
const PageGraphicsAdmin = lazyWithRetry(() => import("./pages/admin/PageGraphicsAdmin"));
const StageTemplatesAdmin = lazyWithRetry(() => import("./pages/admin/StageTemplatesAdmin"));
const BandAvatarsAdmin = lazyWithRetry(() => import("./pages/admin/BandAvatarsAdmin"));
const CrowdBehaviorAdmin = lazyWithRetry(() => import("./pages/admin/CrowdBehaviorAdmin"));
const CrowdSoundsAdmin = lazyWithRetry(() => import("./pages/admin/CrowdSoundsAdmin"));
const POVClipAdmin = lazyWithRetry(() => import("./pages/admin/POVClipAdmin"));
const SkillDefinitionsAdmin = lazyWithRetry(() => import("./pages/admin/SkillDefinitions"));
const PlayerSearch = lazyWithRetry(() => import("./pages/PlayerSearch"));
const PlayerDiscovery = lazyWithRetry(() => import("./pages/PlayerDiscovery"));
const PlayersBrowser = lazyWithRetry(() => import("./pages/PlayersBrowser"));
const FriendsPage = lazyWithRetry(() => import("./pages/Friends"));
const BlockedPlayersPage = lazyWithRetry(() => import("./pages/settings/BlockedPlayers"));
const MyReportsPage = lazyWithRetry(() => import("./pages/settings/MyReports"));
const PlayerProfile = lazyWithRetry(() => import("./pages/PlayerProfile"));
const PlayerProfileEdit = lazyWithRetry(() => import("./pages/PlayerProfileEdit"));
const BandBrowser = lazyWithRetry(() => import("./pages/BandBrowser"));
const BandProfile = lazyWithRetry(() => import("./pages/BandProfile"));
const BandSearch = lazyWithRetry(() => import("./pages/BandSearch"));
const BandFinder = lazyWithRetry(() => import("./pages/BandFinder"));
const BandRankings = lazyWithRetry(() => import("./pages/BandRankings"));
const BandFameMap = lazyWithRetry(() => import("./pages/BandFameMap"));
const StagePractice = lazyWithRetry(() => import("./pages/StagePractice"));
const SongwritingAdmin = lazyWithRetry(() => import("./pages/admin/SongwritingAdmin"));
const GigsAdmin = lazyWithRetry(() => import("./pages/admin/GigsAdmin"));

const ChartsAdmin = lazyWithRetry(() => import("./pages/admin/ChartsAdmin"));
const TwaaterAdmin = lazyWithRetry(() => import("./pages/admin/TwaaterAdmin"));
const LabelsAdmin = lazyWithRetry(() => import("./pages/admin/LabelsAdmin"));
const BandAdmin = lazyWithRetry(() => import("./pages/admin/BandAdmin"));
const ReleasesAdmin = lazyWithRetry(() => import("./pages/admin/ReleasesAdmin"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminUserRolesPage = lazyWithRetry(() => import("./pages/admin/AdminUserRoles"));
const GameBalanceAdmin = lazyWithRetry(() => import("./pages/admin/GameBalanceAdmin"));
const TutorialsAdmin = lazyWithRetry(() => import("./pages/admin/TutorialsAdmin"));
const VipManagement = lazyWithRetry(() => import("./pages/admin/VipManagement"));
const SkinCollectionsAdmin = lazyWithRetry(() => import("./pages/admin/SkinCollectionsAdmin"));
const AISongGeneration = lazyWithRetry(() => import("./pages/admin/AISongGeneration"));
const MusicVideosAdmin = lazyWithRetry(() => import("./pages/admin/MusicVideosAdmin"));
const RandomEventsAdmin = lazyWithRetry(() => import("./pages/admin/RandomEventsAdmin"));
const CollectionItemsAdmin = lazyWithRetry(() => import("./pages/admin/CollectionItemsAdmin"));
const FameFansGifting = lazyWithRetry(() => import("./pages/admin/FameFansGifting"));
const FameFansAttribution = lazyWithRetry(() => import("./pages/admin/FameFansAttribution"));
const StreamMultiplier = lazyWithRetry(() => import("./pages/admin/StreamMultiplier"));
const SalesBalanceAdmin = lazyWithRetry(() => import("./pages/admin/SalesBalanceAdmin"));
const CityGovernanceAdmin = lazyWithRetry(() => import("./pages/admin/CityGovernanceAdmin"));
const CityTreasuryAdmin = lazyWithRetry(() => import("./pages/admin/CityTreasuryAdmin"));
const CityTreasuryDetail = lazyWithRetry(() => import("./pages/admin/CityTreasuryDetail"));
const PracticeTracksAdmin = lazyWithRetry(() => import("./pages/admin/PracticeTracksAdmin"));
const About = lazyWithRetry(() => import("./pages/About"));
const WorldEnvironment = lazyWithRetry(() => import("./pages/WorldEnvironment"));
const Employment = lazyWithRetry(() => import("./pages/Employment"));
const RadioBrowser = lazyWithRetry(() => import("./pages/media/RadioBrowser"));
const MusicVideos = lazyWithRetry(() => import("./pages/MusicVideos"));
const RadioStationDetail = lazyWithRetry(() => import("./pages/RadioStationDetail"));
const TVShowsBrowser = lazyWithRetry(() => import("./pages/media/TVShowsBrowser"));
const NewspapersBrowser = lazyWithRetry(() => import("./pages/media/NewspapersBrowser"));
const NewspaperDetail = lazyWithRetry(() => import("./pages/media/NewspaperDetail"));
const MagazinesBrowser = lazyWithRetry(() => import("./pages/media/MagazinesBrowser"));
const MagazineDetail = lazyWithRetry(() => import("./pages/media/MagazineDetail"));
const PodcastsBrowser = lazyWithRetry(() => import("./pages/media/PodcastsBrowser"));
const PodcastDetail = lazyWithRetry(() => import("./pages/media/PodcastDetail"));
const FilmsBrowser = lazyWithRetry(() => import("./pages/media/FilmsBrowser"));
const FilmDetail = lazyWithRetry(() => import("./pages/media/FilmDetail"));
const ActingCareer = lazyWithRetry(() => import("./pages/ActingCareer"));
const WebsitesBrowser = lazyWithRetry(() => import("./pages/media/WebsitesBrowser"));
const SelfPromotionBrowser = lazyWithRetry(() => import("./pages/media/SelfPromotionBrowser"));
const SongManager = lazyWithRetry(() => import("./pages/SongManager"));
const PlayerStatistics = lazyWithRetry(() => import("./pages/PlayerStatistics"));
const ProgressionPanel = lazyWithRetry(() => import("./pages/ProgressionPanel"));
const GearHistoryPublic = lazyWithRetry(() => import("./pages/GearHistoryPublic"));
const OverviewPage = lazyWithRetry(() => import("./pages/Overview"));
const Busking = lazyWithRetry(() => import("./pages/Busking"));
const JamSessions = lazyWithRetry(() => import("./components/jam-sessions/JamSessionsEnhanced"));
const Rehearsals = lazyWithRetry(() => import("./pages/Rehearsals"));
const OpenMicNights = lazyWithRetry(() => import("./pages/OpenMicNights"));
const PerformOpenMic = lazyWithRetry(() => import("./pages/PerformOpenMic"));
const MajorEvents = lazyWithRetry(() => import("./pages/MajorEvents"));
const PerformMajorEvent = lazyWithRetry(() => import("./pages/PerformMajorEvent"));
const Education = lazyWithRetry(() => import("./pages/Education"));
const RecordingStudio = lazyWithRetry(() => import("./pages/RecordingStudio"));
const ReleaseManager = lazyWithRetry(() => import("./pages/ReleaseManager"));
const ReleaseDetail = lazyWithRetry(() => import("./pages/ReleaseDetail"));
const MediaNetworks = lazyWithRetry(() => import("./pages/MediaNetworks"));
// const CharityPage = lazyWithRetry(() => import("./pages/community/charity"));

const Underworld = lazyWithRetry(() => import("./pages/UnderworldNew"));
const NarrativeStoryPage = lazyWithRetry(
  () => import("./pages/events/narratives/[storyId]"),
);
const EurovisionPage = lazyWithRetry(() => import("./pages/Eurovision"));
const Finances = lazyWithRetry(() => import("./pages/Finances"));
const Banking = lazyWithRetry(() => import("./pages/Banking"));
const BankingApply = lazyWithRetry(() => import("./pages/BankingApply"));
const BankingLoanDetail = lazyWithRetry(() => import("./pages/BankingLoanDetail"));
const Merchandise = lazyWithRetry(() => import("./pages/Merchandise"));
const MyCharacterEdit = lazyWithRetry(() => import("./pages/MyCharacterEdit"));
const TodaysNewsPage = lazyWithRetry(() => import("./pages/TodaysNews"));
const Gear = lazyWithRetry(() => import("./pages/Gear"));
const AvatarDesigner = lazyWithRetry(() => import("./pages/AvatarDesigner"));
const BandRiders = lazyWithRetry(() => import("./pages/BandRiders"));
const BandVehicles = lazyWithRetry(() => import("./pages/BandVehicles"));
const SkinStore = lazyWithRetry(() => import("./pages/SkinStore"));
const PublicSong = lazyWithRetry(() => import("./pages/PublicSong"));
const Prison = lazyWithRetry(() => import("./pages/Prison"));
const MusicStudio = lazyWithRetry(() => import("./pages/MusicStudio"));
const SkillsPage = lazyWithRetry(() => import("./pages/SkillsPage"));
const Jobs = lazyWithRetry(() => import("./pages/Jobs"));
const VersionHistory = lazyWithRetry(() => import("./pages/VersionHistory"));
const Journal = lazyWithRetry(() => import("./pages/Journal"));
const VipSubscribe = lazyWithRetry(() => import("./pages/VipSubscribe"));
const DonationSuccess = lazyWithRetry(() => import("./pages/DonationSuccess"));
const VipSuccess = lazyWithRetry(() => import("./pages/VipSuccess"));
const CityElection = lazyWithRetry(() => import("./pages/CityElection"));
const MayorDashboard = lazyWithRetry(() => import("./pages/MayorDashboard"));
const WorldParliament = lazyWithRetry(() => import("./pages/WorldParliament"));
const PoliticalParty = lazyWithRetry(() => import("./pages/PoliticalParty"));
const PoliticsCareer = lazyWithRetry(() => import("./pages/PoliticsCareer"));
const PartyStandings = lazyWithRetry(() => import("./pages/PartyStandings"));
const Lottery = lazyWithRetry(() => import("./pages/Lottery"));
const Housing = lazyWithRetry(() => import("./pages/Housing"));
const PersonalVehicles = lazyWithRetry(() => import("./pages/PersonalVehicles"));
const CasinoLobby = lazyWithRetry(() => import("./pages/Casino"));
const CasinoBlackjack = lazyWithRetry(() => import("./pages/casino/Blackjack"));
const CasinoRoulette = lazyWithRetry(() => import("./pages/casino/Roulette"));
const CasinoSlots = lazyWithRetry(() => import("./pages/casino/Slots"));
const CharacterHub = lazyWithRetry(() => import("./pages/hubs/CharacterHub"));
const MusicOverview = lazyWithRetry(() => import("./pages/hubs/MusicOverview"));
const BandLiveHub = lazyWithRetry(() => import("./pages/hubs/BandLiveHub"));
const WorldHub = lazyWithRetry(() => import("./pages/hubs/WorldHub"));
const WorldOverview = lazyWithRetry(() => import("./pages/hubs/WorldOverview"));
const SocialHubLanding = lazyWithRetry(() => import("./pages/hubs/SocialHub"));
const MediaHub = lazyWithRetry(() => import("./pages/hubs/MediaHub"));
const SocialHubUnified = lazyWithRetry(() => import("./pages/SocialHub"));
const SocialActivities = lazyWithRetry(() => import("./pages/SocialActivities"));
const NewSocialActivity = lazyWithRetry(() => import("./pages/NewSocialActivity"));
const SocialActivityDetail = lazyWithRetry(() => import("./pages/SocialActivityDetail"));
const CityLandmarks = lazyWithRetry(() => import("./pages/CityLandmarks"));
const CareerBusinessHub = lazyWithRetry(() => import("./pages/hubs/CareerBusinessHub"));
const BusinessOverview = lazyWithRetry(() => import("./pages/BusinessOverview"));
const CareerOverviewPage = lazyWithRetry(() => import("./pages/CareerOverview"));
const PremiumStoreHub = lazyWithRetry(() => import("./pages/hubs/PremiumStoreHub"));
const BlindBoxStore = lazyWithRetry(() => import("./pages/BlindBoxStore"));
const BlindBoxAnalytics = lazyWithRetry(() => import("./pages/BlindBoxAnalytics"));
const StreamingRevenueDashboard = lazyWithRetry(() => import("./pages/StreamingRevenueDashboard"));
const BlindBoxInventory = lazyWithRetry(() => import("./pages/BlindBoxInventory"));
const ChildDetail = lazyWithRetry(() => import("./pages/family/ChildDetail"));
const FamilyTimeline = lazyWithRetry(() => import("./pages/family/FamilyTimeline"));
const queryClient = new QueryClient();

const ROUTE_TITLES = new Map<string, string>([
  ["/", "Welcome"],
  ["/auth", "Sign In"],
  ["/about", "About"],
  ["/song/:songId", "Song"],
  ["/bands/:bandId/management", "Band Management"],
  ["/bands/:bandId/manage/roles", "Band Roles"],
  ["/gigs/perform/:gigId", "Perform Gig"],
  ["/streaming/:platformId", "Streaming Platform"],
  ["/cities/:cityId", "City"],
  ["/cities/:cityId/election", "City Election"],
  ["/cities/:cityId/mayor-dashboard", "Mayor Dashboard"],
  ["/release/:id", "Release"],
  ["/events/narratives/:storyId", "Narrative Event"],
  ["/player/:playerId", "Player Profile"],
  ["/band/:bandId", "Band Profile"],
  ["/labels/:labelId/manage", "Label Management"],
  ["/company/:companyId", "Company"],
  ["/security-firm/:companyId", "Security Firm"],
  ["/merch-factory/:companyId", "Merch Factory"],
  ["/logistics-company/:companyId", "Logistics Company"],
  ["/venue-business/:venueId", "Venue Business"],
  ["/rehearsal-studio-business/:studioId", "Rehearsal Studio Business"],
  ["/recording-studio-business/:studioId", "Recording Studio Business"],
  ["/family/child/:childId", "Child Detail"],
]);

for (const module of FM_MODULES) {
  for (const link of [
    ...module.subTabs,
    ...module.sidebar.flatMap((section) => section.items),
    ...(module.quickActions ?? []),
  ]) {
    ROUTE_TITLES.set(link.path.split("?")[0], link.label);
  }
}

const HUB_TITLE_CONFIGS = [
  { title: "Character", overviewPath: "/character", items: characterHubNavigation },
  { title: "Music", overviewPath: "/music", items: musicHubNavigation },
  { title: "Band", overviewPath: "/band", items: bandHubNavigation },
  { title: "Schedule", overviewPath: "/schedule", items: scheduleHubNavigation },
  { title: "World", overviewPath: "/world", items: worldHubNavigation },
  { title: "Business", overviewPath: "/business", items: businessHubNavigation },
  { title: "Career", overviewPath: "/career", items: careerHubNavigation },
  { title: "Social", overviewPath: "/social", items: socialHubNavigation },
];

const getRouteTitle = (locationPath: string) => {
  const [pathname] = locationPath.split("?");
  for (const hub of HUB_TITLE_CONFIGS) {
    const activeItem = hub.items.find((item) => isHubNavigationItemActive(locationPath, item));
    if (activeItem) {
      return activeItem.path === hub.overviewPath ? hub.title : `${activeItem.label} | ${hub.title}`;
    }
  }

  const exactTitle = ROUTE_TITLES.get(pathname);
  if (exactTitle) return exactTitle;

  for (const [route, title] of ROUTE_TITLES) {
    if (matchPath({ path: route, end: true }, pathname)) {
      const mod = findModuleForPath(pathname);
      return mod.id !== "overview" && title !== mod.label ? `${title} | ${mod.label}` : title;
    }
  }

  return "Rockmundo";
};

const PageTitle = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const title = getRouteTitle(`${pathname}${search}`);
    document.title = title === "Rockmundo" ? title : `${title} | Rockmundo`;
  }, [pathname, search]);

  return null;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GameDataProvider>
          <NotificationProvider>
            <FeedbackProvider>
            <TutorialProvider>
              <RadioProvider>
                <StageEquipmentCatalogProvider>
                  <BandCrewCatalogProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <PageTitle />
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div className="min-h-screen w-full bg-background p-4 md:p-8">
                      <div className="mx-auto max-w-6xl">
                        <PageLoadingState
                          title="Loading page"
                          description="Tuning the amps and loading the latest Rockmundo data..."
                        />
                      </div>
                    </div>
                  }
                >
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/song/:songId" element={<PublicSong />} />
                  <Route path="/mobile" element={<MobileLayout />}>
                    <Route index element={<MobileHome />} />
                    <Route path="career" element={<MobileCareer />} />
                    <Route path="career/:section" element={<MobileCareer />} />
                    <Route path="career/:section/:id" element={<MobileCareer />} />
                    <Route path="social" element={<MobileSocial />} />
                    <Route path="social/:section" element={<MobileSocial />} />
                    <Route path="social/:section/:id" element={<MobileSocial />} />
                    <Route path="world" element={<MobileWorldPhase5 />} />
                    <Route path="world/:section" element={<MobileWorldPhase5 />} />
                    <Route path="world/:section/:id" element={<MobileWorldPhase5 />} />
                    <Route path="me" element={<MobileMe />} />
                    <Route path="me/:section" element={<MobileMe />} />
                    <Route path="me/:section/:id" element={<MobileMe />} />
                  </Route>
                  <Route element={<Layout />}>
                    <Route path="home" element={<Dashboard />} />
                    <Route path="inbox" element={<Inbox />} />


                    <Route path="todays-news" element={<TodaysNewsPage />} />
                    <Route path="character" element={<CharacterOverview />} />
                    <Route path="character/overview" element={<PreserveQueryRedirect to="/character" />} />
                    <Route path="character/profile/edit" element={<PlayerProfileEdit />} />
                    <Route path="character/agreements" element={<CharacterAgreementsPage />} />
                    <Route path="character/wellness" element={<PreserveQueryRedirect to="/wellness" />} />
                    <Route path="character/skills" element={<PreserveQueryRedirect to="/skills" />} />
                    <Route path="character/inventory" element={<PreserveQueryRedirect to="/inventory" />} />
                    <Route path="character/wardrobe" element={<PreserveQueryRedirect to="/clothing-shop" />} />
                    <Route path="wellness" element={<WellnessPage />} />
                    <Route path="underworld" element={<UnderworldNew />} />
                    <Route path="dikcok" element={<DikCok />} />
                    <Route path="tour-manager" element={<TourManager />} />
                    <Route path="streaming" element={<Navigate to="/streaming-platforms" replace />} />
                    <Route path="streaming/dashboard" element={<StreamingRevenueDashboard />} />
                    <Route path="music/charts" element={<ChartsPage />} />
                    <Route path="christmas-charts" element={<ChristmasCharts />} />
                    <Route path="seasonal-events" element={<SeasonalEventsCalendar />} />
                    {/* <Route path="eurovision" element={<EurovisionResultsPage />} /> */}
                    <Route path="dashboard" element={<PreserveQueryRedirect to="/home" />} />
                    
                    <Route path="offers-dashboard" element={<OffersDashboard />} />
                    <Route path="vip-subscribe" element={<VipSubscribe />} />
                    <Route path="vip-success" element={<VipSuccess />} />
                    <Route path="premium-store" element={<PremiumStoreHub />} />
                    <Route path="blind-boxes" element={<BlindBoxStore />} />
                    <Route path="blind-boxes/analytics" element={<BlindBoxAnalytics />} />
                    <Route path="blind-boxes/inventory" element={<BlindBoxInventory />} />
                    <Route path="family/child/:childId" element={<ChildDetail />} />
                    <Route path="family/timeline" element={<FamilyTimeline />} />
                    <Route path="buy-character-slot" element={<BuyCharacterSlot />} />
                    <Route path="characters" element={<Characters />} />
                    <Route path="characters/new" element={<CreateCharacter />} />
                    <Route path="slot-purchase-success" element={<SlotPurchaseSuccess />} />
                    <Route path="onboarding" element={<Onboarding />} />
                    <Route path="band" element={<BandManager />} />
                    <Route path="band/overview" element={<PreserveQueryRedirect to="/band" />} />
                    <Route path="band/members" element={<BandManager />} />
                    <Route path="band/fame" element={<BandManager />} />
                    <Route path="band/repertoire" element={<BandManager />} />
                    <Route path="band/history" element={<BandManager />} />
                    <Route path="band/finances" element={<BandManager />} />
                    <Route path="band/chemistry" element={<BandManager />} />
                    <Route path="band/settings" element={<BandManager />} />
                    <Route path="band/rehearsals" element={<PreserveQueryRedirect to="/rehearsals" />} />
                    <Route path="band/setlists" element={<PreserveQueryRedirect to="/setlists" />} />
                    <Route path="band/gigs" element={<PreserveQueryRedirect to="/gigs" />} />
                    <Route path="band/tours" element={<PreserveQueryRedirect to="/tour-manager" />} />
                    <Route path="band/equipment" element={<PreserveQueryRedirect to="/band-crew" />} />
                    <Route path="bands/:bandId/management" element={<BandManagementPage />} />
                    <Route path="bands/:bandId/chemistry" element={<BandChemistry />} />
                    <Route path="bands/:bandId/manage/roles" element={<BandManagementPage />} />
                    <Route path="bands/:bandId/recruitment" element={<BandRecruitmentManagement />} />
                    <Route path="bands/:bandId/recruitment/new" element={<BandRecruitmentManagement />} />
                    <Route path="bands/:bandId/governance" element={<BandGovernanceDashboard />} />
                    <Route path="bands/:bandId/agreements" element={<BandAgreementsDashboard />} />
                    <Route path="bands/:bandId/agreements/new" element={<NewBandAgreementPage />} />
                    <Route path="bands/:bandId/leave" element={<BandLeavePage />} />
                    <Route path="bands/:bandId/governance/proposals/new" element={<NewBandProposalPage />} />
                    <Route path="bands/:bandId/governance/proposals/:proposalId" element={<BandProposalDetailPage />} />
                    <Route path="gigs" element={<GigBooking />} />
                    <Route path="jams" element={<JamSessions />} />
                    <Route path="gigs/perform/:gigId" element={<PerformGig />} />
                    <Route path="busking" element={<Busking />} />
                    
                    <Route path="song-manager" element={<SongManager />} />
                    <Route path="music/overview" element={<PreserveQueryRedirect to="/music" />} />
                    <Route path="music/songs" element={<PreserveQueryRedirect to="/song-manager" />} />
                    <Route path="music/songwriting" element={<PreserveQueryRedirect to="/songwriting" />} />
                    <Route path="music/practice" element={<PreserveQueryRedirect to="/stage-practice" />} />
                    <Route path="music/rehearsals" element={<PreserveQueryRedirect to="/rehearsals" />} />
                    <Route path="music/jam-sessions" element={<PreserveQueryRedirect to="/jam-sessions" />} />
                    <Route path="music/recording" element={<PreserveQueryRedirect to="/recording-studio" />} />
                    <Route path="music/releases" element={<PreserveQueryRedirect to="/release-manager" />} />
                    <Route path="music/setlists" element={<PreserveQueryRedirect to="/setlists" />} />
                    <Route path="streaming-platforms" element={<StreamingPlatforms />} />
                    <Route path="streaming/:platformId" element={<StreamingPlatformDetail />} />
                    <Route path="advisor" element={<AdvisorPage />} />
                    <Route path="competitive-charts" element={<CompetitiveCharts />} />
                    <Route path="country-charts" element={<CountryCharts />} />
                    <Route path="schedule" element={<Schedule />} />
                    <Route path="schedule/overview" element={<PreserveQueryRedirect to="/schedule" />} />
                    <Route path="schedule/today" element={<Schedule />} />
                    <Route path="schedule/week" element={<Schedule />} />
                    <Route path="schedule/calendar" element={<Schedule />} />
                    <Route path="schedule/current" element={<Schedule />} />
                    <Route path="schedule/book" element={<Schedule />} />
                    <Route path="schedule/upcoming" element={<Schedule />} />
                    <Route path="schedule/history" element={<Schedule />} />
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
                    <Route path="major-events" element={<MajorEvents />} />
                    <Route path="major-events/perform/:performanceId" element={<PerformMajorEvent />} />
                    <Route path="band-riders" element={<BandRiders />} />
                    <Route path="radio" element={<Navigate to="/media/radio" replace />} />
                    <Route path="radio-stations" element={<Navigate to="/media/radio" replace />} />
                    <Route path="media/radio" element={<RadioBrowser />} />
                    <Route path="radio/:stationId" element={<RadioStationDetail />} />
                    <Route path="music-videos" element={<MusicVideos />} />
                    <Route path="media/tv-shows" element={<TVShowsBrowser />} />
                    <Route path="media/newspapers" element={<NewspapersBrowser />} />
                    <Route path="media/newspapers/:id" element={<NewspaperDetail />} />
                    <Route path="media/magazines" element={<MagazinesBrowser />} />
                    <Route path="media/magazines/:id" element={<MagazineDetail />} />
                    <Route path="media/podcasts" element={<PodcastsBrowser />} />
                    <Route path="media/podcasts/:id" element={<PodcastDetail />} />
                    <Route path="media/films" element={<FilmsBrowser />} />
                    <Route path="media/films/:id" element={<FilmDetail />} />
                    <Route path="acting" element={<ActingCareer />} />
                    <Route path="media/acting" element={<ActingCareer />} />
                    <Route path="media/websites" element={<WebsitesBrowser />} />
                    <Route path="media/self-promotion" element={<SelfPromotionBrowser />} />
                    <Route path="media/pr-history" element={<PRSubmissionsHistory />} />
                    
                    <Route path="world" element={<WorldOverview />} />
                    <Route path="world/overview" element={<PreserveQueryRedirect to="/world" />} />
                    <Route path="world/current-city" element={<CurrentCityRedirect />} />
                    <Route path="world/travel" element={<PreserveQueryRedirect to="/travel" />} />
                    <Route path="world/cities" element={<PreserveQueryRedirect to="/cities" />} />
                    <Route path="world/cities/:cityId" element={<City />} />
                    <Route path="world/treasuries" element={<PreserveQueryRedirect to="/cities/treasury" />} />
                    <Route path="world/venues" element={<PreserveQueryRedirect to="/venues" />} />
                    <Route path="world/studios" element={<PreserveQueryRedirect to="/recording-studio" />} />
                    <Route path="world/companies" element={<PreserveQueryRedirect to="/world-companies" />} />
                    <Route path="world/events" element={<PreserveQueryRedirect to="/major-events" />} />
                    <Route path="world/festivals" element={<PreserveQueryRedirect to="/festivals" />} />
                    <Route path="world/festivals/:festivalId" element={<FestivalDetail />} />
                    <Route path="world/pulse" element={<PreserveQueryRedirect to="/world-pulse" />} />
                    <Route path="world/leaderboards" element={<PreserveQueryRedirect to="/band-rankings" />} />
                    <Route path="cities" element={<WorldEnvironment />} />
                    <Route path="cities/treasury" element={<CitiesTreasury />} />
                    <Route path="cities/:cityId" element={<City />} />
                    <Route path="cities/:cityId/election" element={<CityElection />} />
                    <Route path="cities/:cityId/mayor-dashboard" element={<MayorDashboard />} />
                    <Route path="world-parliament" element={<WorldParliament />} />
                    <Route path="political-party" element={<PoliticalParty />} />
                    <Route path="political-party/standings" element={<PartyStandings />} />
                    <Route path="politics-career" element={<PoliticsCareer />} />
                    <Route path="setlists" element={<SetlistManager />} />
                    <Route path="travel" element={<Travel />} />
                    <Route path="band-vehicles" element={<BandVehicles />} />
                    <Route path="relationships" element={<PreserveQueryRedirect to="/social/friends" />} />
                    <Route path="public-relations" element={<PublicRelations />} />
                    <Route path="pr" element={<PublicRelations />} />
                    <Route path="legacy" element={<Legacy />} />
                    <Route path="journal" element={<Journal />} />
                    <Route path="version-history" element={<VersionHistory />} />
                    <Route path="donation-success" element={<DonationSuccess />} />
                    <Route path="business" element={<BusinessOverview />} />
                    <Route path="business/overview" element={<PreserveQueryRedirect to="/business" />} />
                    <Route path="business/companies" element={<MyCompanies />} />
                    <Route path="business/staff" element={<PreserveQueryRedirect to="/business/companies" />} />
                    <Route path="business/recruitment" element={<Navigate to="/employment?tab=applications" replace />} />
                    <Route path="business/job-adverts" element={<Navigate to="/employment?tab=applications" replace />} />
                    <Route path="business/finances" element={<Navigate to="/my-companies?tab=finances" replace />} />
                    <Route path="business/advertising" element={<PreserveQueryRedirect to="/pr" />} />
                    <Route path="business/labels" element={<PreserveQueryRedirect to="/labels" />} />
                    <Route path="business/reports" element={<Navigate to="/my-companies?tab=reports" replace />} />
                    <Route path="career" element={<CareerOverviewPage />} />
                    <Route path="career/overview" element={<PreserveQueryRedirect to="/career" />} />
                    <Route path="career/employment" element={<Employment />} />
                    <Route path="career/finances" element={<PreserveQueryRedirect to="/finances" />} />
                    <Route path="career/fame" element={<PreserveQueryRedirect to="/statistics" />} />
                    <Route path="career/charts" element={<PreserveQueryRedirect to="/competitive-charts" />} />
                    <Route path="career/awards" element={<Awards />} />
                    <Route path="career/achievements" element={<AchievementsProgress />} />
                    <Route path="achievements" element={<AchievementsProgress />} />
                    <Route path="career/discography" element={<PreserveQueryRedirect to="/release-manager" />} />
                    <Route path="career/history" element={<PreserveQueryRedirect to="/legacy" />} />
                    <Route path="my-companies" element={<MyCompanies />} />
                    <Route path="venues" element={<VenueManagement />} />
                    {/* <Route path="community/charity" element={<CharityPage />} /> */}
                    <Route path="festivals" element={<FestivalBrowser />} />
                    <Route path="festivals/marketplace" element={<FestivalMarketplace />} />
                    <Route path="festivals/directory" element={<FestivalDirectory />} />
                    <Route path="festivals/:festivalId" element={<FestivalDetail />} />
                    <Route path="festivals/simulation" element={<FestivalsNew />} />
                    <Route path="festivals/perform/:participationId" element={<FestivalPerformance />} />
                    <Route path="festivals/:festivalId/manage" element={<FestivalOwnerConsole />} />
                    <Route path="festivals/:festivalId/manage/editions/:editionId" element={<FestivalOwnerConsole />} />
                    <Route path="festivals/sessions/:sessionId" element={<FestivalSessionPage />} />
                    <Route path="festivals/:festivalId/calendar" element={<FestivalBookingCalendar />} />
                    <Route path="festivals/:festivalId/run" element={<FestivalRunWizard />} />
                    <Route path="awards" element={<Awards />} />
                    <Route path="chemistry" element={<BandChemistry />} />
                    <Route path="bands/finder" element={<BandFinder />} />
                    <Route path="stage-setup" element={<StageSetup />} />
                    <Route path="stage-equipment" element={<StageEquipmentSystem />} />
                    <Route path="band-crew" element={<BandCrewManagement />} />
                    <Route path="finances" element={<Finances />} />
                    <Route path="finance/banking" element={<Banking />} />
                    <Route path="finance/banking/apply" element={<BankingApply />} />
                    <Route path="finance/banking/loans/:loanId" element={<BankingLoanDetail />} />
                    <Route path="sponsorships" element={<Sponsorships />} />
                    <Route path="gear" element={<Gear />} />
                    <Route path="education" element={<Education />} />
                    <Route path="teaching" element={<Teaching />} />
                    <Route path="songwriting" element={<Songwriting />} />
                    <Route path="stage-practice" element={<StagePractice />} />
                    <Route path="song-market" element={<SongMarket />} />
                    <Route path="song-rankings" element={<SongRankings />} />
                    <Route path="recording-studio" element={<RecordingStudio />} />
                    <Route path="release-manager" element={<ReleaseManager />} />
                    <Route path="music-hub" element={<PreserveQueryRedirect to="/music" />} />
                    <Route path="music" element={<MusicOverview />} />
                    <Route path="music-studio" element={<MusicStudio />} />
                    <Route path="skills" element={<SkillsPage />} />
                    <Route path="prison" element={<Prison />} />
                    <Route path="jobs" element={<Jobs />} />
                    <Route path="release/:id" element={<ReleaseDetail />} />
                    <Route path="twaater" element={<Twaater />} />
                    <Route path="social/overview" element={<PreserveQueryRedirect to="/social" />} />
                    <Route path="social/friends" element={<FriendsPage />} />
                    <Route path="social/players" element={<PlayersBrowser />} />
                    <Route path="social/players/discover" element={<PlayerDiscovery />} />
                    <Route path="social/messages" element={<SocialHubUnified />} />
                    <Route path="social/invitations" element={<SocialHubUnified />} />
                    <Route path="social/activities" element={<SocialActivities />} />
                    <Route path="social/activities/new" element={<NewSocialActivity />} />
                    <Route path="social/activities/:activityId" element={<SocialActivityDetail />} />
                    <Route path="social/recruitment" element={<BandRecruitmentDiscovery />} />
                    <Route path="social/twaater" element={<PreserveQueryRedirect to="/twaater" />} />
                    <Route path="twaater/notifications" element={<TwaaterNotifications />} />
                    <Route path="twaater/analytics" element={<TwaaterAnalytics />} />
                    <Route path="twaater/tag/:hashtag" element={<TwaaterHashtagView />} />
                    <Route path="twaater/twaat/:twaatId" element={<TwaaterTwaatView />} />
                    <Route path="twaater/messages" element={<TwaaterMessagesPage />} />
                    <Route path="twaater/:handle" element={<TwaaterProfileView />} />
                    <Route path="events/eurovision" element={<EurovisionPage />} />
                    <Route path="events/narratives/:storyId" element={<NarrativeStoryPage />} />
                    <Route path="employment" element={<Employment />} />
                    <Route path="inventory" element={<InventoryManager />} />
                    <Route path="players/search" element={<PreserveQueryRedirect to="/community/players" />} />
                    <Route path="community/friends" element={<FriendsPage />} />
                    <Route path="settings/privacy/blocked-players" element={<BlockedPlayersPage />} />
                    <Route path="settings/safety/reports" element={<MyReportsPage />} />
                    <Route path="community/players" element={<PlayersBrowser />} />
                    <Route path="community/bands/recruitment" element={<BandRecruitmentDiscovery />} />
                    <Route path="community/invitations" element={<SocialHubUnified />} />
                    <Route path="player/:playerId" element={<PlayerProfile />} />
                    <Route path="players/:playerId" element={<PlayerProfile />} />
                    <Route path="bands/browse" element={<BandBrowser />} />
                    <Route path="bands/search" element={<BandSearch />} />
                    <Route path="band-rankings" element={<BandRankings />} />
                    <Route path="band-fame-map" element={<BandFameMap />} />
                    <Route path="band/:bandId" element={<BandProfile />} />
                    <Route path="merchandise" element={<Merchandise />} />
                    <Route path="avatar-designer" element={<AvatarDesigner />} />
                    <Route path="skin-store" element={<SkinStore />} />
                    <Route path="labels" element={<RecordLabel />} />
                    <Route path="labels/:labelId/manage" element={<LabelManagement />} />
                    <Route path="world-companies" element={<WorldCompanies />} />
                    <Route path="companies/directory" element={<WorldCompanies />} />
                    <Route path="company/:companyId" element={<CompanyDetail />} />
                    <Route path="security-firm/:companyId" element={<SecurityFirmManagement />} />
                    <Route path="merch-factory/:companyId" element={<MerchFactoryManagement />} />
                    <Route path="logistics-company/:companyId" element={<LogisticsCompanyManagement />} />
                    <Route path="venue-business/:venueId" element={<VenueBusinessManagement />} />
                    <Route path="rehearsal-studio-business/:studioId" element={<RehearsalStudioBusinessManagement />} />
                    <Route path="recording-studio-business/:studioId" element={<RecordingStudioBusinessManagement />} />
                    
                    <Route path="lottery" element={<Lottery />} />
                    <Route path="housing" element={<Housing />} />
                    <Route path="personal-vehicles" element={<PersonalVehicles />} />
                    <Route path="casino" element={<CasinoLobby />} />
                    <Route path="casino/blackjack" element={<CasinoBlackjack />} />
                    <Route path="casino/roulette" element={<CasinoRoulette />} />
                    <Route path="casino/slots" element={<CasinoSlots />} />
                    
                    {/* Category hub pages */}
                    <Route path="hub/character" element={<CharacterHub />} />
                    <Route path="hub/music" element={<PreserveQueryRedirect to="/music" />} />
                    <Route path="hub/band-live" element={<BandLiveHub />} />
                    <Route path="hub/career-business" element={<PreserveQueryRedirect to="/career" />} />
                    <Route path="social" element={<SocialHubUnified />} />
                    <Route path="landmarks" element={<CityLandmarks />} />
                    {/* Bare /hub goes to dashboard (no hub index page exists) */}
                    <Route path="hub" element={<Navigate to="/home" replace />} />
                    {/* New split hubs */}
                    <Route path="hub/world" element={<PreserveQueryRedirect to="/world" />} />
                    <Route path="hub/social" element={<PreserveQueryRedirect to="/social" />} />
                    <Route path="hub/media" element={<MediaHub />} />
                    {/* Old hub redirects */}
                    <Route path="hub/band" element={<Navigate to="/hub/band-live" replace />} />
                    <Route path="hub/live" element={<Navigate to="/hub/band-live" replace />} />
                    <Route path="hub/events" element={<Navigate to="/hub/band-live" replace />} />
                    <Route path="hub/world-social" element={<PreserveQueryRedirect to="/world" />} />
                    <Route path="hub/career" element={<PreserveQueryRedirect to="/career" />} />
                    <Route path="hub/commerce" element={<PreserveQueryRedirect to="/business" />} />
                    <Route path="modeling" element={<Modeling />} />
                    <Route path="producer-career" element={<ProducerCareer />} />
                    <Route path="clothing-designer" element={<ClothingDesigner />} />
                    <Route path="clothing-shop" element={<ClothingShop />} />
                    
                    {/* Redirects */}
                    <Route path="record-label" element={<Navigate to="/labels" replace />} />
                    <Route path="gigs/advanced/:gigId" element={<AdvancedGigSystem />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="admin/players" element={<AdminPlayerManagement />} />
                    <Route path="admin/player-reports" element={<AdminPlayerReports />} />
                    <Route path="admin/achievements" element={<AdminAchievements />} />
                    <Route path="admin/analytics" element={<AdminAnalytics />} />
                    <Route path="university/:id" element={<UniversityDetail />} />
                    <Route path="admin/universities" element={<AdminUniversities />} />
                    <Route path="admin/courses" element={<AdminCourses />} />
                    <Route path="admin/cities" element={<AdminCities />} />
                    <Route path="admin/city-governance" element={<CityGovernanceAdmin />} />
                    <Route path="admin/city-treasuries" element={<CityTreasuryAdmin />} />
                    <Route path="admin/city-treasuries/:cityId" element={<CityTreasuryDetail />} />
                    <Route path="admin/districts" element={<AdminDistricts />} />
                    <Route path="admin/city-studios" element={<AdminCityStudios />} />
                    <Route path="admin/production-notes" element={<AdminProductionNotes />} />
                    <Route path="admin/skill-books" element={<AdminSkillBooks />} />
                    <Route path="admin/night-clubs" element={<AdminNightClubs />} />
                    <Route path="admin/game-calendar" element={<AdminGameCalendar />} />
                    <Route path="admin/mentors" element={<AdminMentors />} />
                    <Route path="admin/player-survey" element={<PlayerSurveyAdmin />} />
                    <Route path="admin/jobs" element={<AdminJobs />} />
                    <Route path="admin/venues" element={<AdminVenues />} />
                    <Route path="admin/rehearsal-rooms" element={<AdminRehearsalRooms />} />
                    <Route path="admin/travel" element={<AdminTravel />} />
                    <Route path="admin/song-gifts" element={<AdminSongGifts />} />
                    <Route path="admin/music-videos" element={<MusicVideosAdmin />} />
                    <Route path="admin/festivals" element={<FestivalsAdminPage />} />
                    <Route path="admin/festival" element={<Navigate to="/admin/festivals" replace />} />
                    <Route path="admin/festival-admin" element={<Navigate to="/admin/festivals" replace />} />
                    <Route path="admin/city-festivals" element={<Navigate to="/admin/festivals" replace />} />
                    <Route path="admin/system-status" element={<SystemStatusAdminPage />} />
                    <Route path="admin/eurovision" element={<EurovisionAdminPage />} />
                    <Route path="admin/awards" element={<AwardsAdmin />} />
                    <Route path="admin/advisor" element={<AdvisorAdmin />} />
                    <Route path="admin/pr" element={<PublicRelationsAdmin />} />
                    <Route path="admin/media-outlets" element={<MediaOutletsAdmin />} />
                    <Route path="admin/underworld" element={<UnderworldAdmin />} />
                    <Route path="admin/stage-equipment" element={<AdminStageEquipmentCatalog />} />
                    <Route path="admin/stage-templates" element={<StageTemplatesAdmin />} />
                    {/* <Route path="admin/3d-gig-viewer" element={<Admin3DGigViewer />} /> */}
                    <Route path="admin/gear-items" element={<GearItemsAdmin />} />
                    <Route path="admin/page-graphics" element={<PageGraphicsAdmin />} />
                    <Route path="admin/release-pump" element={<AdminReleasePump />} />
                    <Route path="admin/crew" element={<AdminCrewCatalog />} />
                    <Route path="admin/producers" element={<AdminProducers />} />
                    <Route path="admin/streaming-platforms" element={<AdminStreamingPlatforms />} />
                    <Route path="admin/marketplace" element={<AdminMarketplace />} />
                    <Route path="admin/twaater-moderation" element={<AdminTwaaterModeration />} />
                    <Route path="admin/cron-monitor" element={<AdminCronMonitor />} />
                    <Route path="admin/world-reset" element={<AdminWorldReset />} />
                    <Route path="admin/debug-panel" element={<AdminDebugPanel />} />
                    <Route path="admin/death-system" element={<AdminDeathSystem />} />
                    <Route path="admin/offer-automation" element={<AdminOfferAutomation />} />
                    <Route path="admin/release-config" element={<AdminReleaseConfig />} />
                    <Route path="admin/radio-stations" element={<AdminRadioStations />} />
                    <Route path="admin/radio-content" element={<AdminRadioContent />} />
                    <Route path="admin/experience-rewards" element={<AdminExperienceRewards />} />
                    <Route path="admin/youtube-videos" element={<AdminYoutubeVideos />} />
                    
                    <Route path="admin/songwriting" element={<SongwritingAdmin />} />
                    <Route path="admin/ai-song-generation" element={<AISongGeneration />} />
                    <Route path="admin/gigs" element={<GigsAdmin />} />
                    <Route path="admin/gig-viewer-demo" element={<AdminGigViewerDemo />} />
                    
                    <Route path="admin/charts" element={<ChartsAdmin />} />
                    <Route path="admin/twaater" element={<TwaaterAdmin />} />
                    <Route path="admin/brands" element={<BrandsAdmin />} />

                    <Route path="admin/labels" element={<LabelsAdmin />} />
                    <Route path="admin/bands" element={<BandAdmin />} />
                    <Route path="admin/fame-fans-gifting" element={<FameFansGifting />} />
                    <Route path="admin/fame-fans-attribution" element={<FameFansAttribution />} />
                    <Route path="admin/releases" element={<ReleasesAdmin />} />
                    <Route path="admin/dashboard" element={<AdminDashboard />} />
                    <Route path="admin/user-roles" element={<AdminUserRolesPage />} />
                    <Route path="admin/game-balance" element={<GameBalanceAdmin />} />
                    <Route path="admin/sales-balance" element={<SalesBalanceAdmin />} />
                    <Route path="admin/tutorials" element={<TutorialsAdmin />} />
                    <Route path="admin/vip" element={<VipManagement />} />
                    <Route path="admin/companies" element={<CompanyAdmin />} />
                    <Route path="admin/security-firms" element={<SecurityFirmsAdmin />} />
                    <Route path="admin/merch-factories" element={<MerchFactoriesAdmin />} />
                    <Route path="admin/logistics-companies" element={<LogisticsCompaniesAdmin />} />
                    <Route path="admin/skin-collections" element={<SkinCollectionsAdmin />} />
                    <Route path="admin/skin-collections/:collectionId/items" element={<CollectionItemsAdmin />} />
                    <Route path="admin/random-events" element={<RandomEventsAdmin />} />
                    <Route path="admin/skill-definitions" element={<SkillDefinitionsAdmin />} />
                    <Route path="admin/stream-multiplier" element={<StreamMultiplier />} />
                    {/* Stage Templates route defined above */}
                    <Route path="admin/band-avatars" element={<BandAvatarsAdmin />} />
                    <Route path="admin/crowd-behavior" element={<CrowdBehaviorAdmin />} />
                    <Route path="admin/crowd-sounds" element={<CrowdSoundsAdmin />} />
                    <Route path="admin/pov-clips" element={<POVClipAdmin />} />
                    <Route path="admin/practice-tracks" element={<PracticeTracksAdmin />} />
                    <Route path="performance/gig/:gigId" element={<PerformGig />} />
                    <Route path="world-map" element={<WorldMap />} />
                    <Route path="nightclubs" element={<NightclubHub />} />
                    <Route path="nightclub/:clubId" element={<NightClubDetail />} />
                    <Route path="nightclub-management" element={<NightclubManagement />} />
                    <Route path="crafting" element={<CraftingWorkshop />} />
                    <Route path="tattoo-parlour" element={<TattooParlour />} />
                    <Route path="gear-shop" element={<EnhancedEquipmentStore />} />
                    <Route path="statistics" element={<PlayerStatistics />} />
                    <Route path="progression" element={<ProgressionPanel />} />
                    <Route path="hall-of-immortals" element={<HallOfImmortals />} />
                    <Route path="my-character" element={<MyCharacterEdit />} />
                    <Route path="my-character/edit" element={<MyCharacterEdit />} />
                    <Route path="gear-history/:kind/:id" element={<GearHistoryPublic />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </ErrorBoundary>
                </BrowserRouter>
                    </TooltipProvider>
                  </BandCrewCatalogProvider>
                </StageEquipmentCatalogProvider>
              </RadioProvider>
            </TutorialProvider>
            </FeedbackProvider>
          </NotificationProvider>
        </GameDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
