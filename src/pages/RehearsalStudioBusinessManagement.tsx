import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Music, Users, Package, Wrench, DollarSign } from "lucide-react";
import { VipGate } from "@/components/company/VipGate";

export default function RehearsalStudioBusinessManagement() {
  const { studioId } = useParams();
  const navigate = useNavigate();
  
  return (
    <VipGate feature="Rehearsal Studio Business" description="Manage your rehearsal studio, staff, equipment, and bookings.">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Music className="h-6 w-6" />
              Rehearsal Studio Management
            </h1>
            <p className="text-muted-foreground">
              Studio ID: {studioId}
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Staff</p>
              <p className="text-xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-1">employees</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Equipment</p>
              <p className="text-xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-1">items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Bookings</p>
              <p className="text-xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-1">this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-xl font-bold">$0</p>
              <p className="text-xs text-muted-foreground mt-1">this month</p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="staff" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Staff</span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Equipment</span>
            </TabsTrigger>
            <TabsTrigger value="upgrades" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Upgrades</span>
            </TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Finances</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="staff">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Staff management coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="equipment">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Equipment inventory coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="upgrades">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Studio upgrades coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="finances">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Financial reports coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </VipGate>
  );
}
