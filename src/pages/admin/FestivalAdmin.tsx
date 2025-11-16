import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Music2, Calendar, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFestivalSlotApplications } from "@/hooks/useFestivalSlotApplications";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FestivalAdmin() {
  const navigate = useNavigate();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [offeredPayment, setOfferedPayment] = useState("");

  const { data: festivals } = useQuery({
    queryKey: ["admin-festivals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festivals")
        .select(`
          *,
          city:cities(name, country)
        `)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { applications, reviewApplication, isReviewing } = useFestivalSlotApplications();

  const playerCreatedFestivals = festivals?.filter(f => !f.created_by_admin);
  const adminCreatedFestivals = festivals?.filter(f => f.created_by_admin);

  const pendingApplications = applications?.filter(a => a.status === "pending");
  const reviewedApplications = applications?.filter(a => a.status !== "pending");

  const handleReview = (status: "accepted" | "rejected") => {
    if (!selectedApplication) return;
    
    reviewApplication({
      applicationId: selectedApplication.id,
      status,
      adminNotes: adminNotes || undefined,
      offeredPayment: offeredPayment ? parseFloat(offeredPayment) : undefined,
    });

    setReviewDialogOpen(false);
    setSelectedApplication(null);
    setAdminNotes("");
    setOfferedPayment("");
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Festival Applications</h1>
            <p className="text-muted-foreground">
              Review slot submissions and moderate player-created festivals
            </p>
          </div>
        </div>

        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="applications">
              <Users className="h-4 w-4 mr-2" />
              Applications ({pendingApplications?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="player-festivals">
              <Music2 className="h-4 w-4 mr-2" />
              Player Festivals ({playerCreatedFestivals?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="admin-festivals">
              <Calendar className="h-4 w-4 mr-2" />
              Admin Festivals ({adminCreatedFestivals?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="reviewed">
              <CheckCircle className="h-4 w-4 mr-2" />
              Reviewed ({reviewedApplications?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Applications</CardTitle>
                <CardDescription>Review and approve/reject band applications</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingApplications && pendingApplications.length > 0 ? (
                  <div className="space-y-4">
                    {pendingApplications.map((app) => (
                      <Card key={app.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{app.band?.name}</h3>
                                <Badge variant="outline">{app.band?.genre}</Badge>
                                <Badge>{app.slot_type}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Festival: {app.festival?.name}
                              </p>
                              {app.application_message && (
                                <p className="text-sm mt-2">{app.application_message}</p>
                              )}
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Fame: {app.band?.fame || 0}</span>
                                {app.preferred_date && (
                                  <span>Preferred: {new Date(app.preferred_date).toLocaleDateString()}</span>
                                )}
                                {app.setlist && <span>Setlist: {app.setlist.name}</span>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedApplication(app);
                                  setReviewDialogOpen(true);
                                }}
                              >
                                Review
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No pending applications</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="player-festivals">
            <Card>
              <CardHeader>
                <CardTitle>Player-Created Festivals</CardTitle>
                <CardDescription>Review and moderate player-created festivals</CardDescription>
              </CardHeader>
              <CardContent>
                {playerCreatedFestivals && playerCreatedFestivals.length > 0 ? (
                  <div className="space-y-4">
                    {playerCreatedFestivals.map((festival) => (
                      <Card key={festival.id}>
                        <CardContent className="pt-6">
                          <h3 className="font-semibold">{festival.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {festival.city?.name}, {festival.city?.country}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(festival.start_date).toLocaleDateString()} - {new Date(festival.end_date).toLocaleDateString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No player-created festivals</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin-festivals">
            <Card>
              <CardHeader>
                <CardTitle>Admin-Created Festivals</CardTitle>
                <CardDescription>Manage admin-created festival events</CardDescription>
              </CardHeader>
              <CardContent>
                {adminCreatedFestivals && adminCreatedFestivals.length > 0 ? (
                  <div className="space-y-4">
                    {adminCreatedFestivals.map((festival) => (
                      <Card key={festival.id}>
                        <CardContent className="pt-6">
                          <h3 className="font-semibold">{festival.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {festival.city?.name}, {festival.city?.country}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No admin festivals yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviewed">
            <Card>
              <CardHeader>
                <CardTitle>Reviewed Applications</CardTitle>
                <CardDescription>Previously reviewed applications</CardDescription>
              </CardHeader>
              <CardContent>
                {reviewedApplications && reviewedApplications.length > 0 ? (
                  <div className="space-y-4">
                    {reviewedApplications.map((app) => (
                      <Card key={app.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">{app.band?.name}</h3>
                              <p className="text-sm text-muted-foreground">{app.festival?.name}</p>
                            </div>
                            <Badge variant={app.status === "accepted" ? "default" : "destructive"}>
                              {app.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No reviewed applications</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedApplication && (
                <>
                  <div>
                    <p className="font-semibold">{selectedApplication.band?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedApplication.festival?.name}</p>
                  </div>

                  <div>
                    <Label htmlFor="payment">Offered Payment</Label>
                    <Input
                      id="payment"
                      type="number"
                      value={offeredPayment}
                      onChange={(e) => setOfferedPayment(e.target.value)}
                      placeholder="Enter payment amount"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Admin Notes</Label>
                    <Textarea
                      id="notes"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about this decision..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleReview("accepted")}
                      disabled={isReviewing}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      onClick={() => handleReview("rejected")}
                      disabled={isReviewing}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}
