import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Music, Calendar, Mic, Radio, Users, 
  TrendingUp, DollarSign, Star, ArrowRight 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  badge?: string;
  variant?: "default" | "primary";
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Calendar,
    label: "Book a Gig",
    description: "Find venues and book your next performance",
    href: "/gig-booking",
    variant: "primary",
  },
  {
    icon: Mic,
    label: "Record a Song",
    description: "Head to the studio and lay down tracks",
    href: "/recording-studio",
  },
  {
    icon: Music,
    label: "Write Music",
    description: "Start a songwriting session",
    href: "/songwriting",
  },
  {
    icon: Radio,
    label: "Submit to Radio",
    description: "Get your music on the airwaves",
    href: "/radio",
  },
  {
    icon: Users,
    label: "Manage Band",
    description: "View and manage your band",
    href: "/band",
  },
];

export const QuickActionsPanel = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.href}
            variant={action.variant === "primary" ? "default" : "outline"}
            className="w-full justify-start h-auto py-3"
            onClick={() => navigate(action.href)}
          >
            <action.icon className="h-4 w-4 mr-3 flex-shrink-0" />
            <div className="flex-1 text-left">
              <p className="font-medium">{action.label}</p>
              <p className="text-xs text-muted-foreground font-normal">
                {action.description}
              </p>
            </div>
            {action.badge && (
              <Badge variant="secondary" className="ml-2">
                {action.badge}
              </Badge>
            )}
            <ArrowRight className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change?: number;
  prefix?: string;
}

export const StatCard = ({ icon: Icon, label, value, change, prefix = "" }: StatCardProps) => (
  <Card>
    <CardContent className="pt-4">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-muted-foreground" />
        {change !== undefined && (
          <Badge variant={change >= 0 ? "default" : "destructive"} className="text-xs">
            {change >= 0 ? "+" : ""}{change}%
          </Badge>
        )}
      </div>
      <p className="text-2xl font-bold mt-2">
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

export const DashboardStats = ({ 
  fame = 0, 
  cash = 0, 
  songs = 0, 
  gigs = 0 
}: { 
  fame?: number; 
  cash?: number; 
  songs?: number; 
  gigs?: number;
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <StatCard icon={Star} label="Fame" value={fame} />
    <StatCard icon={DollarSign} label="Cash" value={cash} prefix="$" />
    <StatCard icon={Music} label="Songs" value={songs} />
    <StatCard icon={Calendar} label="Gigs Played" value={gigs} />
  </div>
);
