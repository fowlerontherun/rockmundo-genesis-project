import { cva } from "class-variance-authority";

/**
 * Unified RockMundo button variants.
 *
 * Canonical variants:
 *   - primary    → solid accent (#6C5CE7)            [also: default]
 *   - secondary  → elevated surface                  [also: outline visual sibling]
 *   - danger     → destructive red (#FF5252)         [also: destructive]
 *   - ghost      → transparent
 *   - link       → text link
 *
 * `default`, `destructive`, and `outline` are kept as aliases so existing
 * call-sites continue to render with the unified design tokens.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-ds-sm",
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-ds-sm",
        secondary:
          "bg-elevated text-elevated-foreground border border-border hover:bg-elevated/80",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-ds-sm",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-ds-sm",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-elevated hover:text-elevated-foreground",
        ghost: "hover:bg-elevated hover:text-elevated-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
