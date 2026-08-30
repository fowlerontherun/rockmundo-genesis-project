import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Pin, PinOff, Search, Star } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import { useTranslation } from "@/hooks/useTranslation";
import { translateFMLabel, translateFMText } from "@/i18n/fm";
import {
  getNavigationDestinations,
  readNavigationStore,
  recordRecentDestination,
  searchNavigationDestinations,
  toggleFavourite,
  type NavigationDestination,
  type StoredNavigationDestination,
} from "@/lib/navigationProductivity";

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
};

const toStored = (destination: NavigationDestination | StoredNavigationDestination): StoredNavigationDestination => ({
  id: destination.id,
  label: destination.label,
  path: destination.path,
  hubLabel: destination.hubLabel,
  kind: destination.kind,
});

export const FMCommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [storeVersion, setStoreVersion] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { userRole } = useUserRole();
  const { language } = useTranslation();
  const userId = user?.id ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("fm:open-command", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fm:open-command", onOpen as EventListener);
    };
  }, []);

  const destinations = useMemo(() => getNavigationDestinations(userRole), [userRole]);
  const searchableDestinations = useMemo(
    () => destinations.map((destination) => {
      const translatedLabel = translateFMLabel(language, destination.label);
      const translatedHub = destination.hubLabel ? translateFMLabel(language, destination.hubLabel) : undefined;
      return {
        ...destination,
        label: translatedLabel,
        hubLabel: translatedHub,
        keywords: [
          ...(destination.keywords ?? []),
          destination.label,
          destination.hubLabel ?? "",
          translatedLabel,
          translatedHub ?? "",
        ].filter(Boolean),
      };
    }),
    [destinations, language],
  );
  const store = useMemo(() => readNavigationStore(userId), [userId, storeVersion]);
  const allowedPaths = useMemo(() => new Set(destinations.map((destination) => destination.path)), [destinations]);
  const favouritePaths = useMemo(() => new Set(store.favourites.map((fav) => fav.path)), [store.favourites]);
  const currentDestination = useMemo(() => destinations.find((destination) => destination.path === pathname), [destinations, pathname]);

  useEffect(() => {
    const destination = destinations.find((item) => item.path === pathname);
    if (destination?.recentEligible) {
      recordRecentDestination(userId, toStored(destination));
      setStoreVersion((value) => value + 1);
    }
  }, [destinations, pathname, userId]);

  const filteredFavourites = store.favourites.filter((item) => allowedPaths.has(item.path));
  const filteredRecents = store.recents.filter((item) => allowedPaths.has(item.path));
  const results = useMemo(
    () => searchNavigationDestinations(searchableDestinations, query),
    [searchableDestinations, query],
  );

  const canonicalDestination = (destination: NavigationDestination | StoredNavigationDestination) =>
    destinations.find((item) => item.path === destination.path) ?? destination;

  const go = (destination: NavigationDestination | StoredNavigationDestination) => {
    recordRecentDestination(userId, toStored(canonicalDestination(destination)));
    setOpen(false);
    setQuery("");
    if (destination.path !== pathname) navigate(destination.path);
    setStoreVersion((value) => value + 1);
  };

  const onToggleFavourite = (event: React.MouseEvent, destination: NavigationDestination | StoredNavigationDestination) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavourite(userId, toStored(canonicalDestination(destination)));
    setStoreVersion((value) => value + 1);
  };

  const renderItem = (destination: NavigationDestination | StoredNavigationDestination, prefix: string) => {
    const canonical = canonicalDestination(destination);
    const Icon = (canonical as NavigationDestination).Icon;
    const pinned = favouritePaths.has(destination.path);
    const displayLabel = translateFMLabel(language, canonical.label);
    const displayHub = canonical.hubLabel ? translateFMLabel(language, canonical.hubLabel) : undefined;
    const favouriteLabel = translateFMText(
      language,
      pinned ? "removeFavourite" : "addFavourite",
      { label: displayLabel },
    );
    return (
      <CommandItem
        key={`${prefix}-${destination.path}`}
        value={`${displayLabel} ${displayHub ?? ""} ${(destination.keywords ?? []).join(" ")}`}
        onSelect={() => go(destination)}
        className="gap-2"
      >
        {Icon ? <Icon className="h-4 w-4 text-fm-fg-muted" aria-hidden /> : <Search className="h-4 w-4 text-fm-fg-muted" aria-hidden />}
        <span>{displayLabel}</span>
        {displayHub && <span className="ml-auto text-[10px] text-fm-fg-muted">{displayHub}</span>}
        <button
          type="button"
          className="ml-2 rounded p-1 text-fm-fg-muted hover:bg-fm-panel-2 hover:text-fm-accent"
          aria-label={favouriteLabel}
          onClick={(event) => onToggleFavourite(event, destination)}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
        </button>
      </CommandItem>
    );
  };

  const currentDisplayLabel = currentDestination ? translateFMLabel(language, currentDestination.label) : "";

  return (
    <>
      {currentDestination?.favouriteEligible && (
        <div className="fixed bottom-14 right-3 z-30 hidden md:block">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-fm-border bg-fm-panel text-xs"
            onClick={(event) => onToggleFavourite(event, currentDestination)}
            aria-label={translateFMText(
              language,
              favouritePaths.has(currentDestination.path) ? "removeFavourite" : "addFavourite",
              { label: currentDisplayLabel },
            )}
          >
            <Star className="h-3.5 w-3.5" aria-hidden />
            {translateFMText(language, favouritePaths.has(currentDestination.path) ? "favourited" : "favourite")}
          </Button>
        </div>
      )}
      <CommandDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
        <CommandInput
          aria-label={translateFMText(language, "searchDestinations")}
          placeholder={translateFMText(language, "searchPlaceholder")}
          value={query}
          onValueChange={setQuery}
        />
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">{translateFMText(language, "searchHelp")}</div>
        <CommandList className="max-h-[min(65vh,520px)]">
          <CommandEmpty>{translateFMText(language, "noNavigationResults", { query })}</CommandEmpty>
          {!query.trim() && filteredFavourites.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">{translateFMText(language, "noFavourites")}</div>}
          {!query.trim() && filteredFavourites.length > 0 && <CommandGroup heading={translateFMText(language, "favourites")}>{filteredFavourites.map((item) => renderItem(item, "fav"))}</CommandGroup>}
          {!query.trim() && filteredRecents.length > 0 && <CommandGroup heading={translateFMText(language, "recent")}>{filteredRecents.map((item) => renderItem(item, "recent"))}</CommandGroup>}
          {!query.trim() && (filteredFavourites.length > 0 || filteredRecents.length > 0) && <CommandSeparator />}
          <CommandGroup heading={translateFMText(language, query.trim() ? "results" : "commonDestinations")}>{results.map((item) => renderItem(item, "result"))}</CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default FMCommandPalette;
