import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio } from "lucide-react";
import { RMRadioButton } from "@/components/radio/RMRadioPlayer";

const RadioPlayerPage = () => {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            RM Radio Player
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RMRadioButton className="w-full justify-center h-10 text-sm" />
        </CardContent>
      </Card>
    </div>
  );
};

export default RadioPlayerPage;
