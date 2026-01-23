import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket, DollarSign, TrendingUp, Users, AlertTriangle } from "lucide-react";
import { getOperatorById, type TicketOperator } from "@/data/ticketOperators";
import { cn } from "@/lib/utils";

interface TicketOperatorDisplayProps {
  operatorId: string | null;
  venueCapacity: number;
  showChangeOption?: boolean;
  onChangeClick?: () => void;
  compact?: boolean;
}

export function TicketOperatorDisplay({
  operatorId,
  venueCapacity,
  showChangeOption = false,
  onChangeClick,
  compact = false,
}: TicketOperatorDisplayProps) {
  // Only show for venues 200+ capacity
  if (venueCapacity < 200) return null;

  const operator = operatorId ? getOperatorById(operatorId) : null;

  if (!operator) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              <span>No ticket operator selected</span>
            </div>
            {showChangeOption && onChangeClick && (
              <Button variant="outline" size="sm" onClick={onChangeClick}>
                Select Operator
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Ticket className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{operator.name}</span>
        <Badge variant="outline" className="text-xs">
          {(operator.cut * 100).toFixed(0)}% cut
        </Badge>
      </div>
    );
  }

  const toutWarning = operator.toutLevel >= 0.25;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Ticket Operator
          </CardTitle>
          {showChangeOption && onChangeClick && (
            <Button variant="ghost" size="sm" onClick={onChangeClick}>
              Change
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{operator.name}</span>
          {toutWarning && (
            <Badge variant="outline" className="text-xs text-warning border-warning/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Tout risk
            </Badge>
          )}
          {operator.dynamicPricing && (
            <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              Dynamic pricing
            </Badge>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">{operator.description}</p>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            <DollarSign className="h-3 w-3 mr-0.5" />
            {(operator.cut * 100).toFixed(0)}% cut
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-0.5" />
            {((operator.salesBoost - 1) * 100).toFixed(0)}% sales boost
          </Badge>
          {operator.toutLevel > 0 && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                operator.toutLevel >= 0.35 && "text-destructive border-destructive/30"
              )}
            >
              <Users className="h-3 w-3 mr-0.5" />
              {(operator.toutLevel * 100).toFixed(0)}% tout risk
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
