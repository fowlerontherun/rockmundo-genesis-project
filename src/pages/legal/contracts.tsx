// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  ArtistLabelContract,
  ContractClause,
  ContractNegotiation,
  NEGOTIATION_STATUSES,
  NegotiationInput,
  NegotiationStatus,
  fetchActiveContracts,
  fetchClausesForContract,
  fetchNegotiationsForContract,
  parseClauseTerms,
  parseNegotiationTerms,
  submitNegotiation,
} from "@/lib/workflows/contracts";

const formatDate = (value: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const ContractsPage = () => {
  const [contracts, setContracts] = useState<ArtistLabelContract[]>([]);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ArtistLabelContract | null>(null);
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [negotiations, setNegotiations] = useState<ContractNegotiation[]>([]);
  const [clausesLoading, setClausesLoading] = useState(false);
  const [activeClauseId, setActiveClauseId] = useState<string>("");

  const [proposalNotes, setProposalNotes] = useState("");
  const [counterNotes, setCounterNotes] = useState("");
  const [status, setStatus] = useState<NegotiationStatus>("pending");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadContracts = async () => {
      setLoadingContracts(true);
      setContractsError(null);

      try {
        const data = await fetchActiveContracts();
        setContracts(data);
      } catch (error) {
        setContractsError(error instanceof Error ? error.message : "Unable to load contracts");
      } finally {
        setLoadingContracts(false);
      }
    };

    void loadContracts();
  }, []);

  const negotiationMap = useMemo(() => {
    return negotiations.reduce<Record<string, ContractNegotiation>>((map, entry) => {
      map[entry.clause_id] = entry;
      return map;
    }, {});
  }, [negotiations]);

  useEffect(() => {
    if (!modalOpen || !clauses.length) {
      return;
    }

    if (!activeClauseId) {
      setActiveClauseId(clauses[0].id);
      return;
    }

    const activeNegotiation = negotiationMap[activeClauseId];
    if (!activeNegotiation) {
      setProposalNotes("");
      setCounterNotes("");
      setStatus("pending");
      return;
    }

    const existingProposal = parseNegotiationTerms(activeNegotiation.proposed_terms);
    const existingCounter = parseNegotiationTerms(activeNegotiation.counter_terms);

    setProposalNotes(existingProposal.notes ?? "");
    setCounterNotes(existingCounter.notes ?? "");
    setStatus((activeNegotiation.status as NegotiationStatus) ?? "pending");
  }, [modalOpen, clauses, activeClauseId, negotiationMap]);

  const openNegotiationModal = async (contract: ArtistLabelContract) => {
    setSelectedContract(contract);
    setModalOpen(true);
    setClausesLoading(true);
    setClauses([]);
    setNegotiations([]);
    setActiveClauseId("");
    setProposalNotes("");
    setCounterNotes("");
    setStatus("pending");
    setFormError(null);
    setFormSuccess(null);

    try {
      const contractType = contract.deal_type_id ?? "general";
      const [clauseData, negotiationData] = await Promise.all([
        fetchClausesForContract(contractType),
        fetchNegotiationsForContract(contract.id),
      ]);
      setClauses(clauseData);
      setNegotiations(negotiationData);
      if (clauseData.length) {
        setActiveClauseId(clauseData[0].id);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to load negotiation data");
    } finally {
      setClausesLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedContract || !activeClauseId) {
      setFormError("Select a clause to negotiate");
      return;
    }

    if (!proposalNotes.trim()) {
      setFormError("Add a proposal so the label knows what you're asking for");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const payload: NegotiationInput = {
      clauseId: activeClauseId,
      proposedTerms: { notes: proposalNotes.trim() },
      counterTerms: counterNotes.trim() ? { notes: counterNotes.trim() } : undefined,
      status,
      lastActionBy: "artist_representative",
    };

    try {
      await submitNegotiation(selectedContract.id, payload);
      const updatedNegotiations = await fetchNegotiationsForContract(selectedContract.id);
      setNegotiations(updatedNegotiations);
      setFormSuccess("Negotiation saved");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save negotiation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Contract Command Center</h1>
        <p className="text-muted-foreground">
          Review active label agreements, understand clause expectations, and coordinate negotiation moves with your
          team.
        </p>
      </div>

      {contractsError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load contracts</CardTitle>
            <CardDescription>{contractsError}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {loadingContracts ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : contracts.length ? (
          contracts.map((contract) => {
            return (
              <Card key={contract.id} className="flex flex-col justify-between">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-xl">{contract.deal_type_id || "General recording agreement"}</CardTitle>
                    <Badge variant="secondary" className="uppercase tracking-wide">
                      {contract.status ?? "active"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {`Effective ${formatDate(contract.start_date)} — ${formatDate(contract.end_date)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Label</span>
                      <span className="font-medium text-foreground">{contract.label_id ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Royalty split</span>
                      <span className="font-medium text-foreground">
                        {contract.royalty_artist_pct}% Artist / {contract.royalty_label_pct ?? 100 - contract.royalty_artist_pct}% Label
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Advance</span>
                      <span className="font-medium text-foreground">
                        {contract.advance_amount ? `$${contract.advance_amount.toLocaleString()}` : "None"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Release commitment</span>
                      <span className="font-medium text-foreground">
                        {contract.release_quota} releases / {contract.releases_completed ?? 0} delivered
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Territories</span>
                      <span className="max-w-[60%] text-right font-medium text-foreground">
                        {contract.territories?.length ? contract.territories.join(", ") : "Global"}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => void openNegotiationModal(contract)}>Negotiate terms</Button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>No active contracts</CardTitle>
              <CardDescription>
                When you secure a label agreement, the full contract summary and negotiation tools will appear here.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Negotiate contract terms</DialogTitle>
            <DialogDescription>
              Align on a clause, document your ask, and share counter positions before submitting to the label.
            </DialogDescription>
          </DialogHeader>

          {clausesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
              <ScrollArea className="h-[420px] rounded-md border">
                <div className="space-y-4 p-4">
                  {clauses.map((clause) => {
                    const terms = parseClauseTerms(clause.default_terms);
                    const existingNegotiation = negotiationMap[clause.id];
                    const existingStatus = (existingNegotiation?.status as NegotiationStatus) ?? "pending";

                    return (
                      <Card
                        key={clause.id}
                        className={
                          clause.id === activeClauseId
                            ? "border-primary shadow-sm"
                            : "border-border/80"
                        }
                      >
                        <CardHeader className="space-y-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <CardTitle className="text-lg">{clause.title}</CardTitle>
                              <CardDescription>{clause.description}</CardDescription>
                            </div>
                            <Badge variant={existingStatus === "accepted" ? "default" : existingStatus === "countered" ? "outline" : "secondary"}>
                              {existingStatus}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          {terms.summary && (
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Label baseline</p>
                              <p className="font-medium text-foreground">{terms.summary}</p>
                            </div>
                          )}
                          {terms.expectations && (
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Expectations</p>
                              <p className="text-foreground">{terms.expectations}</p>
                            </div>
                          )}
                          {terms.value && (
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Target value</p>
                              <p className="text-foreground">{terms.value}</p>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() => setActiveClauseId(clause.id)}
                          >
                            Focus clause
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clause">Clause</Label>
                  <Select value={activeClauseId} onValueChange={(value) => setActiveClauseId(value)}>
                    <SelectTrigger id="clause">
                      <SelectValue placeholder="Select clause" />
                    </SelectTrigger>
                    <SelectContent>
                      {clauses.map((clause) => (
                        <SelectItem key={clause.id} value={clause.id}>
                          {clause.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proposal">Your proposal</Label>
                  <Textarea
                    id="proposal"
                    value={proposalNotes}
                    onChange={(event) => setProposalNotes(event.target.value)}
                    placeholder="Outline the terms you're requesting"
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="counter">Label counter (optional)</Label>
                  <Textarea
                    id="counter"
                    value={counterNotes}
                    onChange={(event) => setCounterNotes(event.target.value)}
                    placeholder="Capture the latest label response"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as NegotiationStatus)}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Negotiation status" />
                    </SelectTrigger>
                    <SelectContent>
                      {NEGOTIATION_STATUSES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {formError && <p className="text-sm text-destructive">{formError}</p>}
                {formSuccess && <p className="text-sm text-emerald-600">{formSuccess}</p>}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setModalOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={() => void handleSubmit()} disabled={submitting}>
                    {submitting ? "Saving..." : "Save negotiation"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractsPage;
