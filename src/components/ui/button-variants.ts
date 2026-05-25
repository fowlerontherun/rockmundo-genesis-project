import { cva } from "class-variance-authority";

/**
 * Unified RockMundo button system.
 *
 * CTA hierarchy (use ONE primary per screen):
 *   - primary    → solid accent, dominant CTA          [also: default]
 *   - secondary  → elevated surface, supporting action [also: outline visual sibling]
 *   - danger     → destructive red                     [also: destructive]
 *   - ghost      → transparent, tertiary action
 *   - link       → inline text link
 *
 * Sizes are tuned for mobile-first tap targets (≥44px on default/lg/icon).
 * Disabled state is non-interactive with reduced contrast but stays legible.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md",
    "text-sm font-semibold tracking-tight",
    "ring-offset-background transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-60 disabled:saturate-50 disabled:shadow-none disabled:active:scale-100",
    "aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-ds-md hover:bg-primary/90 hover:shadow-ds-lg",
        default:
          "bg-primary text-primary-foreground shadow-ds-md hover:bg-primary/90 hover:shadow-ds-lg",
        secondary:
          "bg-elevated text-elevated-foreground border border-border hover:bg-elevated/80",
        danger:
          "bg-destructive text-destructive-foreground shadow-ds-sm hover:bg-destructive/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-ds-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-elevated hover:text-elevated-foreground",
        ghost: "hover:bg-elevated hover:text-elevated-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Default size meets the 44px mobile tap target minimum.
        default: "min-h-11 h-11 px-5 py-2",
        sm: "min-h-9 h-9 rounded-md px-3 text-xs",
        lg: "min-h-12 h-12 rounded-md px-6 text-base",
        icon: "min-h-11 h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
