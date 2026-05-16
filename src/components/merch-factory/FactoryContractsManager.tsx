import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, XCircle } from "lucide-react";
import {
  useFactoryContracts,
  useCreateFactoryContract,
  useEndFactoryContract,
  useAllBands,
} from "@/hooks/useMerchFactory";
import { format } from "date-fns";

interface FactoryContractsManagerProps {
  factoryId: string;
}

const CONTRACT_TYPES = [
  { value: "per_order", label: "Per Order" },
  { value: "monthly", label: "Monthly Retainer" },
  { value: "exclusive", label: "Exclusive Partner" },
] as const;

export function FactoryContractsManager({ factoryId }: FactoryContractsManagerProps) {
  const [open, setOpen] = useState(false);
  const [bandId, setBandId] = useState<string>("");
  const [contractType, setContractType] = useState<"per_order" | "monthly" | "exclusive">("per_order");
  const [discount, setDiscount] = useState("0");
  const [minMonthly, setMinMonthly] = useState("");
  const [priority, setPriority] = useState("5");

  const { data: contracts, isLoading } = useFactoryContracts(factoryId);
  const { data: bands } = useAllBands();
  const createContract = useCreateFactoryContract();
  const endContract = useEndFactoryContract();

  const reset = () => {
    setBandId("");
    setContractType("per_order");
    setDiscount("0");
    setMinMonthly("");
    setPriority("5");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bandId) return;
    await createContract.mutateAsync({
      factory_id: factoryId,
      client_band_id: bandId,
      contract_type: contractType,
      discount_percentage: Number(discount) || 0,
      minimum_monthly_orders: contractType === "monthly" && minMonthly ? Number(minMonthly) : null,
      priority_level: Number(priority) || 5,
    });
    setOpen(false);
    reset();
  };

  if (isLoading) return <div className="text-center py-4">Loading contracts...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Factory Contracts
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Contract
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Factory Contract</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Client Band</Label>
                <Select value={bandId} onValueChange={setBandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select band" />
                  </SelectTrigger>
                  <SelectContent>
                    {bands?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contract Type</Label>
                <Select value={contractType} onValueChange={(v) => setContractType(v as typeof contractType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input type="number" min="0" max="50" step="1" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Priority (1-10)</Label>
                  <Input type="number" min="1" max="10" step="1" value={priority} onChange={(e) => setPriority(e.target.value)} />
                </div>
              </div>

              {contractType === "monthly" && (
                <div className="space-y-2">
                  <Label>Minimum Monthly Orders</Label>
                  <Input type="number" min="1" step="1" value={minMonthly} onChange={(e) => setMinMonthly(e.target.value)} />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!bandId || createContract.isPending}>
                {createContract.isPending ? "Creating..." : "Create Contract"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!contracts?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No contracts yet</p>
            <p className="text-sm">Sign bands or labels to lock in priority orders and discounts</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.client_band?.name || "—"}</TableCell>
                  <TableCell className="capitalize">{c.contract_type.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">{Number(c.discount_percentage)}%</TableCell>
                  <TableCell className="text-right">P{c.priority_level}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(c.start_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Ended"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => endContract.mutate({ contractId: c.id, factoryId })}
                        disabled={endContract.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
