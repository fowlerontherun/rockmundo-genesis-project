import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Disc, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Company, CompanyLabel } from "@/types/company";

interface TransferLabelDialogProps {
  trigger?: React.ReactNode;
  holdingCompanies: Company[];
}

export const TransferLabelDialog = ({
  trigger,
  holdingCompanies,
}: TransferLabelDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's labels that are NOT already linked to a company
  const { data: availableLabels = [], isLoading: labelsLoading } = useQuery<CompanyLabel[]>({
    queryKey: ["available-labels-for-transfer", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!profile) return [];

      const { data, error } = await supabase
        .from("labels")
        .select("id, name, logo_url, company_id, balance, is_bankrupt, headquarters_city, reputation_score")
        .eq("owner_id", profile.id)
        .is("company_id", null)
        .order("name");

      if (error) throw error;
      return data as CompanyLabel[];
    },
  });

  const transferMutation = useMutation({
    mutationFn: async ({ labelId, companyId }: { labelId: string; companyId: string }) => {
      const { error } = await supabase
        .from("labels")
        .update({ company_id: companyId })
        .eq("id", labelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["available-labels-for-transfer"] });
      queryClient.invalidateQueries({ queryKey: ["my-labels"] });
      queryClient.invalidateQueries({ queryKey: ["company-labels"] });
      toast({
        title: "Label Transferred",
        description: "The label has been successfully transferred to your holding company.",
      });
      setOpen(false);
      setSelectedLabelId("");
      setSelectedCompanyId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTransfer = () => {
    if (selectedLabelId && selectedCompanyId) {
      transferMutation.mutate({ labelId: selectedLabelId, companyId: selectedCompanyId });
    }
  };

  const selectedLabel = availableLabels.find((l) => l.id === selectedLabelId);
  const selectedCompany = holdingCompanies.find((c) => c.id === selectedCompanyId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <ArrowRight className="h-4 w-4 mr-2" />
            Transfer Label to Company
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Disc className="h-5 w-5 text-purple-500" />
            Transfer Label to Company
          </DialogTitle>
          <DialogDescription>
            Move an existing record label under your holding company's ownership
          </DialogDescription>
        </DialogHeader>

        {holdingCompanies.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You need to create a holding company first before you can transfer labels.
            </AlertDescription>
          </Alert>
        ) : labelsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : availableLabels.length === 0 ? (
          <Alert>
            <Disc className="h-4 w-4" />
            <AlertDescription>
              You don't have any labels that can be transferred. All your labels are already under company ownership, or you haven't created any labels yet.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Select Label */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Label to Transfer</Label>
              <RadioGroup
                value={selectedLabelId}
                onValueChange={setSelectedLabelId}
                className="space-y-2"
              >
                {availableLabels.map((label) => (
                  <div key={label.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={label.id} id={`label-${label.id}`} />
                    <Label
                      htmlFor={`label-${label.id}`}
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={label.logo_url || undefined} />
                        <AvatarFallback>
                          <Disc className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{label.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {label.headquarters_city || "No HQ"} • 
                          ${label.balance?.toLocaleString() || 0}
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Select Holding Company */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Transfer to Holding Company</Label>
              <RadioGroup
                value={selectedCompanyId}
                onValueChange={setSelectedCompanyId}
                className="space-y-2"
              >
                {holdingCompanies.map((company) => (
                  <div key={company.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={company.id} id={`company-${company.id}`} />
                    <Label
                      htmlFor={`company-${company.id}`}
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {company.headquarters_city?.name || "No HQ"}
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Preview */}
            {selectedLabel && selectedCompany && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <Avatar className="h-12 w-12 mx-auto mb-2">
                        <AvatarImage src={selectedLabel.logo_url || undefined} />
                        <AvatarFallback>
                          <Disc className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium">{selectedLabel.name}</p>
                      <p className="text-xs text-muted-foreground">Label</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="text-center">
                      <div className="h-12 w-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm font-medium">{selectedCompany.name}</p>
                      <p className="text-xs text-muted-foreground">Holding Company</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedLabelId || !selectedCompanyId || transferMutation.isPending}
                onClick={handleTransfer}
              >
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Transfer Label
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
