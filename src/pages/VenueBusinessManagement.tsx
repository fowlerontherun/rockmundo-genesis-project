import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Users, Calendar, Wrench, DollarSign, MapPin, Star } from "lucide-react";
import { useVenueStaff, useVenueBookings, useVenueUpgrades, useVenueFinancials } from "@/hooks/useVenueBusiness";
import { VipGate } from "@/components/company/VipGate";
import { VenueStaffManager, VenueBookingsManager, VenueUpgradesManager } from "@/components/venue-business";
import { supabase } from "@/integrations/supabase/client";

export default function VenueBusinessManagement() {
  const { venueId } = useParams();
  const navigate = useNavigate();
  
  // Try to fetch venue by ID first, then by company_id if it's a company's venue
  const { data: venue, isLoading: venueLoading } = useQuery({
    queryKey: ['venue-business', venueId],
    queryFn: async () => {
      if (!venueId) return null;
      
      // First try to find by venue ID
      let { data, error } = await supabase
        .from('venues')
        .select(`
          *,
          city:cities(name, country)
        `)
        .eq('id', venueId)
        .single();
      
      // If not found, try to find by company_id
      if (error || !data) {
        const { data: venueByCompany, error: companyError } = await supabase
          .from('venues')
          .select(`
            *,
            city:cities(name, country)
          `)
          .eq('company_id', venueId)
          .single();
        
        if (companyError) throw companyError;
        return venueByCompany;
      }
      
      return data;
    },
    enabled: !!venueId,
  });

  const actualVenueId = venue?.id;
  
  const { data: staff } = useVenueStaff(actualVenueId);
  const { data: bookings } = useVenueBookings(actualVenueId);
  const { data: upgrades } = useVenueUpgrades(actualVenueId);
  const { data: financials } = useVenueFinancials(actualVenueId);

  // Calculate financial stats
  const totalRevenue = financials?.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalExpenses = financials?.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
  const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
  
  if (venueLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Venue Not Found</h2>
          <p className="text-muted-foreground mb-4">The venue you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
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
              {venue.name}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {venue.city?.name}, {venue.city?.country}
              <Badge variant="outline" className="ml-2 capitalize">{venue.venue_type}</Badge>
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Capacity</p>
              <p className="text-xl font-bold">{venue.capacity?.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">max attendance</p>
            </CardContent>
          </Card>
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
              <p className="text-xl font-bold">{confirmedBookings}</p>
              <p className="text-xs text-muted-foreground mt-1">confirmed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Prestige</p>
              <div className="flex items-center gap-1">
                <p className="text-xl font-bold">{venue.prestige_level || 1}</p>
                <Star className="h-4 w-4 text-yellow-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">reputation tier</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Net Revenue</p>
              <p className={`text-xl font-bold ${totalRevenue - totalExpenses >= 0 ? 'text-primary' : 'text-destructive'}`}>
                ${(totalRevenue - totalExpenses).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">this period</p>
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
            {actualVenueId ? (
              <VenueStaffManager venueId={actualVenueId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-8">
                    Venue not loaded
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="bookings">
            {actualVenueId ? (
              <VenueBookingsManager venueId={actualVenueId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-8">
                    Venue not loaded
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="upgrades">
            {actualVenueId ? (
              <VenueUpgradesManager venueId={actualVenueId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-8">
                    Venue not loaded
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="finances">
            <Card>
              <CardContent className="pt-6">
                {financials && financials.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-primary">${totalRevenue.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Expenses</p>
                        <p className="text-2xl font-bold text-destructive">${totalExpenses.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Recent Transactions</h4>
                      {financials.slice(0, 10).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium capitalize">{tx.transaction_type.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{tx.description || 'No description'}</p>
                          </div>
                          <span className={tx.amount >= 0 ? 'text-primary' : 'text-destructive'}>
                            {tx.amount >= 0 ? '+' : ''}${tx.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm">Revenue will appear here once events are hosted</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </VipGate>
  );
}