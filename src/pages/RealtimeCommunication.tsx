import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Music } from "lucide-react";
import RealtimeChatPanel from "@/components/chat/RealtimeChatPanel";

const RealtimeCommunication: React.FC = () => {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RockMundo Live</h1>
          <p className="text-muted-foreground">
            Real-time communication and collaboration
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RealtimeChatPanel channelKey="general" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              <span>Jam Sessions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Jam session features will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeCommunication;
