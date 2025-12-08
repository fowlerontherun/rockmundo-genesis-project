import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, XCircle, AlertTriangle, Speaker, Utensils, 
  DoorClosed, TrendingUp, Users, DollarSign, Percent
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FulfillmentItem {
  id: string;
  catalog_item: {
    name: string;
    category: string;
    subcategory: string;
  };
  quantity: number;
  priority: string;
  cost?: number;
  reason?: string;
}

interface RiderFulfillmentDisplayProps {
  fulfillmentPercentage: number;
  technicalFulfillment: number;
  hospitalityFulfillment: number;
  backstageFulfillment: number;
  performanceModifier: number;
  moraleModifier: number;
  totalCost: number;
  fulfilled: FulfillmentItem[];
  missing: FulfillmentItem[];
  partial?: FulfillmentItem[];
  compact?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  technical: <Speaker className="h-4 w-4" />,
  hospitality: <Utensils className="h-4 w-4" />,
  backstage: <DoorClosed className="h-4 w-4" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  essential: 'text-destructive',
  important: 'text-amber-500',
  nice_to_have: 'text-muted-foreground',
  optional: 'text-muted-foreground/50',
};

export function RiderFulfillmentDisplay({
  fulfillmentPercentage,
  technicalFulfillment,
  hospitalityFulfillment,
  backstageFulfillment,
  performanceModifier,
  moraleModifier,
  totalCost,
  fulfilled,
  missing,
  partial = [],
  compact = false,
}: RiderFulfillmentDisplayProps) {
  const getOverallStatus = () => {
    if (fulfillmentPercentage >= 90) return { icon: CheckCircle, color: 'text-green-500', label: 'Excellent' };
    if (fulfillmentPercentage >= 70) return { icon: CheckCircle, color: 'text-green-400', label: 'Good' };
    if (fulfillmentPercentage >= 50) return { icon: AlertTriangle, color: 'text-amber-500', label: 'Partial' };
    return { icon: XCircle, color: 'text-destructive', label: 'Poor' };
  };

  const status = getOverallStatus();
  const StatusIcon = status.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-4 w-4", status.color)} />
          <span className="font-medium">{fulfillmentPercentage}% fulfilled</span>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-3 w-3" />
          <span>+{Math.round((performanceModifier - 1) * 100)}%</span>
        </div>
        <div className="flex items-center gap-1 text-blue-600">
          <Users className="h-3 w-3" />
          <span>+{Math.round((moraleModifier - 1) * 100)}%</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          <span>${totalCost.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Rider Fulfillment
        </CardTitle>
        <CardDescription>
          How well this venue can fulfill your rider requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon className={cn("h-5 w-5", status.color)} />
              <span className="font-medium">{status.label} Match</span>
            </div>
            <span className="text-2xl font-bold">{fulfillmentPercentage}%</span>
          </div>
          <Progress value={fulfillmentPercentage} className="h-3" />
        </div>

        {/* Category Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {CATEGORY_ICONS.technical}
              <span>Technical</span>
            </div>
            <Progress value={technicalFulfillment} className="h-2" />
            <p className="text-xs font-medium">{technicalFulfillment}%</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {CATEGORY_ICONS.hospitality}
              <span>Hospitality</span>
            </div>
            <Progress value={hospitalityFulfillment} className="h-2" />
            <p className="text-xs font-medium">{hospitalityFulfillment}%</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {CATEGORY_ICONS.backstage}
              <span>Backstage</span>
            </div>
            <Progress value={backstageFulfillment} className="h-2" />
            <p className="text-xs font-medium">{backstageFulfillment}%</p>
          </div>
        </div>

        {/* Impact Modifiers */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-lg font-bold">+{Math.round((performanceModifier - 1) * 100)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Performance Bonus</p>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600">
              <Users className="h-4 w-4" />
              <span className="text-lg font-bold">+{Math.round((moraleModifier - 1) * 100)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Morale Bonus</p>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-lg font-bold">${totalCost.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Cost</p>
          </div>
        </div>

        {/* Fulfilled Items */}
        {fulfilled.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Fulfilled ({fulfilled.length})
            </h4>
            <div className="grid gap-1 text-sm">
              {fulfilled.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {CATEGORY_ICONS[item.catalog_item.category]}
                    <span>{item.catalog_item.name}</span>
                    {item.quantity > 1 && <Badge variant="outline" className="text-xs">×{item.quantity}</Badge>}
                  </div>
                  {item.cost && <span className="text-xs">${item.cost}</span>}
                </div>
              ))}
              {fulfilled.length > 5 && (
                <p className="text-xs text-muted-foreground">+{fulfilled.length - 5} more items</p>
              )}
            </div>
          </div>
        )}

        {/* Missing Items */}
        {missing.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Unavailable ({missing.length})
            </h4>
            <div className="grid gap-1 text-sm">
              {missing.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {CATEGORY_ICONS[item.catalog_item.category]}
                    <span className={PRIORITY_COLORS[item.priority]}>
                      {item.catalog_item.name}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.priority.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
              {missing.length > 5 && (
                <p className="text-xs text-muted-foreground">+{missing.length - 5} more items</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
