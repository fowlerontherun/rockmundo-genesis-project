from pathlib import Path
import json
import shutil


def replace_contract(path: str, old: str, new: str, count: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    if new in text:
        return
    actual = text.count(old)
    assert actual >= count, (
        f"{path}: expected at least {count} occurrence(s), found {actual}: {old!r}"
    )
    target.write_text(text.replace(old, new, count))


# Finish the owner-currency UI edits that were not committed before #1611 merged.
replace_contract(
    "src/features/festivals/annual-plan/FestivalAnnualPlan.tsx",
    '''const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);''',
    '''const money = (minor: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(minor / 100);''',
)
replace_contract(
    "src/features/festivals/annual-plan/FestivalAnnualPlan.tsx",
    "money(data.estimatedOperatingCostMinor)",
    "money(data.estimatedOperatingCostMinor, data.currencyCode)",
)

replace_contract(
    "src/features/festivals/editions/FestivalCompanyEditionsPage.tsx",
    '''const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(minor / 100);''',
    '''const money = (minor: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(minor / 100);''',
)
replace_contract(
    "src/features/festivals/editions/FestivalCompanyEditionsPage.tsx",
    "money(edition.estimatedOperatingCostMinor)",
    "money(edition.estimatedOperatingCostMinor, edition.currencyCode)",
)

repo = "src/features/festival-company/data/festivalCompanyRepository.ts"
replace_contract(
    repo,
    '''  companyBalance: number;
  managementEnabled: boolean;''',
    '''  companyBalance: number;
  currencyCode: string;
  managementEnabled: boolean;''',
)
replace_contract(
    repo,
    '''    && isFiniteNonNegative(candidate.companyBalance)
    && typeof candidate.managementEnabled === "boolean";''',
    '''    && isFiniteNonNegative(candidate.companyBalance)
    && typeof candidate.currencyCode === "string"
    && /^[A-Z]{3}$/.test(candidate.currencyCode)
    && typeof candidate.managementEnabled === "boolean";''',
)

card = "src/features/festival-company/ui/FestivalCompanyCard.tsx"
replace_contract(
    card,
    '''const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);''',
    '''const formatCurrency = (amount: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);''',
)
replace_contract(
    card,
    "formatCurrency(festival.companyBalance)",
    "formatCurrency(festival.companyBalance, festival.currencyCode)",
)

upgrades = "src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx"
replace_contract(
    upgrades,
    '''const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(minor / 100);''',
    '''const money = (minor: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
  }).format(minor / 100);''',
)
replace_contract(
    upgrades,
    "{money(query.data.availableBalanceMinor)}.",
    "{money(query.data.availableBalanceMinor, query.data.currencyCode)}.",
)
replace_contract(
    upgrades,
    '''      <Licence
        data={query.data.licence}''',
    '''      <Licence
        data={query.data.licence}
        currencyCode={query.data.currencyCode}''',
)
replace_contract(
    upgrades,
    '''              category={category}
              selected={isSelected}''',
    '''              category={category}
              currencyCode={query.data.currencyCode}
              selected={isSelected}''',
)
replace_contract(
    upgrades,
    '''interface UpgradeCardProps {
  category: FestivalUpgradeCategory;''',
    '''interface UpgradeCardProps {
  category: FestivalUpgradeCategory;
  currencyCode: string;''',
)
replace_contract(
    upgrades,
    '''export function UpgradeCard({
  category,
  selected,''',
    '''export function UpgradeCard({
  category,
  currencyCode,
  selected,''',
)
replace_contract(
    upgrades,
    "Current upkeep: {money(category.currentUpkeepMinor)} per week.",
    "Current upkeep: {money(category.currentUpkeepMinor, currencyCode)} per week.",
)
replace_contract(
    upgrades,
    "{money(category.nextCostMinor!)} ·",
    "{money(category.nextCostMinor!, currencyCode)} ·",
)
replace_contract(
    upgrades,
    "upkeep {money(category.nextUpkeepMinor!)} weekly",
    "upkeep {money(category.nextUpkeepMinor!, currencyCode)} weekly",
)
replace_contract(
    upgrades,
    "Balance after purchase: {money(preview.remainingBalanceMinor)}.",
    "Balance after purchase: {money(preview.remainingBalanceMinor, currencyCode)}.",
)
replace_contract(
    upgrades,
    '''function Licence({
  data,
  pending,''',
    '''function Licence({
  data,
  currencyCode,
  pending,''',
)
replace_contract(
    upgrades,
    '''}: {
  data: FestivalLicenceProgress;
  pending: boolean;''',
    '''}: {
  data: FestivalLicenceProgress;
  currencyCode: string;
  pending: boolean;''',
)
replace_contract(
    upgrades,
    '<Badge variant="outline">{money(target.feeMinor)}</Badge>',
    '<Badge variant="outline">{money(target.feeMinor, currencyCode)}</Badge>',
)
replace_contract(
    upgrades,
    "Available company funds: {money(data.availableBalanceMinor)}",
    "Available company funds: {money(data.availableBalanceMinor, currencyCode)}",
)

# Make Run Festival explicitly require a genuine player act.
service = "src/features/festivals/runtime/service.ts"
replace_contract(
    service,
    '''  confirmedActs: z.number().int().nonnegative(),
  npcFillEnabled: z.boolean(),''',
    '''  confirmedActs: z.number().int().nonnegative(),
  confirmedPlayerActs: z.number().int().nonnegative(),
  npcFillEnabled: z.boolean(),''',
)
legacy_exports = '''\n// Retained for historical schedule-backed Festival runtimes and admin tooling.\nexport async function prepareEditionRuntime(\n  companyId: string,\n  editionId: string,\n  expectedEditionVersion: number,\n  expectedScheduleRevision: string,\n) {\n  return rpc("prepare_festival_edition_runtime", {\n    p_festival_company_id: companyId,\n    p_edition_id: editionId,\n    p_expected_edition_version: expectedEditionVersion,\n    p_expected_schedule_revision: expectedScheduleRevision,\n    p_idempotency_key: crypto.randomUUID(),\n  });\n}\n\nexport async function transitionEditionRuntime(\n  runtimeId: string,\n  expectedVersion: number,\n  action: string,\n  reason?: string,\n) {\n  return rpc("transition_festival_edition_runtime", {\n    p_runtime_id: runtimeId,\n    p_expected_version: expectedVersion,\n    p_action: action,\n    p_reason: reason ?? null,\n    p_idempotency_key: crypto.randomUUID(),\n  });\n}\n'''
service_text = Path(service).read_text()
if legacy_exports in service_text:
    Path(service).write_text(service_text.replace(legacy_exports, "\n"))
else:
    assert "prepareEditionRuntime" not in service_text and "transitionEditionRuntime" not in service_text

control_room = "src/features/festivals/runtime/FestivalLiveControlRoom.tsx"
replace_contract(
    control_room,
    '''                  <ReadinessMetric
                    label="Confirmed acts"
                    value={readiness.confirmedActs.toString()}
                    ready={readiness.confirmedActs > 0}
                  />''',
    '''                  <ReadinessMetric
                    label="Confirmed player acts"
                    value={readiness.confirmedPlayerActs.toString()}
                    ready={readiness.confirmedPlayerActs > 0}
                  />''',
)

# Reconcile production-first Festival migrations into the durable repository overlay.
reconciliations = [
    (
        "supabase/migrations/20291218252400_festival_owner_currency_consistency.sql",
        "supabase/reconciliation/festival/20260823_festival_owner_currency_consistency.sql",
    ),
    (
        "supabase/migrations/20291218252500_harden_festival_upgrade_internal_helpers.sql",
        "supabase/reconciliation/festival/20260823_harden_festival_upgrade_internal_helpers.sql",
    ),
    (
        "supabase/migrations/20291218252600_festival_player_act_launch_authority.sql",
        "supabase/reconciliation/festival/20260823_festival_player_act_launch_authority.sql",
    ),
    (
        "supabase/migrations/20291218252700_restrict_legacy_festival_runtime_rpcs.sql",
        "supabase/reconciliation/festival/20260823_restrict_legacy_festival_runtime_rpcs.sql",
    ),
]
for source, target in reconciliations:
    shutil.copyfile(source, target)

manifest_path = Path("scripts/supabase/festival-production-reconciliation.json")
manifest = json.loads(manifest_path.read_text())
for marker in [
    ["20260823141846", "festival_owner_currency_consistency"],
    ["20260823142037", "harden_festival_upgrade_internal_helpers"],
    ["20260823144842", "festival_player_act_launch_authority"],
    ["20260823144854", "restrict_legacy_festival_runtime_rpcs"],
]:
    if marker not in manifest["historyMarkers"]:
        manifest["historyMarkers"].append(marker)
for _, extension in reconciliations:
    if extension not in manifest["postBootstrapExtensions"]:
        manifest["postBootstrapExtensions"].append(extension)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
