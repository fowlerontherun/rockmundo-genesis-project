import { JamSessionsTab } from "@/components/performance/JamSessionsTab";

export default function JamSessions() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Jam Sessions</h1>
        <p className="text-muted-foreground mt-2">
          Connect with other musicians and create music together
        </p>
      </div>
      <JamSessionsTab />
    </div>
  );
}
