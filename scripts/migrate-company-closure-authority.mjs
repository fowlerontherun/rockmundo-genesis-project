import fs from "node:fs";

const target = process.argv[2] ?? "src/hooks/useCompanies.ts";
let source = fs.readFileSync(target, "utf8");

if (!source.includes('import { closeCompany } from "@/lib/api/companyClosure";')) {
  source = source.replace(
    'import { foundCompany } from "@/lib/api/companyFounding";',
    'import { foundCompany } from "@/lib/api/companyFounding";\nimport { closeCompany } from "@/lib/api/companyClosure";',
  );
}

source = source.replace(
  '.eq("owner_id", userId)\n        .order("created_at", { ascending: false });',
  '.eq("owner_id", userId)\n        .neq("status", "dissolved")\n        .order("created_at", { ascending: false });',
);

source = source.replace(
  '.eq("parent_company_id", parentCompanyId)\n        .order("created_at", { ascending: false });',
  '.eq("parent_company_id", parentCompanyId)\n        .neq("status", "dissolved")\n        .order("created_at", { ascending: false });',
);

const start = source.indexOf('export const useCloseSubsidiary = () => {');
if (start === -1) throw new Error("useCloseSubsidiary start not found");
const replacement = `export const useCloseSubsidiary = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      transferBalance = true,
    }: {
      companyId: string;
      profileId?: string;
      transferBalance?: boolean;
    }) => closeCompany(companyId, transferBalance),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-subsidiaries"] });
      queryClient.invalidateQueries({ queryKey: ["company", result.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      toast({
        title: "Company Closed",
        description: result.transferredAmount > 0
          ? \`\${result.companyName} was dissolved and \${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(result.transferredAmount)} was transferred to the owner.\`
          : \`\${result.companyName} was dissolved successfully.\`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Close Company",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
`;
source = source.slice(0, start) + replacement;

for (const forbidden of [
  '.from("profiles")',
  '.from("company_transactions")',
  '.from("company_settings")',
  '.from("company_tax_records")',
  '.from("security_firms")',
  '.from("merch_factories")',
  '.from("logistics_companies")',
]) {
  const closure = source.slice(source.indexOf('export const useCloseSubsidiary'));
  if (closure.includes(forbidden)) throw new Error(`legacy closure write remains: ${forbidden}`);
}

fs.writeFileSync(target, source);
