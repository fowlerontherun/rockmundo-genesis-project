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
  const status = getTicketSalesStatus(ticketsSold, predictedTickets, venueCapacity);
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Ticket className="h-4 w-4 text-primary" />
        <span className="font-medium">{ticketsSold.toLocaleString()}</span>
        <span className="text-muted-foreground">/ {predictedTickets.toLocaleString()} predicted</span>
        {ticketsSold >= venueCapacity && (
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
        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sold: {ticketsSold.toLocaleString()}</span>
          <span>Capacity: {venueCapacity.toLocaleString()}</span>
        </div>
        <Progress value={status.percentSold} className="h-2" />
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          <span>Predicted: {predictedTickets.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{status.percentSold}% filled</span>
        </div>
      </div>
    </div>
  );
};
