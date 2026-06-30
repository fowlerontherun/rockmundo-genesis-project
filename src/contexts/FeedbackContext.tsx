import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from"react";
import { Zap, DollarSign, Users, Star, Trophy, Sparkles, Check } from"lucide-react";
import { cn } from"@/lib/utils";

export type FeedbackKind ="xp"|"money"|"fans"|"fame"|"success"|"levelup"|"achievement";

interface FeedbackPopup {
 id: string;
 kind: FeedbackKind;
 amount?: number;
 label?: string;
 message?: string;
}

interface FeedbackContextValue {
 notify: (p: Omit<FeedbackPopup,"id">) => void;
 xp: (amount: number, label?: string) => void;
 money: (amount: number, label?: string) => void;
 fans: (amount: number, label?: string) => void;
 fame: (amount: number, label?: string) => void;
 success: (message: string) => void;
 levelUp: (level: number, label?: string) => void;
 achievement: (title: string) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export const useFeedback = () => {
 const ctx = useContext(FeedbackContext);
 if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
 return ctx;
};

const CONFIG: Record<FeedbackKind, { icon: any; cls: string; prefix?: string }> = {
 xp: { icon: Zap, cls:"from-warning/95 to-warning/70 text-warning-foreground", prefix:"+"},
 money: { icon: DollarSign,cls:"from-success/95 to-success/70 text-success-foreground", prefix:"+$"},
 fans: { icon: Users, cls:"from-primary/95 to-primary/70 text-primary-foreground", prefix:"+"},
 fame: { icon: Star, cls:"from-accent/95 to-accent/70 text-accent-foreground", prefix:"+"},
 success: { icon: Check, cls:"from-success/95 to-success/70 text-success-foreground"},
 levelup: { icon: Sparkles, cls:"from-primary/95 via-accent/90 to-warning/80 text-primary-foreground"},
 achievement: { icon: Trophy, cls:"from-warning/95 via-accent/90 to-primary/80 text-warning-foreground"},
};

const formatAmount = (n: number) => {
 if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/,"") +"M";
 if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/,"") +"k";
 return n.toLocaleString();
};

const PopupItem = ({ p, onDone }: { p: FeedbackPopup; onDone: () => void }) => {
 const big = p.kind ==="levelup"|| p.kind ==="achievement";
 const cfg = CONFIG[p.kind];
 const Icon = cfg.icon;

 useEffect(() => {
 const t = setTimeout(onDone, big ? 2400 : 1800);
 return () => clearTimeout(t);
 }, [onDone, big]);

 if (big) {
 return (
 <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
 <div className={cn("rmd-celebrate flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br px-8 py-6 shadow-2xl ring-2 ring-white/20 backdrop-blur-sm",
 cfg.cls,
 )}>
 <Icon className="h-10 w-10 drop-shadow-md"/>
 <div className="text-xs opacity-80">
 {p.kind ==="levelup"?"Level Up":"Achievement"}
 </div>
 <div className="text-2xl font-bold">
 {p.kind ==="levelup"? `Level ${p.amount}` : p.message}
 </div>
 {p.label && <div className="text-sm opacity-90">{p.label}</div>}
 </div>
 </div>
 );
 }

 return (
 <div className={cn("rmd-float pointer-events-none flex items-center gap-2 rounded-full bg-gradient-to-r px-3 py-1.5 text-sm font-semibold shadow-lg ring-1 ring-white/10",
 cfg.cls,
 )}>
 <Icon className="h-4 w-4"/>
 <span>
 {cfg.prefix ??""}
 {typeof p.amount ==="number"? formatAmount(p.amount) :""}
 {p.label ? ` ${p.label}` :""}
 {!p.amount && p.message ? p.message :""}
 </span>
 </div>
 );
};

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
 const [items, setItems] = useState<FeedbackPopup[]>([]);

 const notify = useCallback((p: Omit<FeedbackPopup,"id">) => {
 const id = crypto.randomUUID();
 setItems((prev) => [...prev, { ...p, id }].slice(-6));
 }, []);

 const remove = useCallback((id: string) => {
 setItems((prev) => prev.filter((i) => i.id !== id));
 }, []);

 const value: FeedbackContextValue = {
 notify,
 xp: (amount, label) => notify({ kind:"xp", amount, label: label ??"XP"}),
 money: (amount, label) => notify({ kind:"money", amount, label }),
 fans: (amount, label) => notify({ kind:"fans", amount, label: label ??"fans"}),
 fame: (amount, label) => notify({ kind:"fame", amount, label: label ??"fame"}),
 success: (message) => notify({ kind:"success", message }),
 levelUp: (level, label) => notify({ kind:"levelup", amount: level, label }),
 achievement: (title) => notify({ kind:"achievement", message: title }),
 };

 const stack = items.filter((i) => i.kind !=="levelup"&& i.kind !=="achievement");
 const celebration = items.find((i) => i.kind ==="levelup"|| i.kind ==="achievement");

 return (
 <FeedbackContext.Provider value={value}>
 {children}
 <div className="pointer-events-none fixed right-4 top-20 z-[90] flex flex-col items-end gap-2 sm:right-6">
 {stack.map((p) => (
 <PopupItem key={p.id} p={p} onDone={() => remove(p.id)} />
 ))}
 </div>
 {celebration && <PopupItem key={celebration.id} p={celebration} onDone={() => remove(celebration.id)} />}
 </FeedbackContext.Provider>
 );
};
