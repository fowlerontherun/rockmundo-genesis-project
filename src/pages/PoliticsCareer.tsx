import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Building, Flag, Landmark, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const LADDER = [
  { tier: 1, title: "Activist", desc: "Join a party or write endorsement articles" },
  { tier: 2, title: "Party Officer", desc: "Promoted by founder; helps run member affairs" },
  { tier: 3, title: "City Councillor", desc: "Win a district seat (mini-role)" },
  { tier: 4, title: "Mayor", desc: "Win a city election" },
  { tier: 5, title: "Party Leader", desc: "Founder of a party with 10+ members" },
  { tier: 6, title: "Cabinet Member", desc: "Appointed by other mayors via parliament motion" },
  { tier: 7, title: "Coalition Speaker", desc: "Lead an alliance of parties" },
  { tier: 8, title: "World Parliament Speaker", desc: "Elected by all sitting mayors" },
  { tier: 9, title: "Statesman", desc: "Retire as ex-mayor; passive speaking-fee income" },
  { tier: 10, title: "Founding Father/Mother", desc: "Pass 25+ historic motions" },
];

export default function PoliticsCareerPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8 text-primary" />
          Politics Career
        </h1>
        <p className="text-sm text-muted-foreground">Climb the political ladder from activist to world speaker.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/political-party">
          <Card className="hover:bg-muted/40 transition cursor-pointer">
            <CardContent className="py-4 flex items-center gap-3">
              <Flag className="h-6 w-6 text-primary" />
              <div><p className="font-semibold">Political Parties</p><p className="text-xs text-muted-foreground">Found or join</p></div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/world-parliament">
          <Card className="hover:bg-muted/40 transition cursor-pointer">
            <CardContent className="py-4 flex items-center gap-3">
              <Landmark className="h-6 w-6 text-primary" />
              <div><p className="font-semibold">World Parliament</p><p className="text-xs text-muted-foreground">Motions & votes</p></div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/skills">
          <Card className="hover:bg-muted/40 transition cursor-pointer">
            <CardContent className="py-4 flex items-center gap-3">
              <Award className="h-6 w-6 text-primary" />
              <div><p className="font-semibold">Politics Skills</p><p className="text-xs text-muted-foreground">Train governance, oratory, diplomacy…</p></div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="h-5 w-5" /> Career Ladder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {LADDER.map((rung) => (
            <div key={rung.tier} className="flex items-start gap-3 p-2 rounded-md border border-border">
              <Badge variant="outline" className="font-mono">T{rung.tier}</Badge>
              <div>
                <p className="text-sm font-semibold">{rung.title}</p>
                <p className="text-xs text-muted-foreground">{rung.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Future Expansions</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• <strong>Lobbying:</strong> companies pay parties to push motions</p>
          <p>• <strong>Scandals:</strong> corruption / affairs / plagiarism events</p>
          <p>• <strong>Inter-party debates</strong> at major venues with revenue split</p>
          <p>• <strong>Coalitions:</strong> allied parties share vote bonuses</p>
          <p>• <strong>Referendums:</strong> high-statecraft mayors push global laws</p>
          <p>• <strong>Diplomatic missions</strong> + trade-deal bonuses</p>
          <p>• <strong>Political journalism</strong> subcareer with endorsement articles</p>
          <p>• <strong>Term limits & retirement</strong> with Statesman passive income</p>
        </CardContent>
      </Card>
    </div>
  );
}
