import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

/**
 * FM24-styled tabs. Underline active state, flat, compact density.
 */
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 w-full items-center justify-start gap-0 overflow-x-auto flex-nowrap border-b border-fm-border bg-fm-panel-2 px-1 text-fm-fg-muted scrollbar-hide",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3 h-9 text-xs font-medium uppercase tracking-wide transition-colors",
      "text-fm-fg-muted hover:text-fm-fg",
      "data-[state=active]:text-fm-accent",
      "data-[state=active]:after:absolute data-[state=active]:after:left-2 data-[state=active]:after:right-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-[2px] data-[state=active]:after:bg-fm-accent",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fm-accent",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fm-accent",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
