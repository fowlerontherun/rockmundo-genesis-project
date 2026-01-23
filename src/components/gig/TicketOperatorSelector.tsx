import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Ticket, AlertTriangle, TrendingUp, Users, DollarSign, Info } from "lucide-react";
import { TICKET_OPERATORS, getAvailableOperators, type TicketOperator } from "@/data/ticketOperators";
import { cn } from "@/lib/utils";

interface TicketOperatorSelectorProps {
  venueCapacity: number;
  selectedOperatorId: string | null;
  onSelectOperator: (operatorId: string) => void;
}

export function TicketOperatorSelector({
  venueCapacity,
  selectedOperatorId,
  onSelectOperator,
}: TicketOperatorSelectorProps) {
  const availableOperators = getAvailableOperators(venueCapacity);

  // If venue is too small, show message
  if (venueCapacity < 200) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ticket className="h-4 w-4" />
            <span>Ticket operators available for venues 200+ capacity</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Ticket className="h-4 w-4" />
          Ticket Operator
        </CardTitle>
        <CardDescription>
          Choose how tickets are sold. Higher reach means more sales but more touts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedOperatorId || ''}
          onValueChange={onSelectOperator}
          className="space-y-2"
        >
          {availableOperators.map((operator) => (
            <OperatorOption
              key={operator.id}
              operator={operator}
              isSelected={selectedOperatorId === operator.id}
            />
          ))}
        </RadioGroup>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t flex flex-wrap gap-3 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>Cut</span>
              </TooltipTrigger>
              <TooltipContent>Percentage of ticket sales taken by the operator</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>Boost</span>
              </TooltipTrigger>
              <TooltipContent>Sales multiplier from platform reach</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>Tout</span>
              </TooltipTrigger>
              <TooltipContent>% of tickets that go to scalpers (fewer real fans)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

function OperatorOption({ operator, isSelected }: { operator: TicketOperator; isSelected: boolean }) {
  const toutWarning = operator.toutLevel >= 0.25;
  const dynamicPricingWarning = operator.dynamicPricing;

  return (
    <div
      className={cn(
        "flex items-start space-x-3 rounded-lg border p-3 transition-colors cursor-pointer",
        isSelected && "border-primary bg-primary/5"
      )}
    >
      <RadioGroupItem value={operator.id} id={operator.id} />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={operator.id} className="font-semibold cursor-pointer flex items-center gap-2">
          {operator.name}
          {toutWarning && (
            <Badge variant="outline" className="text-xs text-warning border-warning/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Tout risk
            </Badge>
          )}
          {dynamicPricingWarning && (
            <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              Dynamic pricing
            </Badge>
          )}
        </Label>
        <p className="text-xs text-muted-foreground">{operator.description}</p>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary" className="text-xs">
            <DollarSign className="h-3 w-3 mr-0.5" />
            {(operator.cut * 100).toFixed(0)}% cut
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-0.5" />
            {((operator.salesBoost - 1) * 100).toFixed(0)}% boost
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
              {(operator.toutLevel * 100).toFixed(0)}% tout
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
