// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Ticket, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import type { TicketTier } from "./types";

interface TicketTierManagerProps {
  eventId?: string | null;
  onTiersChange?: (tiers: TicketTier[]) => void;
}

const TABLE_NAME = "event_ticket_tiers";

const supabaseClient = supabase as SupabaseClient<any>;

const emptyForm: Omit<TicketTier, "id" | "event_id" | "tickets_sold" | "created_at"> & { tickets_sold?: number } = {
  name: "",
  price: 0,
  quantity: 0,
  benefits: "",
  tickets_sold: 0,
  fees: 0,
};

const normalizeTier = (tier: Partial<TicketTier>): TicketTier => ({
  ...tier,
  tickets_sold: tier.tickets_sold ?? 0,
  fees: tier.fees ?? 0,
}) as TicketTier;

export const TicketTierManager = ({ eventId, onTiersChange }: TicketTierManagerProps) => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalCapacity = useMemo(() => tiers.reduce((total, tier) => total + (tier.quantity || 0), 0), [tiers]);
  const projectedRevenue = useMemo(
    () => tiers.reduce((total, tier) => total + tier.price * (tier.quantity || 0), 0),
    [tiers],
  );
  const confirmedRevenue = useMemo(
    () => tiers.reduce((total, tier) => total + tier.price * (tier.tickets_sold || 0), 0),
    [tiers],
  );

  const loadTiers = useCallback(async () => {
    if (!eventId) {
      setTiers([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabaseClient
      .from<TicketTier>(TABLE_NAME)
      .select("*")
      .eq("event_id", eventId)
      .order("price", { ascending: true });

    if (error) {
      console.error("Error loading ticket tiers", error);
      toast({
        title: "Unable to load ticket tiers",
        description: "Supabase returned an error while fetching the ticket tiers for this event.",
        variant: "destructive",
      });
    } else {
      setTiers((data ?? []).map(normalizeTier));
    }

    setLoading(false);
  }, [eventId, toast]);

  useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  useEffect(() => {
    onTiersChange?.(tiers);
  }, [tiers, onTiersChange]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const upsertTier = async () => {
    if (!eventId) {
      toast({
        title: "Set an event identifier first",
        description: "Ticket tiers must be associated with an event ID before they can be saved.",
      });
      return;
    }

    if (!form.name.trim()) {
      toast({
        title: "Tier name required",
        description: "Provide a descriptive label so fans know exactly what they are purchasing.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const payload = {
      event_id: eventId,
      name: form.name,
      price: Number(form.price) || 0,
      quantity: Number(form.quantity) || 0,
      benefits: form.benefits || null,
      tickets_sold: Number(form.tickets_sold) || 0,
      fees: form.fees ?? 0,
    } satisfies Partial<TicketTier> & { event_id: string };

    const query = editingId
      ? supabaseClient
          .from<TicketTier>(TABLE_NAME)
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .maybeSingle()
      : supabaseClient
          .from<TicketTier>(TABLE_NAME)
          .insert({ ...payload })
          .select("*")
          .maybeSingle();

    const { data, error } = await query;

    if (error) {
      console.error("Error saving ticket tier", error);
      toast({
        title: "Unable to save tier",
        description: "Supabase could not process this tier. Review your data and try again.",
        variant: "destructive",
      });
    } else if (data) {
      const normalized = normalizeTier(data);
      setTiers((previous) => {
        const existingIndex = previous.findIndex((tier) => tier.id === normalized.id);
        if (existingIndex >= 0) {
          const copy = [...previous];
          copy[existingIndex] = normalized;
          return copy;
        }

        return [...previous, normalized];
      });
      resetForm();
      toast({
        title: editingId ? "Ticket tier updated" : "Ticket tier created",
        description: `${normalized.name} is synced with Supabase.`,
      });
    }

    setSaving(false);
  };

  const handleEdit = (tier: TicketTier) => {
    setForm({
      name: tier.name,
      price: tier.price,
      quantity: tier.quantity,
      benefits: tier.benefits ?? "",
      tickets_sold: tier.tickets_sold ?? 0,
      fees: tier.fees ?? 0,
    });
    setEditingId(tier.id);
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    const { error } = await supabaseClient.from(TABLE_NAME).delete().eq("id", id);

    if (error) {
      console.error("Error deleting ticket tier", error);
      toast({
        title: "Unable to delete tier",
        description: "Supabase could not remove this tier. Please try again.",
        variant: "destructive",
      });
    } else {
      setTiers((previous) => previous.filter((tier) => tier.id !== id));
      toast({
        title: "Ticket tier removed",
        description: "The tier has been deleted from Supabase.",
      });
    }

    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Ticket tiers</CardTitle>
            <CardDescription>Manage inventory and benefits directly in Supabase for sales readiness.</CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
            <Ticket className="mr-1 h-4 w-4" /> {tiers.length} configured tiers
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Total capacity</p>
            <p className="text-lg font-semibold">{totalCapacity.toLocaleString()} tickets</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Potential revenue</p>
            <p className="text-lg font-semibold">${projectedRevenue.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Confirmed revenue</p>
            <p className="text-lg font-semibold">${confirmedRevenue.toLocaleString()}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tier-name">Tier name</Label>
              <Input
                id="tier-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="General admission, VIP lounge, ultra premium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-price">Price (USD)</Label>
              <Input
                id="tier-price"
                type="number"
                min={0}
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: Number.parseFloat(event.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tier-quantity">Quantity</Label>
              <Input
                id="tier-quantity"
                type="number"
                min={0}
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number.parseInt(event.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-sold">Tickets sold</Label>
              <Input
                id="tier-sold"
                type="number"
                min={0}
                value={form.tickets_sold}
                onChange={(event) => setForm((prev) => ({ ...prev, tickets_sold: Number.parseInt(event.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-fees">Fees & surcharges</Label>
              <Input
                id="tier-fees"
                type="number"
                min={0}
                value={form.fees ?? 0}
                onChange={(event) => setForm((prev) => ({ ...prev, fees: Number.parseFloat(event.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier-benefits">Benefits</Label>
            <Textarea
              id="tier-benefits"
              value={form.benefits ?? ""}
              onChange={(event) => setForm((prev) => ({ ...prev, benefits: event.target.value }))}
              placeholder="Fast lane entry, backstage tour, dedicated concierge"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={upsertTier} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
              {editingId ? "Update tier" : "Create tier"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading tiers from Supabase...
            </div>
          ) : tiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
              <Ticket className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No ticket tiers found</p>
              <p className="text-sm text-muted-foreground">
                Add a tier to sync pricing and capacity plans with your Supabase dataset.
              </p>
            </div>
          ) : (
            tiers.map((tier) => (
              <div key={tier.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">${tier.price.toLocaleString()}</Badge>
                    <p className="font-semibold">{tier.name}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tier.quantity.toLocaleString()} capacity · {tier.tickets_sold.toLocaleString()} sold · Fees ${
                      (tier.fees ?? 0).toLocaleString()
                    }
                  </p>
                  {tier.benefits && <p className="text-sm text-muted-foreground">Benefits: {tier.benefits}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(tier)} disabled={saving}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(tier.id)} disabled={saving}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Link your pricing strategy with Supabase-backed inventory to unlock accurate forecasting.
        </div>
        <Button variant="ghost" size="sm" onClick={() => void loadTiers()} disabled={loading}>
          <RefreshCcw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </CardFooter>
    </Card>
  );
};
