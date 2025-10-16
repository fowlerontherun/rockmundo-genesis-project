# Simplified Songwriting Sprint System

## Overview
The songwriting system has been simplified to provide a streamlined experience with auto-completion and fixed session durations.

## Key Changes

### 1. Fixed 3-Hour Sessions
- All songwriting sessions now last **exactly 3 hours**
- Removed complex "effort level" selection (low/medium/high)
- Sessions automatically complete after 3 hours
- No manual completion button needed on project cards

### 2. Auto-Completion System
- Sessions auto-complete when the 3-hour lock expires
- Edge function `cleanup-songwriting` handles auto-completion
- Database function `auto_complete_songwriting_sessions()` processes expired sessions
- Auto-checks run on page load and when tab becomes visible (max once per minute)

### 3. Progress Display
- **Database**: Still uses 0-2000 scale (preserves existing data)
- **UI**: Shows as 0-100% for clarity
- Each 3-hour session adds 500-700 points (25-35% progress)
- Takes 3-7 sessions to complete a song (9-21 hours total)

### 4. Simplified UI
The project card now shows only essential information:
- Title, genre, theme
- Music progress bar (0-100%)
- Lyrics progress bar (0-100%)
- Sessions completed / estimated total
- Status: "Ready to start" or "Completes in X hours"
- Simple action buttons: Start Session, History, Edit, Delete

**Removed from cards:**
- Effort level selection
- Session participants (co-writers, producers, musicians)
- Sprint roster section
- Inspiration/mood modifiers display
- Complex creative brief data
- Manual "Complete Sprint" button

### 5. Database Schema
- Added `auto_completed` boolean to `songwriting_sessions` table
- Database function automatically calculates progress based on skills
- Sessions track whether they were auto-completed vs manually completed

### 6. Workflow

**Starting a session:**
1. User clicks "Start Session"
2. Project locks for 3 hours
3. Session record created with `session_start`

**During session:**
- Project shows "Completes in X hours" countdown
- User can work on other activities
- No need to manually track time

**After 3 hours:**
- Edge function auto-completes session
- Adds 500-700 music progress
- Adds 500-700 lyrics progress  
- Earns XP (progress / 10)
- Unlocks project automatically
- Shows toast notification on next page visit

**When project reaches 100%:**
- Both music_progress >= 2000 AND lyrics_progress >= 2000
- Shows `SongCompletionDialog` automatically
- User chooses: Keep Private, Add to Band, List on Market, or Gift
- Converts to full song with quality calculation

## Preserved Features

All core functionality is preserved:
- Song quality calculation
- Theme and chord progression selection
- AI lyrics generator
- Creative brief (stored but not displayed on cards)
- Sprint history viewing
- Song conversion with quality breakdown
- All song fields (quality scores, ratings, etc.)

## Technical Implementation

### Edge Function
`supabase/functions/cleanup-songwriting/index.ts`
- Calls `auto_complete_songwriting_sessions()` database function
- Returns count of completed sessions
- Runs via cron job or manual invocation

### Database Function
`auto_complete_songwriting_sessions()`
- Finds sessions where `locked_until` has passed
- Calculates skill-based progress gains (500-700 each)
- Updates session with completion timestamps
- Updates project progress
- Unlocks project
- Marks sessions as `auto_completed = true`

### Frontend Auto-Check
- Runs on page mount
- Runs when tab becomes visible
- Throttled to once per minute
- Shows toast for completed sessions
- Refreshes project list

## Benefits

1. **Simpler UX**: Less complexity, clearer progress tracking
2. **Auto-magic**: Sessions complete automatically, no manual clicking
3. **Mobile-friendly**: Cleaner cards work better on small screens
4. **Focus on progress**: Visual progress bars show clear advancement
5. **Time-efficient**: Fixed duration removes decision fatigue
6. **Better pacing**: 3-7 sessions provides good game pacing
7. **Preserved depth**: All data still captured, just hidden from cards
