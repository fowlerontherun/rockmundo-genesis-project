import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Users, Calendar, Wrench, DollarSign } from "lucide-react";
import { useCompanyVenues, useVenueStaff, useVenueBookings, useVenueUpgrades } from "@/hooks/useVenueBusiness";
import { VipGate } from "@/components/company/VipGate";

export default function VenueBusinessManagement() {
  const { venueId } = useParams();
  const navigate = useNavigate();
  
  const { data: venues, isLoading } = useCompanyVenues(undefined);
  const { data: staff } = useVenueStaff(venueId);
  const { data: bookings } = useVenueBookings(venueId);
  const { data: upgrades } = useVenueUpgrades(venueId);
  
  // For now we'll show a placeholder - in real implementation we'd fetch the specific venue
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }
  
  return (
    <VipGate feature="Venue Business Management" description="Manage your venue, staff, bookings, and upgrades.">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Venue Management
            </h1>
            <p className="text-muted-foreground">
              Manage your venue business operations
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Staff</p>
              <p className="text-xl font-bold">{staff?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">employees</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Bookings</p>
              <p className="text-xl font-bold">{bookings?.filter(b => b.status === 'confirmed').length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">confirmed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Upgrades</p>
              <p className="text-xl font-bold">{upgrades?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">installed</p>
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
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Bookings</span>
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
          
          <TabsContent value="bookings">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Booking calendar coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="upgrades">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Venue upgrades coming soon
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
