import fs from "node:fs";

const target = process.argv[2] ?? "src/hooks/useCompanyFinance.ts";
let source = fs.readFileSync(target, "utf8");

source = source.replace('import { financeService } from "@/services/finance/financeService";\n', 'import { transferCompanyFunds } from "@/lib/api/companyFundTransfers";\n');

const format = 'const formatGBP = (amount: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);\n\n';
if (!source.includes('const formatGBP =')) source = source.replace('export interface CompanyTransaction {', format + 'export interface CompanyTransaction {');

const replaceHook = (name, nextName, body) => {
  const start = source.indexOf(`export const ${name} = () => {`);
  if (start < 0) throw new Error(`${name} not found`);
  const end = nextName ? source.indexOf(`export const ${nextName} = () => {`, start) : source.length;
  if (end < 0) throw new Error(`${nextName} not found`);
  source = source.slice(0, start) + body + "\n\n" + source.slice(end);
};

replaceHook("useDepositToCompany", "useWithdrawFromCompany", `export const useDepositToCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, amount }: { companyId: string; amount: number; profileId: string }) =>
      transferCompanyFunds({ transferKind: "deposit", companyId, amount }),
    onSuccess: (_, variables) => {
      for (const key of [["company-balance", variables.companyId], ["company-transactions", variables.companyId], ["company-income-expenses", variables.companyId], ["user-cash-balance"], ["company", variables.companyId], ["company-financial-summary"], ["profile"]]) queryClient.invalidateQueries({ queryKey: key });
      toast({ title: "Deposit Successful", description: \`${formatGBPPlaceholder} deposited to company.\`.replace("${formatGBPPlaceholder}", formatGBP(variables.amount)) });
    },
    onError: (error: Error) => toast({ title: "Deposit Failed", description: error.message, variant: "destructive" }),
  });
};`.replaceAll('formatGBPPlaceholder', '${formatGBP(variables.amount)}'));

replaceHook("useWithdrawFromCompany", "useTransferBetweenCompanies", `export const useWithdrawFromCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, amount }: { companyId: string; amount: number; profileId: string }) =>
      transferCompanyFunds({ transferKind: "withdrawal", companyId, amount }),
    onSuccess: (_, variables) => {
      for (const key of [["company-balance", variables.companyId], ["company-transactions", variables.companyId], ["company-income-expenses", variables.companyId], ["user-cash-balance"], ["company", variables.companyId], ["company-financial-summary"], ["profile"]]) queryClient.invalidateQueries({ queryKey: key });
      toast({ title: "Withdrawal Successful", description: \`${formatGBPPlaceholder} withdrawn from company.\`.replace("${formatGBPPlaceholder}", formatGBP(variables.amount)) });
    },
    onError: (error: Error) => toast({ title: "Withdrawal Failed", description: error.message, variant: "destructive" }),
  });
};`.replaceAll('formatGBPPlaceholder', '${formatGBP(variables.amount)}'));

const transferStart = source.indexOf('export const useTransferBetweenCompanies = () => {');
const transferEnd = source.indexOf('export const ', transferStart + 20);
const end = transferEnd < 0 ? source.length : transferEnd;
const transferBody = `export const useTransferBetweenCompanies = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromCompanyId, toCompanyId, amount }: { fromCompanyId: string; toCompanyId: string; amount: number; fromName: string; toName: string }) =>
      transferCompanyFunds({ transferKind: "intercompany", companyId: fromCompanyId, destinationCompanyId: toCompanyId, amount }),
    onSuccess: (_, variables) => {
      for (const companyId of [variables.fromCompanyId, variables.toCompanyId]) {
        queryClient.invalidateQueries({ queryKey: ["company-balance", companyId] });
        queryClient.invalidateQueries({ queryKey: ["company-transactions", companyId] });
        queryClient.invalidateQueries({ queryKey: ["company-income-expenses", companyId] });
        queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      }
      queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
      toast({ title: "Transfer Successful", description: \`${formatGBPPlaceholder} transferred from \${variables.fromName} to \${variables.toName}.\`.replace("${formatGBPPlaceholder}", formatGBP(variables.amount)) });
    },
    onError: (error: Error) => toast({ title: "Transfer Failed", description: error.message, variant: "destructive" }),
  });
};`.replaceAll('formatGBPPlaceholder', '${formatGBP(variables.amount)}');
source = source.slice(0, transferStart) + transferBody + "\n\n" + source.slice(end);

const authority = source.slice(source.indexOf('export const useDepositToCompany'));
for (const forbidden of ['financeService.transfer(', '.from("profiles")', '.from("companies")\n        .update', '.from("company_transactions")\n        .insert']) {
  if (authority.includes(forbidden)) throw new Error(`legacy company transfer write remains: ${forbidden}`);
}

fs.writeFileSync(target, source);
