import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, Clock, List } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { addDays, startOfWeek } from "date-fns";

const Schedule = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Schedule</h1>
          <p className="text-muted-foreground">Plan your activities and manage your time</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'day' ? 'default' : 'outline'}
            onClick={() => setViewMode('day')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Day View
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            onClick={() => setViewMode('week')}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Week View
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? -1 : -7))}
        >
          Previous {viewMode === 'day' ? 'Day' : 'Week'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setCurrentDate(new Date())}
        >
          Today
        </Button>
        <Button
          variant="outline"
          onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? 1 : 7))}
        >
          Next {viewMode === 'day' ? 'Day' : 'Week'}
        </Button>
      </div>

      {viewMode === 'day' ? (
        <DaySchedule date={currentDate} userId={user?.id} />
      ) : (
        <div className="grid gap-4">
          {weekDays.map(day => (
            <DaySchedule key={day.toISOString()} date={day} userId={user?.id} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Schedule;