# Education System - University Classes

## Overview
The education system allows players to enroll in university courses to improve specific skills and earn XP daily.

## How It Works

### Daily Attendance & XP Awards
- **Class Time**: 10 AM - 2 PM (game time)
- **Daily XP**: Courses award XP based on course configuration (xp_per_day_min to xp_per_day_max)
- **Auto-Attendance**: Players can enable auto-attend to automatically mark attendance at 10 AM daily
- **Skill Progression**: XP is applied to the course's target skill, with automatic level-ups when thresholds are met

### Automated System
A cron job runs daily at 10 AM UTC to process auto-attendance:
- Checks all enrollments with `auto_attend = true`
- Creates attendance records if not already attended today
- Awards random XP within course's range
- Updates skill progress and handles level-ups
- Logs activity to experience ledger
- Updates player's total experience

### Manual Attendance
Players can also manually attend class during class hours (10 AM - 2 PM):
- Click "Attend Class" button on university detail page
- Earns XP immediately
- Increases skill level if XP threshold reached
- Updates enrollment progress

## Database Tables

### player_university_enrollments
- Tracks student enrollment in courses
- `auto_attend` - enables automatic daily attendance
- `days_attended` - total days student has attended
- `total_xp_earned` - cumulative XP earned from this course
- `status` - enrolled, in_progress, completed, or dropped

### player_university_attendance
- Daily attendance log
- `attendance_date` - the date attended
- `xp_earned` - XP awarded for that day
- `was_locked_out` - if true, skips activity feed logging

### university_courses
- Course definitions
- `skill_slug` - which skill this course improves
- `xp_per_day_min` / `xp_per_day_max` - XP range per attendance
- `base_duration_days` - expected course length
- `required_skill_level` - prerequisite skill level

## Skill Progression Formula
- Starting XP requirement: 100
- Each level multiplies requirement by 1.5x
- Multiple level-ups can occur in one attendance if XP is high enough
- XP overflows to next level automatically

## Benefits
- **Passive Learning**: Auto-attend allows hands-off skill progression
- **Guaranteed Progress**: Daily XP awards ensure consistent growth
- **Multiple Skills**: Different courses target different skills
- **Activity Logging**: All XP is logged to experience ledger for tracking

## UI Components
- **UniversityTab**: Browse and enroll in universities
- **UniversityDetail**: View courses, enroll, and attend classes
- **AttendanceCard**: Dedicated component for class attendance with auto-attend toggle
- **EnrollmentProgressCard**: Shows current enrollment progress
- **CurrentLearningSection**: Dashboard widget showing active enrollment

## Edge Function
`supabase/functions/university-attendance/index.ts`
- Processes all enrollments with auto_attend enabled
- Runs via cron job daily at 10 AM
- Awards XP, updates skills, and logs activity
