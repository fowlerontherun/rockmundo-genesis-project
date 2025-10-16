import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, PlusCircle, Trash2, X } from "lucide-react";
import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const QUALITY_LABELS: Record<number, string> = {
  1: "Underground",
  2: "Neighborhood",
  3: "Boutique",
  4: "Premier",
  5: "Legendary",
};

type CityOption = {
  id: string;
  name: string;
};

type NightClubRow = {
  id: string;
  city_id: string;
  name: string | null;
  description: string | null;
  quality_level: number | null;
  capacity: number | null;
  cover_charge: number | null;
  guest_actions: unknown[] | null;
  drink_menu: unknown[] | null;
  npc_profiles: unknown[] | null;
  dj_slot_config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  city?: {
    name: string | null;
  } | null;
};

type GuestAction = {
  id: string;
  label: string;
  description: string;
  energyCost: number;
};

type Drink = {
  id: string;
  name: string;
  price: number;
  effect?: string;
};

type NPC = {
  id: string;
  name: string;
  role: string;
  personality: string;
  availability?: string;
  dialogueHooks?: string;
};

const NightClubsAdmin = () => {
  const { toast } = useToast();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [nightClubs, setNightClubs] = useState<NightClubRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClub, setEditingClub] = useState<NightClubRow | null>(null);
  const [deletingClubId, setDeletingClubId] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState("all");

  // Form state
  const [cityId, setCityId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [qualityLevel, setQualityLevel] = useState("3");
  const [capacity, setCapacity] = useState("");
  const [coverCharge, setCoverCharge] = useState("");
  const [liveInteractions, setLiveInteractions] = useState(true);

  // DJ Slot Config
  const [djMinFame, setDjMinFame] = useState("");
  const [djPayout, setDjPayout] = useState("");
  const [djSetLength, setDjSetLength] = useState("");
  const [djSchedule, setDjSchedule] = useState("");
  const [djPerks, setDjPerks] = useState<string[]>([]);
  const [newPerk, setNewPerk] = useState("");

  // Guest Actions
  const [guestActions, setGuestActions] = useState<GuestAction[]>([]);
  const [newAction, setNewAction] = useState<GuestAction>({
    id: "",
    label: "",
    description: "",
    energyCost: 5,
  });

  // Drinks
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [newDrink, setNewDrink] = useState<Drink>({
    id: "",
    name: "",
    price: 0,
    effect: "",
  });

  // NPCs
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [newNPC, setNewNPC] = useState<NPC>({
    id: "",
    name: "",
    role: "",
    personality: "",
    availability: "",
    dialogueHooks: "",
  });

  const fetchCities = useCallback(async () => {
    const { data, error } = await supabase
      .from("cities")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch cities", error);
      return;
    }

    setCities(
      (data ?? []).map((city) => ({
        id: city.id,
        name: city.name ?? "Unnamed city",
      })),
    );
  }, []);

  const fetchNightClubs = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("city_night_clubs")
      .select("*, city:cities(name)")
      .order("quality_level", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch night clubs", error);
      setIsLoading(false);
      return;
    }

    setNightClubs((data ?? []) as NightClubRow[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchCities();
    void fetchNightClubs();
  }, [fetchCities, fetchNightClubs]);

  const resetForm = useCallback(() => {
    setEditingClub(null);
    setCityId("");
    setName("");
    setDescription("");
    setQualityLevel("3");
    setCapacity("");
    setCoverCharge("");
    setLiveInteractions(true);
    setDjMinFame("");
    setDjPayout("");
    setDjSetLength("");
    setDjSchedule("");
    setDjPerks([]);
    setGuestActions([]);
    setDrinks([]);
    setNpcs([]);
  }, []);

  const handleEdit = useCallback((club: NightClubRow) => {
    setEditingClub(club);
    setCityId(club.city_id);
    setName(club.name ?? "");
    setDescription(club.description ?? "");
    setQualityLevel(club.quality_level ? `${club.quality_level}` : "3");
    setCapacity(club.capacity ? `${club.capacity}` : "");
    setCoverCharge(club.cover_charge ? `${club.cover_charge}` : "");

    const meta = club.metadata as Record<string, unknown> | null;
    setLiveInteractions(meta?.live_interactions_enabled !== false);

    const djConfig = club.dj_slot_config as Record<string, unknown> | null;
    if (djConfig) {
      setDjMinFame(djConfig.minimum_fame ? `${djConfig.minimum_fame}` : "");
      setDjPayout(djConfig.payout ? `${djConfig.payout}` : "");
      setDjSetLength(djConfig.set_length_minutes ? `${djConfig.set_length_minutes}` : "");
      setDjSchedule(djConfig.schedule ? `${djConfig.schedule}` : "");
      setDjPerks(Array.isArray(djConfig.perks) ? djConfig.perks as string[] : []);
    }

    setGuestActions(Array.isArray(club.guest_actions) ? club.guest_actions as GuestAction[] : []);
    setDrinks(Array.isArray(club.drink_menu) ? club.drink_menu as Drink[] : []);
    setNpcs(Array.isArray(club.npc_profiles) ? club.npc_profiles as NPC[] : []);
  }, []);

  const handleSubmit = async () => {
    if (!cityId || !name) {
      toast({
        title: "Validation error",
        description: "City and club name are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        city_id: cityId,
        name,
        description: description || null,
        quality_level: parseInt(qualityLevel),
        capacity: capacity ? parseInt(capacity) : null,
        cover_charge: coverCharge ? parseInt(coverCharge) : null,
        guest_actions: guestActions,
        drink_menu: drinks,
        npc_profiles: npcs,
        dj_slot_config: {
          minimum_fame: djMinFame ? parseInt(djMinFame) : undefined,
          payout: djPayout ? parseInt(djPayout) : undefined,
          set_length_minutes: djSetLength ? parseInt(djSetLength) : undefined,
          schedule: djSchedule || undefined,
          perks: djPerks,
        },
        metadata: {
          live_interactions_enabled: liveInteractions,
        },
      };

      if (editingClub) {
        const { error } = await supabase
          .from("city_night_clubs")
          .update(payload)
          .eq("id", editingClub.id);

        if (error) throw error;
        toast({
          title: "Night club updated",
          description: `${name} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase.from("city_night_clubs").insert(payload);
        if (error) throw error;
        toast({
          title: "Night club created",
          description: `${name} has been added to the city roster.`,
        });
      }

      resetForm();
      await fetchNightClubs();
    } catch (error) {
      console.error("Failed to save night club", error);
      toast({
        title: "Unable to save night club",
        description: "Please review the form fields or try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (clubId: string) => {
      setDeletingClubId(clubId);
      try {
        const { error } = await supabase.from("city_night_clubs").delete().eq("id", clubId);
        if (error) throw error;
        toast({
          title: "Night club removed",
          description: "The night club has been deleted.",
        });
        if (editingClub?.id === clubId) {
          resetForm();
        }
        await fetchNightClubs();
      } catch (error) {
        console.error("Failed to delete night club", error);
        toast({
          title: "Unable to delete night club",
          description: "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setDeletingClubId(null);
      }
    },
    [editingClub?.id, fetchNightClubs, resetForm, toast],
  );

  // Helper functions for managing arrays
  const addPerk = () => {
    if (newPerk.trim()) {
      setDjPerks([...djPerks, newPerk.trim()]);
      setNewPerk("");
    }
  };

  const removePerk = (index: number) => {
    setDjPerks(djPerks.filter((_, i) => i !== index));
  };

  const addGuestAction = () => {
    if (newAction.label && newAction.description) {
      setGuestActions([...guestActions, { ...newAction, id: `action-${Date.now()}` }]);
      setNewAction({ id: "", label: "", description: "", energyCost: 5 });
    }
  };

  const removeGuestAction = (index: number) => {
    setGuestActions(guestActions.filter((_, i) => i !== index));
  };

  const addDrink = () => {
    if (newDrink.name && newDrink.price > 0) {
      setDrinks([...drinks, { ...newDrink, id: `drink-${Date.now()}` }]);
      setNewDrink({ id: "", name: "", price: 0, effect: "" });
    }
  };

  const removeDrink = (index: number) => {
    setDrinks(drinks.filter((_, i) => i !== index));
  };

  const addNPC = () => {
    if (newNPC.name && newNPC.role) {
      setNpcs([...npcs, { ...newNPC, id: `npc-${Date.now()}` }]);
      setNewNPC({ id: "", name: "", role: "", personality: "", availability: "", dialogueHooks: "" });
    }
  };

  const removeNPC = (index: number) => {
    setNpcs(npcs.filter((_, i) => i !== index));
  };

  const filteredNightClubs = nightClubs.filter(club =>
    filterCity === "all" || club.city_id === filterCity
  );

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Night Clubs</h1>
          <p className="text-muted-foreground">
            Configure nightlife venues, DJ slot requirements, and social experiences.
          </p>
        </div>

        <div className="flex gap-4">
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
          {/* Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  {editingClub ? "Edit Night Club" : "Add Night Club"}
                </CardTitle>
                <CardDescription>
                  {editingClub
                    ? "Update club details and settings."
                    : "Create a new nightlife venue."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Select value={cityId} onValueChange={setCityId}>
                      <SelectTrigger id="city">
                        <SelectValue placeholder="Select a city" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Club Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Midnight Pulse"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Describe the club's vibe and atmosphere"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="quality">Quality (1-5)</Label>
                      <Select value={qualityLevel} onValueChange={setQualityLevel}>
                        <SelectTrigger id="quality">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((level) => (
                            <SelectItem key={level} value={`${level}`}>
                              {level} - {QUALITY_LABELS[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                        placeholder="300"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cover">Cover Charge ($)</Label>
                      <Input
                        id="cover"
                        type="number"
                        value={coverCharge}
                        onChange={(e) => setCoverCharge(e.target.value)}
                        placeholder="25"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-1">
                      <Label>Live Interactions</Label>
                      <p className="text-xs text-muted-foreground">Enable real-time features</p>
                    </div>
                    <Switch checked={liveInteractions} onCheckedChange={setLiveInteractions} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DJ Slot Config */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">DJ Slot Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="djFame">Min Fame Required</Label>
                    <Input
                      id="djFame"
                      type="number"
                      value={djMinFame}
                      onChange={(e) => setDjMinFame(e.target.value)}
                      placeholder="750"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="djPayout">Payout ($)</Label>
                    <Input
                      id="djPayout"
                      type="number"
                      value={djPayout}
                      onChange={(e) => setDjPayout(e.target.value)}
                      placeholder="800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="djSetLength">Set Length (min)</Label>
                    <Input
                      id="djSetLength"
                      type="number"
                      value={djSetLength}
                      onChange={(e) => setDjSetLength(e.target.value)}
                      placeholder="60"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="djSchedule">Schedule</Label>
                    <Input
                      id="djSchedule"
                      value={djSchedule}
                      onChange={(e) => setDjSchedule(e.target.value)}
                      placeholder="10pm-2am"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>DJ Perks</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newPerk}
                      onChange={(e) => setNewPerk(e.target.value)}
                      placeholder="Enter a perk"
                      onKeyPress={(e) => e.key === "Enter" && addPerk()}
                    />
                    <Button type="button" onClick={addPerk} size="sm">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {djPerks.map((perk, i) => (
                      <Badge key={i} variant="secondary">
                        {perk}
                        <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => removePerk(i)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guest Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Guest Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Add Action</Label>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Action label (e.g., 'Hit the dance floor')"
                      value={newAction.label}
                      onChange={(e) => setNewAction({ ...newAction, label: e.target.value })}
                    />
                    <Input
                      placeholder="Description"
                      value={newAction.description}
                      onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Energy cost"
                        value={newAction.energyCost}
                        onChange={(e) =>
                          setNewAction({ ...newAction, energyCost: parseInt(e.target.value) || 0 })
                        }
                      />
                      <Button type="button" onClick={addGuestAction} size="sm">
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {guestActions.map((action, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2">
                      <div className="text-sm">
                        <div className="font-medium">{action.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {action.description} • {action.energyCost} energy
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGuestAction(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Drinks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Drink Menu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Add Drink</Label>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Drink name"
                      value={newDrink.name}
                      onChange={(e) => setNewDrink({ ...newDrink, name: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Price ($)"
                        value={newDrink.price || ""}
                        onChange={(e) =>
                          setNewDrink({ ...newDrink, price: parseInt(e.target.value) || 0 })
                        }
                      />
                      <Input
                        placeholder="Effect (optional)"
                        value={newDrink.effect}
                        onChange={(e) => setNewDrink({ ...newDrink, effect: e.target.value })}
                      />
                      <Button type="button" onClick={addDrink} size="sm">
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {drinks.map((drink, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2">
                      <div className="text-sm">
                        <div className="font-medium">{drink.name} - ${drink.price}</div>
                        {drink.effect && (
                          <div className="text-xs text-muted-foreground">{drink.effect}</div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeDrink(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* NPCs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">NPC Profiles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Add NPC</Label>
                  <div className="grid gap-2">
                    <Input
                      placeholder="NPC name"
                      value={newNPC.name}
                      onChange={(e) => setNewNPC({ ...newNPC, name: e.target.value })}
                    />
                    <Input
                      placeholder="Role"
                      value={newNPC.role}
                      onChange={(e) => setNewNPC({ ...newNPC, role: e.target.value })}
                    />
                    <Input
                      placeholder="Personality"
                      value={newNPC.personality}
                      onChange={(e) => setNewNPC({ ...newNPC, personality: e.target.value })}
                    />
                    <Input
                      placeholder="Availability (optional)"
                      value={newNPC.availability}
                      onChange={(e) => setNewNPC({ ...newNPC, availability: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Dialogue hooks (comma separated)"
                        value={newNPC.dialogueHooks}
                        onChange={(e) => setNewNPC({ ...newNPC, dialogueHooks: e.target.value })}
                      />
                      <Button type="button" onClick={addNPC} size="sm">
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {npcs.map((npc, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2">
                      <div className="text-sm">
                        <div className="font-medium">
                          {npc.name} - {npc.role}
                        </div>
                        <div className="text-xs text-muted-foreground">{npc.personality}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeNPC(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingClub ? "Save Changes" : "Create Night Club"}
              </Button>
              {editingClub && (
                <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* List */}
          <Card>
            <CardHeader>
              <CardTitle>Configured Night Clubs</CardTitle>
              <CardDescription>Review and manage nightlife venues.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
                </div>
              ) : nightClubs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No night clubs configured yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Club</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNightClubs.map((club) => (
                      <TableRow key={club.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{club.name ?? "Untitled"}</div>
                            {club.description && (
                              <p className="text-xs text-muted-foreground">{club.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{club.city?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {QUALITY_LABELS[club.quality_level ?? 1] ?? "Tier 1"}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button size="icon" variant="outline" onClick={() => handleEdit(club)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleDelete(club.id)}
                            disabled={deletingClubId === club.id}
                          >
                            {deletingClubId === club.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default NightClubsAdmin;
