export const asObject = (v: unknown): Record<string, any> => (v && typeof v === "object" ? (v as Record<string, any>) : {});
export const asArray = (v: unknown): any[] => Array.isArray(v) ? v : [];
export const text = (v: unknown, fallback: unknown = "—") => v === null || v === undefined || v === "" ? String(fallback) : String(v);
export const money = (cents?: unknown, currency = "USD") => typeof cents === "number" ? new Intl.NumberFormat(undefined,{style:"currency",currency}).format(cents/100) : "—";
export const pct = (n: number, d: number) => d > 0 ? Math.round((n/d)*100) : 0;
export const statusTone = (s?: string) => /approved|complete|ready|active|covered/i.test(s||"") ? "default" : /blocked|rejected|expired|overdue|missing/i.test(s||"") ? "destructive" : "secondary";
export const canManage = (permissions: any, area: "stages"|"staff"|"permits"|"insurance"|"finance") => {
  if (permissions?.admin || permissions?.manageEdition || permissions?.manageOperations || permissions?.manageFinance) return true;
  if (area === "stages") return Boolean(permissions?.stageManager || permissions?.manageStages || permissions?.manageSlots);
  if (area === "permits") return Boolean(permissions?.safetyOfficer || permissions?.inspectPermits);
  if (area === "insurance" || area === "finance") return Boolean(permissions?.financeManager || permissions?.manageFinance);
  return Boolean(permissions?.operationsManager);
};
export const lifecycleReadOnly = (status?: string) => ["live","settling","completed","cancelled","abandoned"].includes(status || "");
export const lifecycleWarns = (status?: string) => ["announced","on_sale","setup"].includes(status || "");
export function daysUntil(start?: string | null) { if (!start) return null; return Math.ceil((new Date(start).getTime()-Date.now())/86400000); }
export function supportRef(code = "FESTIVAL_OPERATION") { return `Reference ${code}.`; }
export function friendlyError(error: unknown) { const m = error instanceof Error ? error.message : String(error || ""); if (/permission/i.test(m)) return `You do not have permission for this action. ${supportRef("FESTIVAL_PERMISSION_DENIED")}`; if (/overlap/i.test(m)) return `This slot overlaps another booking. ${supportRef("FESTIVAL_SLOT_OVERLAP")}`; if (/deadline/i.test(m)) return `The permit deadline has passed. ${supportRef("FESTIVAL_PERMIT_DEADLINE")}`; if (/expired/i.test(m)) return `This quote or permit has expired. ${supportRef("FESTIVAL_EXPIRED")}`; if (/currency/i.test(m)) return `Currency mismatch detected. ${supportRef("FESTIVAL_CURRENCY_MISMATCH")}`; return `Festival service is unavailable or returned invalid data. ${supportRef("FESTIVAL_RPC_UNAVAILABLE")}`; }
