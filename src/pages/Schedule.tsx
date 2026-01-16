import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { addDays, startOfWeek, format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import { GigLocationWarning } from "@/components/notifications/GigLocationWarning";

const Schedule = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="container mx-auto p-3 md:p-4 space-y-3 md:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Schedule</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Plan and manage your activities</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => navigate('/booking/songwriting')}>
            Songwriting
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/booking/performance')}>
            Performance
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/booking/education')}>
            Education
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/booking/work')}>
            Life
          </Button>
        </div>
      </div>

      <GigLocationWarning />
      
      <div className="flex items-center justify-between flex-wrap gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? -1 : -7))}
          >
            <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
          >
            <span className="text-xs md:text-sm">Today</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? 1 : 7))}
          >
            <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'day' ? 'default' : 'outline'}
            onClick={() => setViewMode('day')}
          >
            <Calendar className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
            <span className="hidden md:inline">Day</span>
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'week' ? 'default' : 'outline'}
            onClick={() => setViewMode('week')}
          >
            <CalendarDays className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
            <span className="hidden md:inline">Week</span>
          </Button>
        </div>
      </div>

      {viewMode === 'day' ? (
        <DaySchedule date={currentDate} userId={user?.id} />
      ) : (
        <Tabs defaultValue={format(weekDays[0], 'yyyy-MM-dd')} className="w-full">
          <TabsList className="w-full grid grid-cols-7 h-auto">
            {weekDays.map(day => (
              <TabsTrigger 
                key={day.toISOString()} 
                value={format(day, 'yyyy-MM-dd')}
                className="flex flex-col py-1.5 md:py-2"
              >
                <span className="text-xs">{format(day, 'EEE')}</span>
                <span className="text-base md:text-lg font-bold">{format(day, 'd')}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {weekDays.map(day => (
            <TabsContent key={day.toISOString()} value={format(day, 'yyyy-MM-dd')}>
              <DaySchedule date={day} userId={user?.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default Schedule;
