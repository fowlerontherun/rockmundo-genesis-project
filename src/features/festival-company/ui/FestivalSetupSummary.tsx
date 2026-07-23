import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalCompanySetupState } from "../domain/festivalSetup";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const FestivalSetupSummary = ({ setup }: { setup: FestivalCompanySetupState }) => (
  <Card>
    <CardHeader><CardTitle>{setup.publicName}</CardTitle></CardHeader>
    <CardContent className="grid gap-3 text-sm md:grid-cols-2">
      <div><span className="text-muted-foreground">Legal company</span><p className="font-medium">{setup.legalCompanyName}</p></div>
      <div><span className="text-muted-foreground">Company balance</span><p className="font-medium">{money.format(setup.companyBalance)}</p></div>
      <div><span className="text-muted-foreground">Setup status</span><p className="font-medium capitalize">{setup.setupStatus}</p></div>
      <div><span className="text-muted-foreground">Owner</span><p className="font-medium">{setup.ownerDisplayName}</p></div>
      <div><span className="text-muted-foreground">Founded</span><p className="font-medium">{new Date(setup.foundedAt).toLocaleDateString()}</p></div>
      <div><span className="text-muted-foreground">First edition</span><p className="font-medium">{setup.firstEditionExists ? "Created" : "Not created yet"}</p></div>
      <div><span className="text-muted-foreground">Basic configuration</span><p className="font-medium">{setup.configurationComplete ? "Complete" : "Incomplete"}</p></div>
      <div><span className="text-muted-foreground">Company status</span><p className="font-medium capitalize">{setup.companyStatus}</p></div>
    </CardContent>
  </Card>
);
