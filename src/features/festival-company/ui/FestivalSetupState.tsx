import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const FestivalSetupState = ({ title, message }: { title: string; message: string }) => (
  <Card>
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent><p className="text-muted-foreground">{message}</p></CardContent>
  </Card>
);
