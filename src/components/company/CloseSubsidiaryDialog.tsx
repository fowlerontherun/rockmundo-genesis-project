import { useState } from "react";
import { AlertTriangle, Trash2, DollarSign } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCloseSubsidiary } from "@/hooks/useCompanies";
import { useGameData } from "@/hooks/useGameData";
import type { Company } from "@/types/company";
import { COMPANY_TYPE_INFO } from "@/types/company";

interface CloseSubsidiaryDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CloseSubsidiaryDialog = ({
  company,
  open,
  onOpenChange,
}: CloseSubsidiaryDialogProps) => {
  const [transferBalance, setTransferBalance] = useState(true);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const { profile } = useGameData();
  const closeSubsidiary = useCloseSubsidiary();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleClose = () => {
    if (!confirmChecked) return;
    
    closeSubsidiary.mutate(
      {
        companyId: company.id,
        profileId: profile?.id,
        transferBalance,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setConfirmChecked(false);
        },
      }
    );
  };

  const typeInfo = COMPANY_TYPE_INFO[company.company_type];
  const hasPositiveBalance = Number(company.balance) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Close {typeInfo.label}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              You are about to permanently close <strong>{company.name}</strong>. 
              This action cannot be undone.
            </p>

            {hasPositiveBalance && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-foreground">
                    Remaining Balance: {formatCurrency(company.balance)}
                  </p>
                  <p className="text-sm">
                    This will be transferred to your personal cash.
                  </p>
                </div>
              </div>
            )}

            {Number(company.balance) < 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">
                    Negative Balance: {formatCurrency(company.balance)}
                  </p>
                  <p className="text-sm">
                    Closing will write off this debt.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {hasPositiveBalance && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="transfer-balance"
                    checked={transferBalance}
                    onCheckedChange={(checked) => setTransferBalance(!!checked)}
                  />
                  <Label htmlFor="transfer-balance" className="text-sm">
                    Transfer remaining {formatCurrency(company.balance)} to my cash
                  </Label>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confirm-close"
                  checked={confirmChecked}
                  onCheckedChange={(checked) => setConfirmChecked(!!checked)}
                />
                <Label htmlFor="confirm-close" className="text-sm font-medium text-destructive">
                  I understand this action is permanent and cannot be undone
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmChecked(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClose}
            disabled={!confirmChecked || closeSubsidiary.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {closeSubsidiary.isPending ? "Closing..." : "Close Company"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
