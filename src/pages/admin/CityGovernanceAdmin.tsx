import { useState, useEffect } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Vote, Calendar, UserPlus, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { format, addMonths } from "date-fns";

interface City {
  id: string;
  name: string;
  country: string;
}

interface Mayor {
  id: string;
  city_id: string;
  profile_id: string;
  term_start: string;
  term_end: string | null;
  is_current: boolean;
  approval_rating: number;
  policies_enacted: number;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  city?: {
    name: string;
    country: string;
  };
}

interface Election {
  id: string;
  city_id: string;
  election_year: number;
  status: string;
  nomination_start: string;
  nomination_end: string;
  voting_start: string;
  voting_end: string;
  total_votes: number;
  city?: {
    name: string;
    country: string;
  };
}

interface Profile {
  id: string;
  display_name: string | null;
  user_id: string;
}

const CityGovernanceAdmin = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [mayors, setMayors] = useState<Mayor[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Appoint Mayor Dialog
  const [appointDialogOpen, setAppointDialogOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [profileSearch, setProfileSearch] = useState("");
  
  // Trigger Election Dialog
  const [electionDialogOpen, setElectionDialogOpen] = useState(false);
  const [electionCity, setElectionCity] = useState<string>("");
  const [electionYear, setElectionYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cities
      const { data: citiesData } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("name");
      setCities(citiesData || []);

      // Fetch current mayors with their profiles
      const { data: mayorsData } = await supabase
        .from("city_mayors")
        .select("*")
        .eq("is_current", true)
        .order("term_start", { ascending: false });

      // Get profiles for mayors
      if (mayorsData && mayorsData.length > 0) {
        const profileIds = mayorsData.map(m => m.profile_id);
        const { data: mayorProfiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", profileIds);

        const cityIds = mayorsData.map(m => m.city_id);
        const { data: mayorCities } = await supabase
          .from("cities")
          .select("id, name, country")
          .in("id", cityIds);

        const enrichedMayors = mayorsData.map(m => ({
          ...m,
          profile: mayorProfiles?.find(p => p.id === m.profile_id),
          city: mayorCities?.find(c => c.id === m.city_id)
        }));
        setMayors(enrichedMayors);
      } else {
        setMayors([]);
      }

      // Fetch active elections
      const { data: electionsData } = await supabase
        .from("city_elections")
        .select("*")
        .in("status", ["nomination", "voting"])
        .order("election_year", { ascending: false });

      if (electionsData && electionsData.length > 0) {
        const electionCityIds = electionsData.map(e => e.city_id);
        const { data: electionCities } = await supabase
          .from("cities")
          .select("id, name, country")
          .in("id", electionCityIds);

        const enrichedElections = electionsData.map(e => ({
          ...e,
          city: electionCities?.find(c => c.id === e.city_id)
        }));
        setElections(enrichedElections);
      } else {
        setElections([]);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load governance data");
    } finally {
      setLoading(false);
    }
  };

  const searchProfiles = async (search: string) => {
    if (search.length < 2) {
      setProfiles([]);
      return;
    }
    
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, user_id")
      .ilike("display_name", `%${search}%`)
      .limit(20);
    
    setProfiles(data || []);
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchProfiles(profileSearch);
    }, 300);
    return () => clearTimeout(debounce);
  }, [profileSearch]);

  const appointMayor = async () => {
    if (!selectedCity || !selectedProfile) {
      toast.error("Please select a city and profile");
      return;
    }

    setSubmitting(true);
    try {
      // End current mayor term if exists
      await supabase
        .from("city_mayors")
        .update({ 
          is_current: false, 
          term_end: new Date().toISOString() 
        })
        .eq("city_id", selectedCity)
        .eq("is_current", true);

      // Create new mayor record
      const termStart = new Date();
      const termEnd = addMonths(termStart, 12); // 1 year term

      const { error } = await supabase
        .from("city_mayors")
        .insert({
          city_id: selectedCity,
          profile_id: selectedProfile,
          term_start: termStart.toISOString(),
          term_end: termEnd.toISOString(),
          is_current: true,
          approval_rating: 50,
          policies_enacted: 0
        });

      if (error) throw error;

      toast.success("Mayor appointed successfully!");
      setAppointDialogOpen(false);
      setSelectedCity("");
      setSelectedProfile("");
      setProfileSearch("");
      fetchData();
    } catch (error) {
      console.error("Error appointing mayor:", error);
      toast.error("Failed to appoint mayor");
    } finally {
      setSubmitting(false);
    }
  };

  const triggerElection = async () => {
    if (!electionCity) {
      toast.error("Please select a city");
      return;
    }

    setSubmitting(true);
    try {
      // Check if election already exists for this city/year
      const { data: existing } = await supabase
        .from("city_elections")
        .select("id")
        .eq("city_id", electionCity)
        .eq("election_year", electionYear)
        .maybeSingle();

      if (existing) {
        toast.error("An election already exists for this city and year");
        setSubmitting(false);
        return;
      }

      // Create election with nomination phase
      const now = new Date();
      const nominationEnd = addMonths(now, 1);
      const votingStart = nominationEnd;
      const votingEnd = addMonths(votingStart, 1);

      const { error } = await supabase
        .from("city_elections")
        .insert({
          city_id: electionCity,
          election_year: electionYear,
          status: "nomination",
          nomination_start: now.toISOString(),
          nomination_end: nominationEnd.toISOString(),
          voting_start: votingStart.toISOString(),
          voting_end: votingEnd.toISOString(),
          total_votes: 0
        });

      if (error) throw error;

      toast.success("Election triggered successfully!");
      setElectionDialogOpen(false);
      setElectionCity("");
      fetchData();
    } catch (error) {
      console.error("Error triggering election:", error);
      toast.error("Failed to trigger election");
    } finally {
      setSubmitting(false);
    }
  };

  const advanceElectionPhase = async (electionId: string, currentStatus: string) => {
    let newStatus: string;
    
    if (currentStatus === "nomination") {
      newStatus = "voting";
    } else if (currentStatus === "voting") {
      newStatus = "completed";
    } else {
      toast.error("Cannot advance from this phase");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("city_elections")
        .update({ status: newStatus as "nomination" | "voting" | "completed" | "cancelled" })
        .eq("id", electionId);

      if (error) throw error;

      toast.success(`Election advanced to ${newStatus} phase`);
      fetchData();
    } catch (error) {
      console.error("Error advancing election:", error);
      toast.error("Failed to advance election");
    } finally {
      setSubmitting(false);
    }
  };

  const removeMayor = async (mayorId: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("city_mayors")
        .update({ 
          is_current: false, 
          term_end: new Date().toISOString() 
        })
        .eq("id", mayorId);

      if (error) throw error;

      toast.success("Mayor removed from office");
      fetchData();
    } catch (error) {
      console.error("Error removing mayor:", error);
      toast.error("Failed to remove mayor");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminRoute>
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">City Governance</h1>
              <p className="text-muted-foreground text-sm">Manage mayors and elections</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={appointDialogOpen} onOpenChange={setAppointDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Appoint Mayor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Appoint Mayor</DialogTitle>
                  <DialogDescription>
                    Directly appoint a player as mayor of a city. This will end the current mayor's term.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Select value={selectedCity} onValueChange={setSelectedCity}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(city => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}, {city.country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Search Player</Label>
                    <Input
                      placeholder="Search by stage name..."
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                    />
                    {profiles.length > 0 && (
                      <div className="border rounded-md max-h-40 overflow-y-auto">
                        {profiles.map(profile => (
                          <button
                            key={profile.id}
                            className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
                              selectedProfile === profile.id ? "bg-primary/10" : ""
                            }`}
                            onClick={() => setSelectedProfile(profile.id)}
                          >
                            {profile.display_name || "Unknown"}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedProfile && (
                      <Badge variant="secondary">
                        Selected: {profiles.find(p => p.id === selectedProfile)?.display_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAppointDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={appointMayor} disabled={submitting || !selectedCity || !selectedProfile}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Appoint
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={electionDialogOpen} onOpenChange={setElectionDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Vote className="h-4 w-4 mr-2" />
                  Trigger Election
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Trigger Election</DialogTitle>
                  <DialogDescription>
                    Start a new mayoral election in a city. The election will begin in the nomination phase.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Select value={electionCity} onValueChange={setElectionCity}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(city => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}, {city.country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Election Year</Label>
                    <Input
                      type="number"
                      value={electionYear}
                      onChange={(e) => setElectionYear(parseInt(e.target.value))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setElectionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={triggerElection} disabled={submitting || !electionCity}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Trigger Election
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="mayors" className="w-full">
          <TabsList>
            <TabsTrigger value="mayors" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Current Mayors ({mayors.length})
            </TabsTrigger>
            <TabsTrigger value="elections" className="flex items-center gap-2">
              <Vote className="h-4 w-4" />
              Active Elections ({elections.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mayors" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Mayors</CardTitle>
                <CardDescription>All cities with an active mayor</CardDescription>
              </CardHeader>
              <CardContent>
                {mayors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No mayors currently in office</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead>Mayor</TableHead>
                        <TableHead>Term Start</TableHead>
                        <TableHead>Term End</TableHead>
                        <TableHead>Approval</TableHead>
                        <TableHead>Policies</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mayors.map(mayor => (
                        <TableRow key={mayor.id}>
                          <TableCell className="font-medium">
                            {mayor.city?.name || "Unknown"}
                            <span className="text-muted-foreground text-xs ml-1">
                              {mayor.city?.country}
                            </span>
                          </TableCell>
                          <TableCell>{mayor.profile?.display_name || "Unknown"}</TableCell>
                          <TableCell>{format(new Date(mayor.term_start), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            {mayor.term_end ? format(new Date(mayor.term_end), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={mayor.approval_rating >= 50 ? "default" : "destructive"}>
                              {mayor.approval_rating}%
                            </Badge>
                          </TableCell>
                          <TableCell>{mayor.policies_enacted}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => removeMayor(mayor.id)}
                              disabled={submitting}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="elections" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Elections</CardTitle>
                <CardDescription>Elections currently in nomination or voting phase</CardDescription>
              </CardHeader>
              <CardContent>
                {elections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Vote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active elections</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Nomination Period</TableHead>
                        <TableHead>Voting Period</TableHead>
                        <TableHead>Votes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {elections.map(election => (
                        <TableRow key={election.id}>
                          <TableCell className="font-medium">
                            {election.city?.name || "Unknown"}
                            <span className="text-muted-foreground text-xs ml-1">
                              {election.city?.country}
                            </span>
                          </TableCell>
                          <TableCell>{election.election_year}</TableCell>
                          <TableCell>
                            <Badge variant={election.status === "voting" ? "default" : "secondary"}>
                              {election.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(election.nomination_start), "MMM d")} - {format(new Date(election.nomination_end), "MMM d")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(election.voting_start), "MMM d")} - {format(new Date(election.voting_end), "MMM d")}
                          </TableCell>
                          <TableCell>{election.total_votes}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => advanceElectionPhase(election.id, election.status)}
                              disabled={submitting}
                            >
                              {election.status === "nomination" ? "Start Voting" : "Complete"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default CityGovernanceAdmin;
