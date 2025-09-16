import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BandManager from "./pages/BandManager";
import GigBooking from "./pages/GigBooking";
import Profile from "./pages/Profile";
import MusicStudio from "./pages/MusicStudio";
import WorldPulse from "./pages/WorldPulse";
import Schedule from "./pages/Schedule";
import EquipmentStore from "./pages/EquipmentStore";
import FanManagement from "./pages/FanManagement";
import Achievements from "./pages/Achievements";
import TourManager from "./pages/TourManager";
import RecordLabel from "./pages/RecordLabel";
import SocialMedia from "./pages/SocialMedia";
import VenueManagement from "./pages/VenueManagement";
import BandChemistry from "./pages/BandChemistry";
import StreamingPlatforms from "./pages/StreamingPlatforms";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="band" element={<BandManager />} />
            <Route path="gigs" element={<GigBooking />} />
            <Route path="profile" element={<Profile />} />
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
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
