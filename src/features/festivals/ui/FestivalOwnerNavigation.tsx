import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { festivalCompanySetupQueryKey } from "@/features/festival-company/application/useFestivalCompanySetup";
import { getFestivalCompanySetup } from "@/features/festival-company/data/festivalCompanyRepository";
import {
  festivalCompanyEditionsQueryKey,
  getFestivalCompanyEditions,
} from "@/features/festivals/editions/repository";
import { festivalRoutes } from "@/features/festivals/routes";

export function FestivalOwnerNavigation({
  festivalCompanyId,
  currentEditionId,
}: {
  festivalCompanyId: string;
  currentEditionId?: string | null;
}) {
  const { pathname, hash } = useLocation();
  const setupQuery = useQuery({
    queryKey: festivalCompanySetupQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanySetup(festivalCompanyId),
    enabled: Boolean(festivalCompanyId),
  });
  const editionsQuery = useQuery({
    queryKey: festivalCompanyEditionsQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanyEditions(festivalCompanyId),
    enabled: Boolean(festivalCompanyId),
  });

  const editableEditionId =
    currentEditionId ??
    editionsQuery.data?.editions
      .filter((edition) => edition.editable)
      .sort((left, right) => left.editionYear - right.editionYear)[0]
      ?.festivalEditionId ??
    null;
  const overviewPath = festivalRoutes.company(festivalCompanyId);
  const editionsPath = festivalRoutes.editions(festivalCompanyId);
  const currentFestivalPath = editableEditionId
    ? festivalRoutes.edition(festivalCompanyId, editableEditionId)
    : editionsPath;
  const upgradesPath = festivalRoutes.upgrades(festivalCompanyId);
  const companyId = setupQuery.data?.companyId ?? null;
  const financePath = companyId ? festivalRoutes.genericCompany(companyId) : null;

  const items = [
    {
      key: "overview",
      label: "Overview",
      to: overviewPath,
      active: pathname === overviewPath,
    },
    {
      key: "current",
      label: "Current Festival",
      to: currentFestivalPath,
      active: editableEditionId
        ? pathname.startsWith(`${editionsPath}/${editableEditionId}`)
        : false,
    },
    {
      key: "upgrades",
      label: "Upgrades & licence",
      to: upgradesPath,
      active: pathname === upgradesPath,
    },
    {
      key: "history",
      label: "Festival history",
      to: `${editionsPath}#festival-history`,
      active: pathname === editionsPath && hash === "#festival-history",
    },
  ] as const;

  return (
    <nav
      aria-label="Festival owner management"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          aria-current={item.active ? "page" : undefined}
          className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            item.active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
      {financePath ? (
        <Link
          to={financePath}
          className="shrink-0 rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Company finances
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="shrink-0 rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground opacity-60"
        >
          Company finances
        </span>
      )}
    </nav>
  );
}
