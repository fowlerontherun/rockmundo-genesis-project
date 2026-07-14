import "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toBeInTheDocument(): T;
    toBeDisabled(): T;
    toBeEnabled(): T;
    toBeVisible(): T;
    toHaveAttribute(name: string, value?: string | RegExp): T;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace?: boolean }): T;
    toHaveClass(...classNames: string[]): T;
    toHaveStyle(style: string | Record<string, unknown>): T;
    toHaveValue(value?: string | string[] | number | null): T;
    toBeChecked(): T;
    toBeRequired(): T;
    toHaveAccessibleName(name?: string | RegExp): T;
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): T;
    toHaveFormValues(values: Record<string, unknown>): T;
    toHaveFocus(): T;
  }
}