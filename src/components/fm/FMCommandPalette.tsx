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
  const results = useMemo(() => searchNavigationDestinations(destinations, query), [destinations, query]);

  const go = (destination: NavigationDestination | StoredNavigationDestination) => {
    recordRecentDestination(userId, toStored(destination));
    setOpen(false);
    setQuery("");
    if (destination.path !== pathname) navigate(destination.path);
    setStoreVersion((value) => value + 1);
  };

  const onToggleFavourite = (event: React.MouseEvent, destination: NavigationDestination | StoredNavigationDestination) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavourite(userId, toStored(destination));
    setStoreVersion((value) => value + 1);
  };

  const renderItem = (destination: NavigationDestination | StoredNavigationDestination, prefix: string) => {
    const Icon = "Icon" in destination ? destination.Icon : undefined;
    const pinned = favouritePaths.has(destination.path);
    return (
      <CommandItem
        key={`${prefix}-${destination.path}`}
        value={`${destination.label} ${destination.hubLabel ?? ""} ${(destination.keywords ?? []).join(" ")}`}
        onSelect={() => go(destination)}
        className="gap-2"
      >
        {Icon ? <Icon className="h-4 w-4 text-fm-fg-muted" aria-hidden /> : <Search className="h-4 w-4 text-fm-fg-muted" aria-hidden />}
        <span>{destination.label}</span>
        {destination.hubLabel && <span className="ml-auto text-[10px] text-fm-fg-muted">{destination.hubLabel}</span>}
        <button
          type="button"
          className="ml-2 rounded p-1 text-fm-fg-muted hover:bg-fm-panel-2 hover:text-fm-accent"
          aria-label={pinned ? `Remove ${destination.label} from favourites` : `Add ${destination.label} to favourites`}
          onClick={(event) => onToggleFavourite(event, destination)}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
        </button>
      </CommandItem>
    );
  };

  return (
    <>
      {currentDestination?.favouriteEligible && (
        <div className="fixed bottom-14 right-3 z-30 hidden md:block">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-fm-border bg-fm-panel text-xs"
            onClick={(event) => onToggleFavourite(event, currentDestination)}
            aria-label={favouritePaths.has(currentDestination.path) ? `Remove ${currentDestination.label} from favourites` : `Add ${currentDestination.label} to favourites`}
          >
            <Star className="h-3.5 w-3.5" aria-hidden />
            {favouritePaths.has(currentDestination.path) ? "Favourited" : "Favourite"}
          </Button>
        </div>
      )}
      <CommandDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
        <CommandInput
          aria-label="Search navigation destinations"
          placeholder="Search navigation — pages, hubs and actions…"
          value={query}
          onValueChange={setQuery}
        />
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">Press Ctrl+K or Cmd+K to open. Search covers navigation destinations, not gameplay data.</div>
        <CommandList className="max-h-[min(65vh,520px)]">
          <CommandEmpty>No navigation results for “{query}”. Try browsing the closest hub.</CommandEmpty>
          {!query.trim() && filteredFavourites.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No favourites yet. Pin destinations from results or the current page.</div>}
          {!query.trim() && filteredFavourites.length > 0 && <CommandGroup heading="Favourites">{filteredFavourites.map((item) => renderItem(item, "fav"))}</CommandGroup>}
          {!query.trim() && filteredRecents.length > 0 && <CommandGroup heading="Recent">{filteredRecents.map((item) => renderItem(item, "recent"))}</CommandGroup>}
          {!query.trim() && (filteredFavourites.length > 0 || filteredRecents.length > 0) && <CommandSeparator />}
          <CommandGroup heading={query.trim() ? "Results" : "Common destinations"}>{results.map((item) => renderItem(item, "result"))}</CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default FMCommandPalette;
