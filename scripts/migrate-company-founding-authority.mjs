import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const target = process.argv[2] ?? "src/hooks/useCompanies.ts";
const source = await readFile(target, "utf8");

const importAnchor = 'import { COMPANY_CREATION_COSTS } from "@/types/company";';
const importReplacement = 'import { COMPANY_CREATION_COSTS } from "@/types/company";\nimport { foundCompany } from "@/lib/api/companyFounding";';

if (!source.includes(importAnchor) && !source.includes('import { foundCompany } from "@/lib/api/companyFounding";')) {
  throw new Error("Could not find company type import anchor");
}

const startMarker = "export const useCreateCompany = () => {";
const endMarker = "\nexport const useUpdateCompany = () => {";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error("Could not locate useCreateCompany block");
}

const replacement = `export const useCreateCompany = () => {
  const { userId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCompanyInput & { profileId?: string }): Promise<Company> => {
      if (!userId) throw new Error("Not authenticated");

      if (input.company_type === "festival") {
        throw new Error("Festival companies must be founded through the secure VIP festival RPC.");
      }

      const result = await foundCompany({
        name: input.name,
        company_type: input.company_type,
        description: input.description,
        headquarters_city_id: input.headquarters_city_id,
        parent_company_id: input.parent_company_id,
      });

      return {
        id: result.companyId,
        owner_id: userId,
        name: input.name,
        logo_url: null,
        company_type: input.company_type,
        parent_company_id: input.parent_company_id ?? null,
        headquarters_city_id: input.headquarters_city_id ?? null,
        balance: result.startingBalance,
        is_bankrupt: false,
        bankruptcy_date: null,
        founded_at: new Date().toISOString(),
        status: "active",
        reputation_score: 0,
        weekly_operating_costs: result.weeklyOperatingCosts,
        description: input.description ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        negative_balance_since: null,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Company Created",
        description: \\`${data.name} has been successfully registered with £${Number(data.balance).toLocaleString("en-GB")} starting capital.\\`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });
};
`;

let next = source;
if (!next.includes('import { foundCompany } from "@/lib/api/companyFounding";')) {
  next = next.replace(importAnchor, importReplacement);
}

const adjustedStart = next.indexOf(startMarker);
const adjustedEnd = next.indexOf(endMarker, adjustedStart);
next = next.slice(0, adjustedStart) + replacement + next.slice(adjustedEnd);

const forbidden = [
  '.from("profiles")\n          .update({ cash:',
  '.from("companies")\n        .insert({',
  'supabase.from("company_transactions").insert',
  'supabase.from("company_shareholders" as any).insert',
];

for (const pattern of forbidden) {
  const block = next.slice(next.indexOf(startMarker), next.indexOf(endMarker, next.indexOf(startMarker)));
  if (block.includes(pattern)) throw new Error(`Legacy founding write remains: ${pattern}`);
}

await writeFile(target, next, "utf8");
console.log(`Migrated company founding authority in ${target}`);
