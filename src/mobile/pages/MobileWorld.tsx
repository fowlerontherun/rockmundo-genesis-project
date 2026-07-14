import { useNavigate } from "react-router-dom";
import { MapPin, Plane, Building2, Store, LineChart, CalendarClock } from "lucide-react";
import { MCard } from "../components/MCard";

export default function MobileWorld() {
  const navigate = useNavigate();
  const tiles = [
    { title: "Current City", subtitle: "Local venues and events", icon: <MapPin className="h-5 w-5" />, to: "/city" },
    { title: "Travel", subtitle: "Fly, drive, or tour", icon: <Plane className="h-5 w-5" />, to: "/travel" },
    { title: "Companies", subtitle: "Your business empire", icon: <Building2 className="h-5 w-5" />, to: "/companies" },
    { title: "Marketplace", subtitle: "Buy and sell", icon: <Store className="h-5 w-5" />, to: "/marketplace" },
    { title: "Charts", subtitle: "Songs & albums", icon: <LineChart className="h-5 w-5" />, to: "/music/charts" },
    { title: "Events", subtitle: "Festivals and awards", icon: <CalendarClock className="h-5 w-5" />, to: "/festivals/directory" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <MCard key={t.title} {...t} onPress={() => navigate(t.to)} className="min-h-[100px]" />
      ))}
    </div>
  );
}
