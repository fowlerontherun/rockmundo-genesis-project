import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Music, Calendar, DollarSign, Star, 
  Mic, Radio, Users, Trophy, TrendingUp 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "gig" | "recording" | "release" | "radio" | "achievement" | "band" | "earnings";
  title: string;
  description: string;
  timestamp: Date;
  metadata?: {
    amount?: number;
    fame?: number;
  };
}

const ACTIVITY_ICONS = {
  gig: Calendar,
  recording: Mic,
  release: Music,
  radio: Radio,
  achievement: Trophy,
  band: Users,
  earnings: DollarSign,
};

const ACTIVITY_COLORS = {
  gig: "bg-blue-500/10 text-blue-500",
  recording: "bg-purple-500/10 text-purple-500",
  release: "bg-green-500/10 text-green-500",
  radio: "bg-orange-500/10 text-orange-500",
  achievement: "bg-yellow-500/10 text-yellow-500",
  band: "bg-pink-500/10 text-pink-500",
  earnings: "bg-emerald-500/10 text-emerald-500",
};

interface ActivityFeedProps {
  activities: ActivityItem[];
  maxHeight?: string;
  showHeader?: boolean;
}

export const ActivityFeed = ({ 
  activities, 
  maxHeight = "400px",
  showHeader = true 
}: ActivityFeedProps) => {
  if (activities.length === 0) {
    return (
      <Card>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="py-8 text-center text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No recent activity</p>
          <p className="text-sm mt-1">Start playing gigs and recording to see your progress!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="p-4 space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const colorClass = ACTIVITY_COLORS[activity.type];

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                      </span>
                      {activity.metadata?.amount && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          +${activity.metadata.amount}
                        </Badge>
                      )}
                      {activity.metadata?.fame && (
                        <Badge variant="secondary" className="text-[10px] h-4">
                          +{activity.metadata.fame} fame
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Helper to convert database activity to ActivityItem format
export const convertToActivityItem = (dbActivity: any): ActivityItem => ({
  id: dbActivity.id,
  type: mapActivityType(dbActivity.activity_type),
  title: getActivityTitle(dbActivity.activity_type),
  description: dbActivity.message,
  timestamp: new Date(dbActivity.created_at),
  metadata: {
    amount: dbActivity.earnings,
    fame: dbActivity.metadata?.fame,
  },
});

const mapActivityType = (type: string): ActivityItem["type"] => {
  const typeMap: Record<string, ActivityItem["type"]> = {
    gig_completed: "gig",
    recording_completed: "recording",
    song_released: "release",
    radio_submission: "radio",
    achievement_unlocked: "achievement",
    band_joined: "band",
    earnings_received: "earnings",
  };
  return typeMap[type] || "gig";
};

const getActivityTitle = (type: string): string => {
  const titleMap: Record<string, string> = {
    gig_completed: "Gig Completed",
    recording_completed: "Recording Finished",
    song_released: "Song Released",
    radio_submission: "Radio Submission",
    achievement_unlocked: "Achievement Unlocked",
    band_joined: "Joined Band",
    earnings_received: "Earnings Received",
  };
  return titleMap[type] || "Activity";
};
