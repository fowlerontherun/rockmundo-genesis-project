import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Users, Coins, Flag } from "lucide-react";
import { useParties } from "@/hooks/useParties";
import { Link } from "react-router-dom";

type SortKey = "total_strength" | "member_count" | "mayor_count" | "treasury_balance";

const formatMoney = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

interface Props {
  sortKey: SortKey;
  title: string;
  icon: React.ReactNode;
  unit: string;
  formatter?: (v: number) => string;
}

export function PartyStandingsTable({ sortKey, title, icon, unit, formatter }: Props) {
  const { data: parties, isLoading } = useParties();

  const sorted = [...(parties ?? [])].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">No parties registered yet.</p>
        )}
        {sorted.map((p, idx) => {
          const value = p[sortKey] ?? 0;
          const display = formatter ? formatter(value) : `${value.toLocaleString()} ${unit}`;
          const rankBadge =
            idx === 0
              ? "bg-warning/15 text-warning border-warning/40"
              : idx === 1
                ? "bg-muted text-foreground border-border"
                : idx === 2
                  ? "bg-accent/15 text-accent-foreground border-accent/40"
                  : "bg-card text-muted-foreground border-border";
          return (
            <Link
              key={p.id}
              to="/political-party"
              className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className={`${rankBadge} text-xs w-7 justify-center`}>
                  {idx + 1}
                </Badge>
                <span
                  className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.colour_hex }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.member_count} members · {p.mayor_count} mayors
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">{display}</span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function PartyStandingsGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PartyStandingsTable
        sortKey="total_strength"
        title="Strength"
        icon={<Trophy className="h-4 w-4 text-warning" />}
        unit="pts"
      />
      <PartyStandingsTable
        sortKey="mayor_count"
        title="Mayors Held"
        icon={<Crown className="h-4 w-4 text-primary" />}
        unit="cities"
      />
      <PartyStandingsTable
        sortKey="member_count"
        title="Members"
        icon={<Users className="h-4 w-4 text-accent-foreground" />}
        unit="players"
      />
      <PartyStandingsTable
        sortKey="treasury_balance"
        title="Treasury"
        icon={<Coins className="h-4 w-4 text-success" />}
        unit=""
        formatter={formatMoney}
      />
    </div>
  );
}

export function PartyStandingsHeader() {
  return (
    <div className="flex items-center gap-2">
      <Flag className="h-6 w-6 text-primary" />
      <div>
        <h1 className="text-2xl font-bold">Party Standings</h1>
        <p className="text-sm text-muted-foreground">
          Global rankings across strength, mayors held, membership, and treasury.
        </p>
      </div>
    </div>
  );
}
