import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/useTranslation";

const personalIncome = [
  { source: "Gig Payouts", amount: "$1,200", cadence: "Monthly" },
  { source: "Merch Sales", amount: "$450", cadence: "Bi-weekly" },
  { source: "Streaming Royalties", amount: "$220", cadence: "Monthly" },
];

const personalExpenses = [
  { category: "Rent", amount: "$850", cadence: "Monthly" },
  { category: "Equipment Upgrades", amount: "$300", cadence: "Quarterly" },
  { category: "Travel", amount: "$180", cadence: "Per trip" },
];

const bandIncome = [
  { source: "Tour Revenue", amount: "$8,500", cadence: "Per tour" },
  { source: "Sponsorships", amount: "$2,000", cadence: "Quarterly" },
  { source: "Crowdfunding", amount: "$1,100", cadence: "Campaign" },
];

const bandExpenses = [
  { category: "Rehearsal Space", amount: "$600", cadence: "Monthly" },
  { category: "Marketing", amount: "$750", cadence: "Campaign" },
  { category: "Logistics", amount: "$1,200", cadence: "Per tour" },
];

const investmentHoldings = [
  { name: "Music ETF", value: "$3,400", change: "+4.2%" },
  { name: "Creator Fund", value: "$1,850", change: "+1.3%" },
  { name: "Studio Co-op", value: "$2,200", change: "+6.1%" },
];

const loanOffer = {
  name: "Creative Expansion Loan",
  amount: "$15,000",
  rate: "6.5% APR",
  term: "36 months",
  perks: [
    "No payments for the first 60 days",
    "Flexible collateral (gear or future royalties)",
    "Includes quarterly financial coaching calls",
  ],
};

const Finances = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Financial Command Center</h1>
        <p className="text-muted-foreground">
          Monitor personal and band finances, track investments, and explore funding pathways to keep your music dreams
          funded.
        </p>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="band">Band</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Income Streams</CardTitle>
                <CardDescription>Track every dollar supporting your solo career.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personalIncome.map((income) => (
                      <TableRow key={income.source}>
                        <TableCell className="font-medium">{income.source}</TableCell>
                        <TableCell>{income.cadence}</TableCell>
                        <TableCell className="text-right">{income.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>Prepare for upcoming costs before they hit your wallet.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personalExpenses.map((expense) => (
                      <TableRow key={expense.category}>
                        <TableCell className="font-medium">{expense.category}</TableCell>
                        <TableCell>{expense.cadence}</TableCell>
                        <TableCell className="text-right">{expense.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="band" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Band Income</CardTitle>
                <CardDescription>Group revenue from tours, merch, and supporters.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bandIncome.map((income) => (
                      <TableRow key={income.source}>
                        <TableCell className="font-medium">{income.source}</TableCell>
                        <TableCell>{income.cadence}</TableCell>
                        <TableCell className="text-right">{income.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Band Expenses</CardTitle>
                <CardDescription>Shared obligations that keep the crew moving.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bandExpenses.map((expense) => (
                      <TableRow key={expense.category}>
                        <TableCell className="font-medium">{expense.category}</TableCell>
                        <TableCell>{expense.cadence}</TableCell>
                        <TableCell className="text-right">{expense.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Investments</CardTitle>
            <CardDescription>Diversify your earnings and watch your net worth grow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holding</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investmentHoldings.map((holding) => (
                  <TableRow key={holding.name}>
                    <TableCell className="font-medium">{holding.name}</TableCell>
                    <TableCell>{holding.value}</TableCell>
                    <TableCell className="text-right text-emerald-500">{holding.change}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <Button variant="outline">Check Investments</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Options</CardTitle>
            <CardDescription>Explore financing to accelerate your next big move.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{loanOffer.name}</p>
              <p className="text-sm text-muted-foreground">Up to {loanOffer.amount}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Rate</p>
                <p className="font-semibold">{loanOffer.rate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Term</p>
                <p className="font-semibold">{loanOffer.term}</p>
              </div>
            </div>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              {loanOffer.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Apply for Loan</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Finances;
