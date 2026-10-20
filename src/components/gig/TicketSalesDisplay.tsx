import { capacityProgress } from '@/components/game-art/progressionModel';
import React from 'react';
import { Ticket, TrendingUp, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getTicketSalesStatus } from '@/utils/ticketSalesSimulation';

interface TicketSalesDisplayProps {
  ticketsSold: number;
  predictedTickets: number;
  venueCapacity: number;
  compact?: boolean;
}

export const TicketSalesDisplay: React.FC<TicketSalesDisplayProps> = ({
  ticketsSold,
  predictedTickets,
  venueCapacity,
  compact = false
}) => {
  const percent = capacityProgress(ticketsSold, venueCapacity);
  const status = getTicketSalesStatus(ticketsSold, predictedTickets, venueCapacity);
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Ticket className="h-4 w-4 text-primary" />
        <span className="font-medium">{ticketsSold.toLocaleString()}</span>
        <span className="text-muted-foreground">/ {predictedTickets.toLocaleString()} estimated final</span>
        {percent !== null && ticketsSold >= venueCapacity && (
          <Badge variant="default" className="bg-green-600">SOLD OUT</Badge>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Ticket className="h-4 w-4 text-primary" />
          Ticket Sales
        </div>
        <span className={`text-xs font-medium ${status.color}`}>{percent === null ? 'Capacity unavailable' : status.label}</span>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sold: {ticketsSold.toLocaleString()}</span>
          <span>Capacity: {percent === null ? 'Unknown' : venueCapacity.toLocaleString()}</span>
        </div>
        {percent !== null && <>
          <div aria-hidden="true" className="rounded-md bg-slate-950 p-3">
            <div className="mx-auto mb-3 h-1 w-1/3 rounded bg-amber-300/70" />
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 40 }, (_, index) => <span key={index} className="h-2 overflow-hidden rounded-sm bg-white/15"><span className="block h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (percent / 100 * 40 - index) * 100))}%` }} /></span>)}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Capacity illustration · not a seat map</p>
          <Progress value={percent} aria-label="Tickets sold as a percentage of venue capacity" className="h-2" />
        </>}
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          <span>Estimated final: {predictedTickets.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{percent === null ? 'Capacity unavailable' : `${percent}% filled`}</span>
        </div>
      </div>
    </div>
  );
};
