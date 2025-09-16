import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, DollarSign, TrendingUp, Calendar, Star, Music, FileText, Users } from "lucide-react";

const RecordLabel = () => {
  const { toast } = useToast();
  const [playerCash] = useState(50000);
  const [labelDeal, setLabelDeal] = useState(null);

  const labelOffers = [
    {
      id: 1,
      name: "Indie Rock Records",
      advance: 25000,
      royaltyRate: 15,
      albumCommitment: 2,
      reputation: "Good",
      benefits: ["Studio access", "Marketing support", "Distribution"],
      requirements: ["1000+ fans", "1 released single"]
    },
    {
      id: 2,
      name: "Major Sound Corp",
      advance: 100000,
      royaltyRate: 8,
      albumCommitment: 4,
      reputation: "Excellent",
      benefits: ["Full production", "Radio promotion", "Tour support", "Merchandising"],
      requirements: ["10000+ fans", "Chart performance", "Social media presence"]
    },
    {
      id: 3,
      name: "Underground Collective",
      advance: 5000,
      royaltyRate: 25,
      albumCommitment: 1,
      reputation: "Rising",
      benefits: ["Creative freedom", "Underground network", "Vinyl pressing"],
      requirements: ["Artistic integrity", "Alternative sound"]
    }
  ];

  const contracts = [
    {
      id: 1,
      venue: "Madison Square Garden",
      type: "Headline Show",
      payment: 50000,
      date: "Dec 15, 2024",
      status: "Pending",
      requirements: ["Sound check", "Merchandise booth", "Meet & greet"]
    },
    {
      id: 2,
      venue: "Coachella Festival",
      type: "Festival Slot",
      payment: 75000,
      date: "Apr 20, 2024",
      status: "Negotiating",
      requirements: ["45-minute set", "No competing festivals", "Technical rider"]
    }
  ];

  const handleSignDeal = (deal: any) => {
    setLabelDeal(deal);
    toast({
      title: "Contract Signed!",
      description: `Welcome to ${deal.name}! You received $${deal.advance.toLocaleString()} advance.`,
    });
  };

  const handleAcceptContract = (contract: any) => {
    toast({
      title: "Contract Accepted!",
      description: `${contract.venue} show confirmed for ${contract.date}`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            RECORD LABELS & CONTRACTS
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Secure deals and build your music empire
          </p>
          <div className="flex justify-center items-center gap-4 text-cream">
            <DollarSign className="h-6 w-6" />
            <span className="text-2xl font-bold">${playerCash.toLocaleString()}</span>
          </div>
        </div>

        <Tabs defaultValue="labels" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="labels">Record Labels</TabsTrigger>
            <TabsTrigger value="contracts">Gig Contracts</TabsTrigger>
            <TabsTrigger value="royalties">Royalties</TabsTrigger>
          </TabsList>

          <TabsContent value="labels" className="space-y-6">
            {labelDeal && (
              <Card className="bg-secondary/20 border-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-cream">
                    <Building2 className="h-5 w-5" />
                    Current Label Deal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-cream font-semibold text-lg">{labelDeal.name}</span>
                      <Badge variant="secondary">{labelDeal.reputation}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-cream/60">Royalty Rate</p>
                        <p className="text-2xl font-bold text-accent">{labelDeal.royaltyRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-cream/60">Albums Left</p>
                        <p className="text-2xl font-bold text-accent">{labelDeal.albumCommitment}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-cream/60">Advance Received</p>
                        <p className="text-2xl font-bold text-accent">${labelDeal.advance.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {labelOffers.map((label) => (
                <Card key={label.id} className="bg-card/80 border-accent hover:bg-card/90 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-cream">{label.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary">{label.reputation}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-cream/60 text-sm">Advance</p>
                        <p className="text-xl font-bold text-accent">${label.advance.toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-cream/60 text-sm">Royalty Rate</p>
                        <p className="text-xl font-bold text-accent">{label.royaltyRate}%</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-cream/60 text-sm">Album Commitment</p>
                        <p className="text-xl font-bold text-accent">{label.albumCommitment} albums</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-cream/60 text-sm">Benefits</p>
                      <div className="flex flex-wrap gap-1">
                        {label.benefits.map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-cream/60 text-sm">Requirements</p>
                      <ul className="text-sm text-cream/80 space-y-1">
                        {label.requirements.map((req, index) => (
                          <li key={index}>• {req}</li>
                        ))}
                      </ul>
                    </div>

                    <Button 
                      onClick={() => handleSignDeal(label)}
                      className="w-full bg-accent hover:bg-accent/80 text-background font-bold"
                      disabled={!!labelDeal}
                    >
                      {labelDeal ? "Already Signed" : "Sign Contract"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6">
            <div className="grid gap-6">
              {contracts.map((contract) => (
                <Card key={contract.id} className="bg-card/80 border-accent">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-cream">{contract.venue}</CardTitle>
                        <CardDescription>{contract.type}</CardDescription>
                      </div>
                      <Badge 
                        variant={contract.status === 'Pending' ? 'secondary' : 'outline'}
                      >
                        {contract.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-cream/60">
                          <DollarSign className="h-4 w-4" />
                          <span>Payment</span>
                        </div>
                        <p className="text-2xl font-bold text-accent">${contract.payment.toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-cream/60">
                          <Calendar className="h-4 w-4" />
                          <span>Date</span>
                        </div>
                        <p className="text-lg text-cream">{contract.date}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-cream/60">
                          <FileText className="h-4 w-4" />
                          <span>Requirements</span>
                        </div>
                        <ul className="text-sm text-cream/80 space-y-1">
                          {contract.requirements.map((req, index) => (
                            <li key={index}>• {req}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button 
                        onClick={() => handleAcceptContract(contract)}
                        className="bg-accent hover:bg-accent/80 text-background"
                        disabled={contract.status !== 'Pending'}
                      >
                        Accept Contract
                      </Button>
                      <Button variant="outline" className="border-accent text-accent hover:bg-accent/10">
                        Negotiate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="royalties" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">$12,450</div>
                  <p className="text-cream/60 text-sm">+23% from last month</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Streaming</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">$8,200</div>
                  <p className="text-cream/60 text-sm">2.4M plays</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Physical Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">$3,100</div>
                  <p className="text-cream/60 text-sm">820 units sold</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Radio Play</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">$1,150</div>
                  <p className="text-cream/60 text-sm">45 stations</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-cream">
                    <span>Streaming Revenue</span>
                    <span>66%</span>
                  </div>
                  <Progress value={66} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-cream">
                    <span>Physical Sales</span>
                    <span>25%</span>
                  </div>
                  <Progress value={25} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-cream">
                    <span>Radio & Performance</span>
                    <span>9%</span>
                  </div>
                  <Progress value={9} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RecordLabel;