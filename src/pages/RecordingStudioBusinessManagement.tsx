import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mic, Users, Package, Wrench, DollarSign, MapPin, Star } from "lucide-react";
import { VipGate } from "@/components/company/VipGate";
import { 
  useRecordingStudioStaff, 
  useRecordingStudioTransactions,
  useRecordingStudioEquipment,
  useRecordingStudioUpgrades 
} from "@/hooks/useRecordingStudioBusiness";
import { 
  RecordingStudioEquipmentManager, 
  RecordingStudioUpgradesManager 
} from "@/components/recording-studio-business";
import { supabase } from "@/integrations/supabase/client";

export default function RecordingStudioBusinessManagement() {
  const { studioId } = useParams();
  const navigate = useNavigate();
  
  // Try to fetch studio by ID first, then by company_id if it's a company's studio
  const { data: studio, isLoading: studioLoading } = useQuery({
    queryKey: ['recording-studio-business', studioId],
    queryFn: async () => {
      if (!studioId) return null;
      
      // First try to find by studio ID
      let { data, error } = await supabase
        .from('city_studios')
        .select(`
          *,
          cities:city_id(name, country),
          city_districts:district_id(name),
          companies:company_id(name)
        `)
        .eq('id', studioId)
        .single();
      
      // If not found, try to find by company_id
      if (error || !data) {
        const { data: studioByCompany, error: companyError } = await supabase
          .from('city_studios')
          .select(`
            *,
            cities:city_id(name, country),
            city_districts:district_id(name),
            companies:company_id(name)
          `)
          .eq('company_id', studioId)
          .single();
        
        if (companyError) throw companyError;
        return studioByCompany;
      }
      
      return data;
    },
    enabled: !!studioId,
  });

  const actualStudioId = studio?.id;

  const { data: staff } = useRecordingStudioStaff(actualStudioId);
  const { data: transactions } = useRecordingStudioTransactions(actualStudioId);
  const { data: equipment } = useRecordingStudioEquipment(actualStudioId);
  const { data: upgrades } = useRecordingStudioUpgrades(actualStudioId);

  // Calculate stats
  const totalRevenue = transactions?.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalExpenses = transactions?.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
  const totalEquipmentValue = equipment?.reduce((sum, e) => sum + e.value, 0) || 0;
  
  if (studioLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!studio) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Mic className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Recording Studio Not Found</h2>
          <p className="text-muted-foreground mb-4">The studio you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }
  
  return (
    <VipGate feature="Recording Studio Business" description="Manage your recording studio, engineers, gear, and session bookings.">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mic className="h-6 w-6" />
              {studio.name}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {studio.cities?.name}, {studio.cities?.country}
              <Badge variant="outline" className="ml-2">Quality: {studio.quality_rating}/100</Badge>
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Hourly Rate</p>
              <p className="text-xl font-bold">${studio.hourly_rate}</p>
              <p className="text-xs text-muted-foreground mt-1">per session hour</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Staff</p>
              <p className="text-xl font-bold">{staff?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">engineers & crew</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Gear Value</p>
              <p className="text-xl font-bold">${totalEquipmentValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{equipment?.length || 0} items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Sessions</p>
              <p className="text-xl font-bold">{studio.total_sessions || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-xl font-bold text-primary">${(studio.total_revenue || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">lifetime</p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="staff" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Engineers</span>
            </TabsTrigger>
            <TabsTrigger value="gear" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Gear</span>
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
                {staff && staff.length > 0 ? (
                  <div className="space-y-3">
                    {staff.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {member.role.replace(/_/g, ' ')}
                            {member.specialty && ` • ${member.specialty}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">Skill: {member.skill_level}%</Badge>
                          <span className="text-sm">${member.salary}/wk</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No engineers hired yet</p>
                    <p className="text-sm">Hire sound engineers to improve session quality</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="gear">
            {actualStudioId ? (
              <RecordingStudioEquipmentManager studioId={actualStudioId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground py-8">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Studio not loaded</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="upgrades">
            {actualStudioId ? (
              <RecordingStudioUpgradesManager studioId={actualStudioId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground py-8">
                    <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Studio not loaded</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="finances">
            <Card>
              <CardContent className="pt-6">
                {transactions && transactions.length > 0 ? (
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
                      {transactions.slice(0, 10).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium capitalize">{tx.transaction_type.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{tx.description || tx.band_name || 'No description'}</p>
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
                    <p className="text-sm">Revenue will appear here once bands book sessions</p>
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