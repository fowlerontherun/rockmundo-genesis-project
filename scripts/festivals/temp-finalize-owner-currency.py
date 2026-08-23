from pathlib import Path
import json
import shutil


def patch(path: str, old: str, new: str, count: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    actual = text.count(old)
    assert actual >= count, (
        f"{path}: expected at least {count} occurrence(s), found {actual}: {old!r}"
    )
    target.write_text(text.replace(old, new, count))


patch(
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
patch(
    "src/features/festivals/annual-plan/FestivalAnnualPlan.tsx",
    "money(data.estimatedOperatingCostMinor)",
    "money(data.estimatedOperatingCostMinor, data.currencyCode)",
)

patch(
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
patch(
    "src/features/festivals/editions/FestivalCompanyEditionsPage.tsx",
    "money(edition.estimatedOperatingCostMinor)",
    "money(edition.estimatedOperatingCostMinor, edition.currencyCode)",
)

repo = "src/features/festival-company/data/festivalCompanyRepository.ts"
patch(
    repo,
    '''  companyBalance: number;
  managementEnabled: boolean;''',
    '''  companyBalance: number;
  currencyCode: string;
  managementEnabled: boolean;''',
)
patch(
    repo,
    '''    && isFiniteNonNegative(candidate.companyBalance)
    && typeof candidate.managementEnabled === "boolean";''',
    '''    && isFiniteNonNegative(candidate.companyBalance)
    && typeof candidate.currencyCode === "string"
    && /^[A-Z]{3}$/.test(candidate.currencyCode)
    && typeof candidate.managementEnabled === "boolean";''',
)

card = "src/features/festival-company/ui/FestivalCompanyCard.tsx"
patch(
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
patch(
    card,
    "formatCurrency(festival.companyBalance)",
    "formatCurrency(festival.companyBalance, festival.currencyCode)",
)

upgrades = "src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx"
patch(
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
patch(
    upgrades,
    "{money(query.data.availableBalanceMinor)}.",
    "{money(query.data.availableBalanceMinor, query.data.currencyCode)}.",
)
patch(
    upgrades,
    '''      <Licence
        data={query.data.licence}''',
    '''      <Licence
        data={query.data.licence}
        currencyCode={query.data.currencyCode}''',
)
patch(
    upgrades,
    '''              category={category}
              selected={isSelected}''',
    '''              category={category}
              currencyCode={query.data.currencyCode}
              selected={isSelected}''',
)
patch(
    upgrades,
    '''interface UpgradeCardProps {
  category: FestivalUpgradeCategory;''',
    '''interface UpgradeCardProps {
  category: FestivalUpgradeCategory;
  currencyCode: string;''',
)
patch(
    upgrades,
    '''export function UpgradeCard({
  category,
  selected,''',
    '''export function UpgradeCard({
  category,
  currencyCode,
  selected,''',
)
patch(
    upgrades,
    "Current upkeep: {money(category.currentUpkeepMinor)} per week.",
    "Current upkeep: {money(category.currentUpkeepMinor, currencyCode)} per week.",
)
patch(
    upgrades,
    "{money(category.nextCostMinor!)} ·",
    "{money(category.nextCostMinor!, currencyCode)} ·",
)
patch(
    upgrades,
    "upkeep {money(category.nextUpkeepMinor!)} weekly",
    "upkeep {money(category.nextUpkeepMinor!, currencyCode)} weekly",
)
patch(
    upgrades,
    "Balance after purchase: {money(preview.remainingBalanceMinor)}.",
    "Balance after purchase: {money(preview.remainingBalanceMinor, currencyCode)}.",
)
patch(
    upgrades,
    '''function Licence({
  data,
  pending,''',
    '''function Licence({
  data,
  currencyCode,
  pending,''',
)
patch(
    upgrades,
    '''}: {
  data: FestivalLicenceProgress;
  pending: boolean;''',
    '''}: {
  data: FestivalLicenceProgress;
  currencyCode: string;
  pending: boolean;''',
)
patch(
    upgrades,
    '<Badge variant="outline">{money(target.feeMinor)}</Badge>',
    '<Badge variant="outline">{money(target.feeMinor, currencyCode)}</Badge>',
)
patch(
    upgrades,
    "Available company funds: {money(data.availableBalanceMinor)}",
    "Available company funds: {money(data.availableBalanceMinor, currencyCode)}",
)

shutil.copyfile(
    "supabase/migrations/20291218252400_festival_owner_currency_consistency.sql",
    "supabase/reconciliation/festival/20260823_festival_owner_currency_consistency.sql",
)
shutil.copyfile(
    "supabase/migrations/20291218252500_harden_festival_upgrade_internal_helpers.sql",
    "supabase/reconciliation/festival/20260823_harden_festival_upgrade_internal_helpers.sql",
)

manifest_path = Path("scripts/supabase/festival-production-reconciliation.json")
manifest = json.loads(manifest_path.read_text())
for marker in [
    ["20260823141846", "festival_owner_currency_consistency"],
    ["20260823142037", "harden_festival_upgrade_internal_helpers"],
]:
    if marker not in manifest["historyMarkers"]:
        manifest["historyMarkers"].append(marker)
for extension in [
    "supabase/reconciliation/festival/20260823_festival_owner_currency_consistency.sql",
    "supabase/reconciliation/festival/20260823_harden_festival_upgrade_internal_helpers.sql",
]:
    if extension not in manifest["postBootstrapExtensions"]:
        manifest["postBootstrapExtensions"].append(extension)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
