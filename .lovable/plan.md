
# Underworld Admin Skill Dropdown & Recording Studio Booking Update

## Version: 1.0.498

## Overview
This update addresses two key improvements:
1. **Underworld Admin**: Replace the manual text input for `skill_slug` with a searchable dropdown populated from the skill tree hierarchy
2. **Recording Studio Booking**: Add date and time slot selection to mirror the rehearsal booking flow

---

## Part 1: Underworld Admin Skill Dropdown

### Current State
The product edit/create form uses a plain text `Input` for `skill_slug` (lines 664-672 in `UnderworldAdmin.tsx`):
```tsx
<Input
  value={newProduct.effects.skill_slug}
  onChange={(e) => setNewProduct({...})}
  placeholder="e.g., guitar_speed"
/>
```

### Solution
Replace with a searchable `Select` dropdown populated from `SKILL_TREE_DEFINITIONS` (which contains 200+ skill definitions with slugs like `songwriting_basic_composing`, `instruments_basic_acoustic_guitar`, etc.)

### Files to Modify

**src/pages/admin/UnderworldAdmin.tsx**
- Import `SKILL_TREE_DEFINITIONS` from `@/data/skillTree`
- Add a `useMemo` hook to create sorted skill options grouped by category
- Replace the `Input` for `skill_slug` with a `Select` component featuring:
  - Searchable dropdown with all skills
  - Grouped by category (Genres, Instruments, Songwriting, etc.)
  - Display format: `Display Name (slug)`
  - Option to clear selection

### Implementation Details

```text
+-------------------------------+
|  Skill Slug Selection         |
+-------------------------------+
| [Select a skill...]        v  |
+-------------------------------+
| Genres                        |
|   Basic Rock (genres_basic_rock)
|   Pro Rock (genres_professional_rock)
| Instruments                   |
|   Basic Acoustic Guitar       |
|   Pro Electric Guitar         |
| Songwriting                   |
|   Basic Composing             |
|   ...                         |
+-------------------------------+
```

---

## Part 2: Recording Studio Booking Flow Update

### Current State
The `SessionConfigurator` component only allows selecting:
- Duration (2, 3, or 4 hours)
- Orchestra size (optional)

It does **not** include:
- Date selection
- Time slot selection (like rehearsals use)

### How Rehearsals Work (Target Pattern)
The `RehearsalBookingDialog` uses:
1. **Room Selection** - Radio group with room details
2. **Date Selection** - Calendar popover
3. **Duration Selection** - Dropdown (2, 4, 6, 8 hours = 1-4 slots)
4. **Time Slot Selection** - Grid of slots with availability status
5. **Song/Setlist Selection**

It uses:
- `REHEARSAL_SLOTS` (6 x 2-hour slots)
- `useRehearsalRoomAvailability` hook for slot status
- `getSlotTimeRange()` to calculate scheduled start/end

### Recording Studio Pattern (To Implement)
The recording booking already has:
- `STUDIO_SLOTS` (4 x 4-hour slots: Morning, Afternoon, Evening, Late Night)
- `useStudioAvailability` hook (already exists!)
- `StudioSlotSelector` component (already exists but not used in wizard!)

### Solution
Modify `SessionConfigurator` to add date and slot selection before duration/orchestra, similar to rehearsals:

1. Add state for `selectedDate` and `selectedSlotId`
2. Add Calendar popover for date selection
3. Add slot selection grid using `STUDIO_SLOTS` and `useStudioAvailability`
4. Remove duration selection (studio slots are fixed 4-hour blocks)
5. Update `createSession.mutateAsync` to include `scheduled_start` and `scheduled_end`

### Files to Modify

**src/components/recording/SessionConfigurator.tsx**
- Add date and slot selection state
- Import Calendar, Popover, and slot utilities
- Add `useStudioAvailability` hook call
- Add date picker UI (Calendar in Popover)
- Add slot selection grid (similar to RehearsalBookingDialog)
- Update session creation to include scheduled times

**src/hooks/useRecordingData.ts** (if needed)
- Ensure `createRecordingSession` accepts `scheduled_start` and `scheduled_end` parameters

### UI Flow After Update

```text
Recording Wizard Tabs:
[Studio] -> [Song] -> [Version?] -> [Producer] -> [Configure]

Configure Tab (Updated):
+------------------------------------------+
| Recording Date                           |
| [Calendar Button: Wed, Jan 22, 2026]  v  |
+------------------------------------------+
| Time Slot                                |
| +----------------+ +----------------+    |
| | Morning 9-1pm  | | Afternoon 2-6pm|    |
| | [Available]    | | [Booked]       |    |
| +----------------+ +----------------+    |
| +----------------+ +----------------+    |
| | Evening 7-11pm | | Late Night 12-4|    |
| | [Available]    | | [Available]    |    |
| +----------------+ +----------------+    |
+------------------------------------------+
| Orchestra (Optional)                     |
| [ ] Chamber Orchestra                    |
| [ ] Small Orchestra                      |
| [ ] Full Orchestra                       |
+------------------------------------------+
| Cost Breakdown                           |
| Studio (4 hrs): $X                       |
| Producer (4 hrs): $X                     |
| Total: $X                                |
+------------------------------------------+
| [Cancel]  [Start Recording ($X)]         |
+------------------------------------------+
```

---

## Technical Implementation

### Part 1: Skill Dropdown (UnderworldAdmin.tsx)

1. Add import:
```tsx
import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";
```

2. Add memoized skill options:
```tsx
const skillOptions = useMemo(() => {
  const grouped: Record<string, { slug: string; name: string }[]> = {};
  
  SKILL_TREE_DEFINITIONS.forEach(def => {
    const category = def.metadata?.category as string || 'Other';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push({
      slug: def.slug,
      name: def.display_name
    });
  });
  
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, skills]) => ({
      category,
      skills: skills.sort((a, b) => a.name.localeCompare(b.name))
    }));
}, []);
```

3. Replace Input with Select:
```tsx
<Select
  value={newProduct.effects.skill_slug}
  onValueChange={(v) => setNewProduct({
    ...newProduct,
    effects: { ...newProduct.effects, skill_slug: v }
  })}
>
  <SelectTrigger>
    <SelectValue placeholder="Select a skill..." />
  </SelectTrigger>
  <SelectContent className="max-h-[300px]">
    <SelectItem value="">None</SelectItem>
    {skillOptions.map(group => (
      <React.Fragment key={group.category}>
        <SelectItem disabled value={`__${group.category}`}>
          {group.category}
        </SelectItem>
        {group.skills.map(skill => (
          <SelectItem key={skill.slug} value={skill.slug}>
            {skill.name}
          </SelectItem>
        ))}
      </React.Fragment>
    ))}
  </SelectContent>
</Select>
```

### Part 2: Recording Session Scheduling (SessionConfigurator.tsx)

1. Add imports:
```tsx
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Ban, CheckCircle } from "lucide-react";
import { STUDIO_SLOTS, getSlotTimeRange } from "@/utils/facilitySlots";
import { useStudioAvailability } from "@/hooks/useStudioAvailability";
import { isSlotInPast } from "@/utils/timeSlotValidation";
import { cn } from "@/lib/utils";
```

2. Add state:
```tsx
const [selectedDate, setSelectedDate] = useState<Date>(new Date());
const [selectedSlotId, setSelectedSlotId] = useState<string>('');
```

3. Add availability hook:
```tsx
const { data: slotAvailability, isLoading: loadingSlots } = useStudioAvailability(
  studio.id,
  selectedDate,
  bandId,
  true
);
```

4. Add date picker card (before Duration card):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Recording Date</CardTitle>
  </CardHeader>
  <CardContent>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(selectedDate, 'PPP')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => { if (date) { setSelectedDate(date); setSelectedSlotId(''); }}}
          disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
        />
      </PopoverContent>
    </Popover>
  </CardContent>
</Card>
```

5. Add slot selection card:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Time Slot</CardTitle>
  </CardHeader>
  <CardContent>
    <RadioGroup value={selectedSlotId} onValueChange={setSelectedSlotId}>
      <div className="grid grid-cols-2 gap-2">
        {STUDIO_SLOTS.map(slot => {
          const slotData = slotAvailability?.find(s => s.slot.id === slot.id);
          const isBooked = slotData?.isBooked || false;
          const isPast = isSlotInPast(slot, selectedDate);
          const canSelect = !isBooked && !isPast;
          
          return (
            <div key={slot.id} className={cn(
              'flex items-center space-x-2 rounded-lg border p-3',
              selectedSlotId === slot.id && 'border-primary bg-primary/5',
              isPast && 'opacity-60 cursor-not-allowed',
              isBooked && 'bg-red-500/10 border-red-500/30',
              canSelect && 'cursor-pointer hover:bg-accent/50'
            )} onClick={() => canSelect && setSelectedSlotId(slot.id)}>
              <RadioGroupItem value={slot.id} disabled={!canSelect} />
              <div className="flex-1">
                <Label>{slot.name}</Label>
                <div className="text-xs text-muted-foreground">
                  {slot.startTime} - {slot.endTime}
                </div>
                {isBooked && <Badge variant="destructive">Booked</Badge>}
                {isPast && <Badge variant="secondary">Passed</Badge>}
                {canSelect && <Badge variant="outline" className="bg-green-500/10">Available</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </RadioGroup>
  </CardContent>
</Card>
```

6. Update duration logic:
- Remove duration selection (fixed 4-hour slots)
- Set `durationHours = 4` as constant
- Update cost calculations accordingly

7. Update session creation:
```tsx
const slot = STUDIO_SLOTS.find(s => s.id === selectedSlotId);
if (!slot) throw new Error('Select a time slot');
const { start, end } = getSlotTimeRange(slot, selectedDate);

await createSession.mutateAsync({
  // ...existing params
  scheduled_start: start.toISOString(),
  scheduled_end: end.toISOString(),
});
```

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/pages/admin/UnderworldAdmin.tsx` | Add skill dropdown with grouped options from SKILL_TREE_DEFINITIONS |
| `src/components/recording/SessionConfigurator.tsx` | Add date picker, slot selection grid, use fixed 4-hour duration |
| `src/hooks/useRecordingData.ts` | Ensure scheduled_start/end are passed through (verify existing) |
| `src/components/VersionHeader.tsx` | Update to v1.0.498 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Version History Entry

**v1.0.498**
- Admin: Underworld product skill selection now uses dropdown with all skills from skill tree
- Recording: Added date and time slot selection to recording session booking (mirrors rehearsal flow)
- Recording: Sessions now use fixed 4-hour time slots (Morning, Afternoon, Evening, Late Night)
