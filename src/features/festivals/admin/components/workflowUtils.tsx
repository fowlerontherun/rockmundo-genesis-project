import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function WorkflowState({ title, message, variant = "default", action }: { title: string; message: string; variant?: "default" | "destructive" | "outline"; action?: ReactNode }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2">{title}<Badge variant={variant}>{variant === "destructive" ? "action needed" : "state"}</Badge></CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground">{message}{action ? <div>{action}</div> : null}</CardContent></Card>;
}

export const money = (cents?: number | null, currency = "USD") => typeof cents === "number" ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100) : "Unavailable";
export const text = (value: unknown, fallback: string | number = "Unavailable") => value === null || value === undefined || value === "" ? String(fallback) : String(value);
export const asArray = (value: unknown): any[] => Array.isArray(value) ? value : [];
export const asObject = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
