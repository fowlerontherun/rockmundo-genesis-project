import { useMemo, useState } from "react";
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
import { toast } from "sonner";
import { CheckCircle2, HandCoins, Info, ShieldOff } from "lucide-react";

interface SponsorshipOffer {
  id: string;
  brand: string;
  category: string;
  region: string;
  value: number;
  term: number;
  fitScore: number;
  exclusivity: "exclusive" | "shared";
  status: "pending" | "approved" | "declined";
  notes: string;
}

interface SponsorshipContract {
  id: string;
  brand: string;
  category: string;
  region: string;
  value: number;
  term: number;
  startMonth: string;
  status: "active" | "terminating" | "terminated";
  deliverables: string[];
  health: number;
}

const initialOffers: SponsorshipOffer[] = [
  {
    id: "volt-title",
    brand: "Volt Cola",
    category: "Beverage",
    region: "North America",
    value: 180000,
    term: 12,
    fitScore: 88,
    exclusivity: "exclusive",
    status: "pending",
    notes: "Title sponsorship for 30-city tour, includes experiential activations",
  },
  {
    id: "aurora-stream",
    brand: "Aurora Tech",
    category: "Technology",
    region: "Europe",
    value: 95000,
    term: 9,
    fitScore: 76,
    exclusivity: "shared",
    status: "pending",
    notes: "Hybrid live/streaming package with device giveaways",
  },
  {
    id: "ember-story",
    brand: "Ember Studios",
    category: "Media",
    region: "APAC",
    value: 42000,
    term: 6,
    fitScore: 64,
    exclusivity: "shared",
    status: "declined",
    notes: "Short film collaboration for festival circuit",
  },
];

const initialContracts: SponsorshipContract[] = [
  {
    id: "pulse-venues",
    brand: "Pulse Energy",
    category: "Beverage",
    region: "Latin America",
    value: 120000,
    term: 10,
    startMonth: "March",
    status: "active",
    deliverables: ["Venue signage", "Sampling tents", "Weekly sentiment reporting"],
    health: 78,
  },
  {
    id: "skyline-fest",
    brand: "Skyline Air",
    category: "Travel",
    region: "Europe",
    value: 210000,
    term: 14,
    startMonth: "January",
    status: "active",
    deliverables: ["Flight blocks", "VIP lounge build", "Quarterly co-marketing"],
    health: 84,
  },
  {
    id: "ember-cinematic",
    brand: "Ember Studios",
    category: "Media",
    region: "APAC",
    value: 68000,
    term: 6,
    startMonth: "April",
    status: "terminating",
    deliverables: ["Trailer assets", "Social boosts", "Behind-the-scenes doc"],
    health: 52,
  },
];

const valueLabel = (value: number) => `$${value.toLocaleString()}`;

const statusBadge = {
  pending: "secondary",
  approved: "default",
  declined: "destructive",
  active: "default",
  terminating: "secondary",
  terminated: "outline",
} as const;

const Sponsorships = () => {
  const [offers, setOffers] = useState<SponsorshipOffer[]>(initialOffers);
  const [contracts, setContracts] = useState<SponsorshipContract[]>(initialContracts);
  const [offerFilters, setOfferFilters] = useState({ search: "", region: "all", category: "all", status: "all" });
  const [contractFilters, setContractFilters] = useState({ region: "all", category: "all", status: "all" });
  const [selectedOffer, setSelectedOffer] = useState<SponsorshipOffer | null>(null);
  const [selectedContract, setSelectedContract] = useState<SponsorshipContract | null>(null);

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      const matchesSearch = offer.brand.toLowerCase().includes(offerFilters.search.toLowerCase());
      const matchesRegion = offerFilters.region === "all" || offer.region === offerFilters.region;
      const matchesCategory = offerFilters.category === "all" || offer.category === offerFilters.category;
      const matchesStatus = offerFilters.status === "all" || offer.status === offerFilters.status;
      return matchesSearch && matchesRegion && matchesCategory && matchesStatus;
    });
  }, [offers, offerFilters]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesRegion = contractFilters.region === "all" || contract.region === contractFilters.region;
      const matchesCategory = contractFilters.category === "all" || contract.category === contractFilters.category;
      const matchesStatus = contractFilters.status === "all" || contract.status === contractFilters.status;
      return matchesRegion && matchesCategory && matchesStatus;
    });
  }, [contracts, contractFilters]);

  const approveOffer = (offer: SponsorshipOffer) => {
    setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: "approved" } : o)));
    setContracts((prev) => {
      if (prev.some((c) => c.id === offer.id)) return prev;
      const newContract: SponsorshipContract = {
        id: offer.id,
        brand: offer.brand,
        category: offer.category,
        region: offer.region,
        value: offer.value,
        term: offer.term,
        startMonth: "Pending start",
        status: "active",
        deliverables: ["Activation plan pending", "Reporting cadence pending"],
        health: 70,
      };
      return [newContract, ...prev];
    });
    toast.success("Offer approved and promoted to active contracts");
  };

  const terminateContract = (contractId: string) => {
    setContracts((prev) => prev.map((contract) => (contract.id === contractId ? { ...contract, status: "terminated" } : contract)));
    toast("Contract terminated");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sponsorship Dashboards</h1>
          <p className="text-muted-foreground">
            Evaluate sponsorship offers, promote approvals, and track active contracts.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">Realtime sandbox</Badge>
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="contracts">Active contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Offer filters</CardTitle>
              <CardDescription>Slice the offer backlog by fit, region, and status.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
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
                <Label>Region</Label>
                <Select
                  value={offerFilters.region}
                  onValueChange={(value) => setOfferFilters((prev) => ({ ...prev, region: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="North America">North America</SelectItem>
                    <SelectItem value="Europe">Europe</SelectItem>
                    <SelectItem value="Latin America">Latin America</SelectItem>
                    <SelectItem value="APAC">APAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={offerFilters.category}
                  onValueChange={(value) => setOfferFilters((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Beverage">Beverage</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offer queue</CardTitle>
              <CardDescription>Approve promising packages or review the details first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Fit</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffers.map((offer) => (
                      <TableRow key={offer.id}>
                        <TableCell className="font-semibold">{offer.brand}</TableCell>
                        <TableCell>{valueLabel(offer.value)}</TableCell>
                        <TableCell>{offer.term} mo</TableCell>
                        <TableCell>
                          <Badge variant={offer.fitScore >= 80 ? "default" : "secondary"}>{offer.fitScore}% fit</Badge>
                        </TableCell>
                        <TableCell>{offer.region}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadge[offer.status]} className="capitalize">
                            {offer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelectedOffer(offer)}>
                            <Info className="mr-1 h-4 w-4" /> Details
                          </Button>
                          <Button
                            size="sm"
                            disabled={offer.status !== "pending"}
                            onClick={() => approveOffer(offer)}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredOffers.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">No offers match the current filters.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contract filters</CardTitle>
              <CardDescription>Zero in on active deals that need attention.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={contractFilters.region}
                  onValueChange={(value) => setContractFilters((prev) => ({ ...prev, region: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="North America">North America</SelectItem>
                    <SelectItem value="Europe">Europe</SelectItem>
                    <SelectItem value="Latin America">Latin America</SelectItem>
                    <SelectItem value="APAC">APAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={contractFilters.category}
                  onValueChange={(value) => setContractFilters((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Beverage">Beverage</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="terminating">Terminating</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active contracts</CardTitle>
              <CardDescription>Track fulfilment, health, and terminate underperforming deals.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-semibold">{contract.brand}</TableCell>
                        <TableCell>{valueLabel(contract.value)}</TableCell>
                        <TableCell>{contract.term} mo</TableCell>
                        <TableCell>
                          <Badge variant={contract.health >= 80 ? "default" : contract.health >= 60 ? "secondary" : "destructive"}>
                            {contract.health}%
                          </Badge>
                        </TableCell>
                        <TableCell>{contract.startMonth}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadge[contract.status]} className="capitalize">
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
                            disabled={contract.status === "terminated"}
                            onClick={() => terminateContract(contract.id)}
                          >
                            <ShieldOff className="mr-1 h-4 w-4" /> Terminate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredContracts.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">No contracts match the current filters.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedOffer)} onOpenChange={() => setSelectedOffer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Offer details</DialogTitle>
            <DialogDescription>{selectedOffer?.brand}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Value</span>
              <span className="font-semibold">{selectedOffer ? valueLabel(selectedOffer.value) : ""}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Term</span>
              <span className="font-semibold">{selectedOffer?.term} months</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Exclusivity</span>
              <Badge variant="outline" className="capitalize">{selectedOffer?.exclusivity}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fit score</span>
              <Badge>{selectedOffer?.fitScore}%</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm leading-relaxed">{selectedOffer?.notes}</p>
            </div>
            {selectedOffer && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedOffer(null)}>
                  Close
                </Button>
                <Button onClick={() => approveOffer(selectedOffer)} disabled={selectedOffer.status !== "pending"}>
                  <HandCoins className="mr-1 h-4 w-4" /> Approve
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedContract)} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contract details</DialogTitle>
            <DialogDescription>{selectedContract?.brand}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[320px] pr-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Value</span>
                <span className="font-semibold">{selectedContract ? valueLabel(selectedContract.value) : ""}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Term</span>
                <span className="font-semibold">{selectedContract?.term} months</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Start</span>
                <span className="font-semibold">{selectedContract?.startMonth}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Health</span>
                <Badge>{selectedContract?.health}%</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Deliverables</p>
                <ul className="mt-2 list-disc pl-4">
                  {selectedContract?.deliverables.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollArea>
          {selectedContract && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedContract(null)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => terminateContract(selectedContract.id)}
                disabled={selectedContract.status === "terminated"}
              >
                <ShieldOff className="mr-1 h-4 w-4" /> Terminate contract
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sponsorships;
