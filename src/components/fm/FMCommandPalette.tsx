import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FM_MODULES } from "@/config/fmNavigation";
import { useUserRole } from "@/hooks/useUserRole";

type Entry = {
  label: string;
  path: string;
  group: string;
  Icon?: React.ElementType;
};

export const FMCommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
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

  const { quick, byModule } = useMemo(() => {
    const modules = FM_MODULES.filter((m) => m.id !== "admin" || isAdmin());
    const quick: Entry[] = [];
    const byModule: { module: string; entries: Entry[] }[] = [];
    for (const mod of modules) {
      for (const a of mod.quickActions ?? []) {
        quick.push({ label: a.label, path: a.path, group: mod.label, Icon: a.icon });
      }
      const seen = new Set<string>();
      const entries: Entry[] = [];
      for (const t of mod.subTabs) {
        if (seen.has(t.path)) continue;
        seen.add(t.path);
        entries.push({ label: t.label, path: t.path, group: mod.label, Icon: t.icon });
      }
      for (const s of mod.sidebar) {
        for (const it of s.items) {
          if (seen.has(it.path)) continue;
          seen.add(it.path);
          entries.push({ label: it.label, path: it.path, group: mod.label, Icon: it.icon });
        }
      }
      byModule.push({ module: mod.label, entries });
    }
    return { quick, byModule };
  }, [isAdmin]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to anything — pages, actions, modules…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {quick.length > 0 && (
          <>
            <CommandGroup heading="Quick Actions">
              {quick.map((e) => (
                <CommandItem key={`q-${e.path}-${e.label}`} value={`${e.label} ${e.group} action create`} onSelect={() => go(e.path)}>
                  {e.Icon && <e.Icon className="mr-2 h-3.5 w-3.5 text-fm-accent" />}
                  <span>{e.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-fm-fg-muted">{e.group}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {byModule.map((g) => (
          <CommandGroup key={g.module} heading={g.module}>
            {g.entries.map((e) => (
              <CommandItem key={`${g.module}-${e.path}`} value={`${e.label} ${g.module}`} onSelect={() => go(e.path)}>
                {e.Icon && <e.Icon className="mr-2 h-3.5 w-3.5 text-fm-fg-muted" />}
                <span>{e.label}</span>
                <span className="ml-auto text-[10px] text-fm-fg-muted tabular-nums">{e.path}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

export default FMCommandPalette;
