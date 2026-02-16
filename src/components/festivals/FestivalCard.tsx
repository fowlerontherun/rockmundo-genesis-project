import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Music, Star, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { Festival } from "@/hooks/useFestivals";

interface FestivalCardProps {
  festival: Festival;
  participation?: {
    id: string;
    status: string;
    slot_type: string;
    payout_amount: number;
  } | null;
  onApply?: () => void;
  onWithdraw?: (participationId: string) => void;
  onPerform?: (participationId: string) => void;
  isApplying?: boolean;
  isWithdrawing?: boolean;
  isPerforming?: boolean;
}

const SLOT_COLORS: Record<string, string> = {
  opening: "bg-slate-500",
  support: "bg-blue-500",
  main: "bg-purple-500",
  headline: "bg-amber-500",
};

export function FestivalCard({
  festival,
  participation,
  onApply,
  onWithdraw,
  onPerform,
  isApplying,
  isWithdrawing,
  isPerforming,
}: FestivalCardProps) {
  const startDate = new Date(festival.start_date);
  const endDate = new Date(festival.end_date);
  const daysUntil = differenceInDays(startDate, new Date());
  const isUpcoming = daysUntil > 0;
  const isOngoing = daysUntil <= 0 && differenceInDays(endDate, new Date()) >= 0;
  const isFull = festival.current_participants >= festival.max_participants;

  const getStatusBadge = () => {
    if (!participation) return null;
    
    const statusColors: Record<string, string> = {
      pending: "bg-yellow-500",
      confirmed: "bg-green-500",
      performed: "bg-blue-500",
      withdrawn: "bg-gray-500",
      rejected: "bg-red-500",
    };

    return (
      <Badge className={`${statusColors[participation.status] || "bg-gray-500"} text-white`}>
        {participation.status.charAt(0).toUpperCase() + participation.status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{festival.title}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {festival.location}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isUpcoming && (
              <Badge variant="outline" className="whitespace-nowrap">
                <Clock className="h-3 w-3 mr-1" />
                {daysUntil} days
              </Badge>
            )}
            {isOngoing && (
              <Badge className="bg-green-500 text-white">Live Now</Badge>
            )}
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date Range */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
          </span>
        </div>

        {/* Description */}
        {festival.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {festival.description}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{festival.current_participants}/{festival.max_participants} slots</span>
          </div>
          {festival.rewards?.fame && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-500" />
              <span>+{festival.rewards.fame} fame</span>
            </div>
          )}
        </div>

        {/* Participation Details */}
        {participation && participation.status !== "withdrawn" && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Slot</span>
              <Badge className={`${SLOT_COLORS[participation.slot_type] || "bg-gray-500"} text-white capitalize`}>
                {participation.slot_type}
              </Badge>
            </div>
            {participation.payout_amount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-medium">${participation.payout_amount.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!participation && onApply && (
            <Button 
              className="flex-1" 
              onClick={onApply}
              disabled={isApplying || isFull}
            >
              {isApplying ? "Applying..." : isFull ? "Fully Booked" : "Apply to Perform"}
            </Button>
          )}

          {participation?.status === "pending" && onWithdraw && (
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={() => onWithdraw(participation.id)}
              disabled={isWithdrawing}
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw Application"}
            </Button>
          )}

          {participation?.status === "confirmed" && (
            <Badge className="bg-green-600 text-white px-3 py-1.5">
              <Clock className="h-3 w-3 mr-1" />
              Scheduled
            </Badge>
          )}

          {participation?.status === "performed" && (
            <Button variant="secondary" className="flex-1" disabled>
              Performance Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
