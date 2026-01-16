import { Card, CardContent } from "@/components/ui/card";
import { Music, TrendingUp, DollarSign, Mic2 } from "lucide-react";

interface BandRepertoireHeaderProps {
  totalSongs: number;
  totalStreams: number;
  totalRevenue: number;
  totalGigs: number;
}

export const BandRepertoireHeader = ({
  totalSongs,
  totalStreams,
  totalRevenue,
  totalGigs,
}: BandRepertoireHeaderProps) => {
  const stats = [
    {
      label: "Total Songs",
      value: totalSongs,
      icon: Music,
      color: "text-primary",
    },
    {
      label: "Total Streams",
      value: totalStreams.toLocaleString(),
      icon: TrendingUp,
      color: "text-blue-500",
    },
    {
      label: "Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "Gigs Played",
      value: totalGigs,
      icon: Mic2,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-3 py-4">
            <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
