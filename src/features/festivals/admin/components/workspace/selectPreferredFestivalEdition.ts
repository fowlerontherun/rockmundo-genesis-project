import type { OwnerEditionOption } from "../../types";

export function selectPreferredFestivalEdition(editions: OwnerEditionOption[]) {
  const ranked = [
    (e: OwnerEditionOption) => e.status === "live",
    (e: OwnerEditionOption) =>
      [
        "applications_open",
        "booking",
        "announced",
        "on_sale",
        "setup",
        "planning",
        "concept",
      ].includes(e.status),
    (e: OwnerEditionOption) => e.status === "completed",
    () => true,
  ];
  for (const match of ranked) {
    const candidates = editions
      .filter(match)
      .sort((a, b) =>
        String(b.endAt ?? b.startAt ?? "").localeCompare(
          String(a.endAt ?? a.startAt ?? ""),
        ),
      );
    if (candidates[0]) return candidates[0];
  }
  return undefined;
}
