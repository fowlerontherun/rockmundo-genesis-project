import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, HandCoins, Info, ShieldOff, Calendar, DollarSign } from "lucide-react";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import {
  fetchSponsorshipOffers,
  fetchSponsorshipContracts,
  fetchContractPayments,
  acceptOffer,
  rejectOffer,
  terminateContract,
  type SponsorshipOffer,
  type SponsorshipContract,
  type SponsorshipPayment,
} from "@/lib/api/sponsorships";

const valueLabel = (value: number) => `$${value.toLocaleString()}`;

const statusBadge = {
  pending: "secondary",
  accepted: "default",
  declined: "destructive",
  expired: "outline",
  active: "default",
  completed: "secondary",
  terminated: "destructive",
} as const;

const Sponsorships = () => {
  const { data: primaryBandRecord } = usePrimaryBand();
  const activeBand = primaryBandRecord?.bands;
  const queryClient = useQueryClient();
  
  const [offerFilters, setOfferFilters] = useState({ search: "", status: "all" });
  const [contractFilters, setContractFilters] = useState({ status: "all" });
  const [selectedOffer, setSelectedOffer] = useState<SponsorshipOffer | null>(null);
  const [selectedContract, setSelectedContract] = useState<SponsorshipContract | null>(null);

  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ['sponsorship-offers', activeBand?.id],
    queryFn: () => fetchSponsorshipOffers(activeBand!.id),
    enabled: !!activeBand?.id,
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['sponsorship-contracts', activeBand?.id],
    queryFn: () => fetchSponsorshipContracts(activeBand!.id),
    enabled: !!activeBand?.id,
  });

  const { data: selectedContractPayments = [] } = useQuery({
    queryKey: ['sponsorship-payments', selectedContract?.id],
    queryFn: () => fetchContractPayments(selectedContract!.id),
    enabled: !!selectedContract?.id,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsorship-offers'] });
      queryClient.invalidateQueries({ queryKey: ['sponsorship-contracts'] });
      toast.success("Offer accepted! Weekly payments will begin.");
      setSelectedOffer(null);
    },
    onError: (error) => {
      toast.error(`Failed to accept offer: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsorship-offers'] });
      toast.success("Offer declined");
      setSelectedOffer(null);
    },
  });

  const terminateMutation = useMutation({
    mutationFn: terminateContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsorship-contracts'] });
      toast.success("Contract terminated");
      setSelectedContract(null);
    },
  });

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      const matchesSearch = offer.brand?.name?.toLowerCase().includes(offerFilters.search.toLowerCase()) ?? true;
      const matchesStatus = offerFilters.status === "all" || offer.status === offerFilters.status;
      return matchesSearch && matchesStatus;
    });
  }, [offers, offerFilters]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesStatus = contractFilters.status === "all" || contract.status === contractFilters.status;
      return matchesStatus;
    });
  }, [contracts, contractFilters]);

  if (!activeBand) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a band to view sponsorships.</p>
      </div>
    );
  }

  const pendingOffers = offers.filter(o => o.status === 'pending');
  const activeContracts = contracts.filter(c => c.status === 'active');
  const totalContractValue = activeContracts.reduce((sum, c) => sum + c.total_value, 0);
  const totalPaidOut = activeContracts.reduce((sum, c) => sum + c.total_paid, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sponsorship Dashboard</h1>
          <p className="text-muted-foreground">
            Manage sponsorship offers and track active contracts for {activeBand.name}.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOffers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContracts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{valueLabel(totalContractValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{valueLabel(totalPaidOut)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
          <TabsTrigger value="contracts">Contracts ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Offer Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="offer-search">Search</Label>
                <Input
                  id="offer-search"
                  placeholder="Brand name"
                  value={offerFilters.search}
                  onChange={(e) => setOfferFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={offerFilters.status}
                  onValueChange={(value) => setOfferFilters((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sponsorship Offers</CardTitle>
              <CardDescription>Review and respond to sponsorship offers.</CardDescription>
            </CardHeader>
            <CardContent>
              {offersLoading ? (
                <p className="text-muted-foreground">Loading offers...</p>
              ) : filteredOffers.length === 0 ? (
                <p className="text-muted-foreground">No sponsorship offers available.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brand</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Weekly</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Fit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOffers.map((offer) => {
                        const weeklyPayment = Math.floor(offer.total_value / offer.term_weeks);
                        return (
                          <TableRow key={offer.id}>
                            <TableCell className="font-semibold">{offer.brand?.name || 'Unknown'}</TableCell>
                            <TableCell>{valueLabel(offer.total_value)}</TableCell>
                            <TableCell className="text-green-600">{valueLabel(weeklyPayment)}/wk</TableCell>
                            <TableCell>{offer.term_weeks} weeks</TableCell>
                            <TableCell>
                              <Badge variant={offer.fit_score >= 80 ? "default" : "secondary"}>
                                {offer.fit_score}% fit
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadge[offer.status as keyof typeof statusBadge] || "outline"} className="capitalize">
                                {offer.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="space-x-2 text-right">
                              <Button variant="outline" size="sm" onClick={() => setSelectedOffer(offer)}>
                                <Info className="mr-1 h-4 w-4" /> Details
                              </Button>
                              <Button
                                size="sm"
                                disabled={offer.status !== "pending" || acceptMutation.isPending}
                                onClick={() => acceptMutation.mutate(offer.id)}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" /> Accept
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contract Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={contractFilters.status}
                  onValueChange={(value) => setContractFilters((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Contracts</CardTitle>
              <CardDescription>Track fulfillment and payment progress.</CardDescription>
            </CardHeader>
            <CardContent>
              {contractsLoading ? (
                <p className="text-muted-foreground">Loading contracts...</p>
              ) : filteredContracts.length === 0 ? (
                <p className="text-muted-foreground">No contracts found.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brand</TableHead>
                        <TableHead>Total Value</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map((contract) => {
                        const progressPercent = (contract.weeks_paid / contract.term_weeks) * 100;
                        return (
                          <TableRow key={contract.id}>
                            <TableCell className="font-semibold">{contract.brand?.name || 'Unknown'}</TableCell>
                            <TableCell>{valueLabel(contract.total_value)}</TableCell>
                            <TableCell className="text-green-600">{valueLabel(contract.total_paid)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={progressPercent} className="w-16 h-2" />
                                <span className="text-xs text-muted-foreground">
                                  {contract.weeks_paid}/{contract.term_weeks}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={contract.health >= 80 ? "default" : contract.health >= 60 ? "secondary" : "destructive"}>
                                {contract.health}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadge[contract.status as keyof typeof statusBadge] || "outline"} className="capitalize">
                                {contract.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="space-x-2 text-right">
                              <Button variant="outline" size="sm" onClick={() => setSelectedContract(contract)}>
                                <Info className="mr-1 h-4 w-4" /> Details
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={contract.status !== "active" || terminateMutation.isPending}
                                onClick={() => terminateMutation.mutate(contract.id)}
                              >
                                <ShieldOff className="mr-1 h-4 w-4" /> End
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Offer Details Dialog */}
      <Dialog open={Boolean(selectedOffer)} onOpenChange={() => setSelectedOffer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Offer Details</DialogTitle>
            <DialogDescription>{selectedOffer?.brand?.name}</DialogDescription>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Value</span>
                  <p className="font-semibold text-lg">{valueLabel(selectedOffer.total_value)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Weekly Payment</span>
                  <p className="font-semibold text-lg text-green-600">
                    {valueLabel(Math.floor(selectedOffer.total_value / selectedOffer.term_weeks))}/wk
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration</span>
                  <p className="font-semibold">{selectedOffer.term_weeks} weeks</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fit Score</span>
                  <p className="font-semibold">{selectedOffer.fit_score}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Exclusivity</span>
                  <Badge variant="outline">{selectedOffer.exclusivity ? 'Exclusive' : 'Non-exclusive'}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Category</span>
                  <p className="font-semibold">{selectedOffer.brand?.category || 'N/A'}</p>
                </div>
              </div>
              
              {selectedOffer.notes && (
                <div>
                  <span className="text-muted-foreground text-sm">Notes</span>
                  <p className="mt-1 text-sm">{selectedOffer.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedOffer(null)}>Close</Button>
                {selectedOffer.status === 'pending' && (
                  <>
                    <Button 
                      variant="destructive" 
                      onClick={() => rejectMutation.mutate(selectedOffer.id)}
                      disabled={rejectMutation.isPending}
                    >
                      Decline
                    </Button>
                    <Button 
                      onClick={() => acceptMutation.mutate(selectedOffer.id)}
                      disabled={acceptMutation.isPending}
                    >
                      <HandCoins className="mr-1 h-4 w-4" /> Accept
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract Details Dialog */}
      <Dialog open={Boolean(selectedContract)} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
            <DialogDescription>{selectedContract?.brand?.name}</DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Value</span>
                    <p className="font-semibold text-lg">{valueLabel(selectedContract.total_value)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid So Far</span>
                    <p className="font-semibold text-lg text-green-600">{valueLabel(selectedContract.total_paid)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Weekly Payment</span>
                    <p className="font-semibold">{valueLabel(selectedContract.weekly_payment)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remaining</span>
                    <p className="font-semibold">{valueLabel(selectedContract.total_value - selectedContract.total_paid)}</p>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground text-sm">Payment Progress</span>
                  <div className="mt-2">
                    <Progress value={(selectedContract.weeks_paid / selectedContract.term_weeks) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Week {selectedContract.weeks_paid} of {selectedContract.term_weeks}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Start Date</span>
                    <p className="font-semibold">{new Date(selectedContract.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End Date</span>
                    <p className="font-semibold">{new Date(selectedContract.end_date).toLocaleDateString()}</p>
                  </div>
                </div>

                {selectedContractPayments.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-sm">Payment History</span>
                    <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                      {selectedContractPayments.slice(0, 10).map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center text-sm py-1 border-b">
                          <span>Week {payment.week_number}</span>
                          <span className="font-medium">{valueLabel(payment.amount)}</span>
                          <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                            {payment.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSelectedContract(null)}>Close</Button>
                  {selectedContract.status === 'active' && (
                    <Button 
                      variant="destructive" 
                      onClick={() => terminateMutation.mutate(selectedContract.id)}
                      disabled={terminateMutation.isPending}
                    >
                      <ShieldOff className="mr-1 h-4 w-4" /> Terminate
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sponsorships;
