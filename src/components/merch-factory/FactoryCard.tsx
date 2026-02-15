import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Factory, Settings, Users, Package } from "lucide-react";
import type { MerchFactory } from "@/types/merch-factory";
import { FACTORY_TYPES } from "@/types/merch-factory";

interface FactoryCardProps {
  factory: MerchFactory;
  onManage?: () => void;
}

export function FactoryCard({ factory, onManage }: FactoryCardProps) {
  const factoryTypeInfo = FACTORY_TYPES.find(t => t.value === factory.factory_type);
  const capacityUsage = (factory.current_production / factory.production_capacity) * 100;
  
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{factoryTypeInfo?.icon || '🏭'}</span>
            <div>
              <CardTitle className="text-lg">{factory.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {factory.city?.name}, {factory.city?.country}
              </p>
            </div>
          </div>
          <Badge variant={factory.is_operational ? "default" : "destructive"}>
            {factory.is_operational ? "Operational" : "Closed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-muted-foreground" />
            <span>{factoryTypeInfo?.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{factory.worker_count} Workers</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Production Capacity</span>
            <span>{factory.current_production}/{factory.production_capacity}</span>
          </div>
          <Progress value={capacityUsage} className="h-2" />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Equipment Condition</span>
            <span>{factory.equipment_condition}%</span>
          </div>
          <Progress 
            value={factory.equipment_condition} 
            className={`h-2 ${factory.equipment_condition < 30 ? '[&>div]:bg-destructive' : factory.equipment_condition < 60 ? '[&>div]:bg-warning' : ''}`}
          />
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Quality Level: </span>
            <span className="font-medium">{"⭐".repeat(factory.quality_level)}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Daily Cost: </span>
            <span className="font-medium text-warning">${factory.operating_costs_daily}</span>
          </div>
        </div>
        
        {onManage && (
          <Button onClick={onManage} className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Manage Factory
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
