# Twaater Content Moderation System

## Overview
The Twaater platform now includes comprehensive content moderation features to prevent abuse, harassment, and maintain a positive community environment.

## Features Implemented

### 1. **Content Reporting**
- Users can report posts for:
  - Spam or misleading content
  - Harassment or bullying
  - Inappropriate or offensive content
  - Misinformation
  - Other reasons
- Optional additional details can be provided
- Each user can only report a post once
- All reports are tracked in `twaat_reports` table

### 2. **User Blocking**
- Users can block other accounts
- Blocked users' posts are automatically hidden from the blocker's feed
- Block/unblock functionality via UI
- Blocks are tracked in `twaater_blocks` table

### 3. **Automated Content Filtering**
- Admin-managed filter word system
- Three severity levels: Low, Medium, High
- Three automatic actions:
  - **Flag**: Mark for manual review
  - **Hide**: Automatically hide from public view
  - **Reject**: Prevent post from being created
- Filter words are case-insensitive
- Triggered on post creation

### 4. **Moderation Dashboard** (`/admin/twaater-moderation`)
- **Reports Tab**:
  - View all user-submitted reports
  - Filter by status (pending, reviewed, actioned, dismissed)
  - See report reason, content, reporter, and timestamp
  - Quick actions: Hide post, Dismiss report
  - Track moderation actions and reviewer

- **Filter Words Tab**:
  - Add new filter words with severity and action
  - View all active filter words
  - Remove filter words
  - See impact of each filter

### 5. **Post Moderation UI**
- Three-dot menu on each post (for non-own posts)
- Options:
  - Report post (opens dialog)
  - Block user
- Clean, unobtrusive interface
- Confirmation prompts for destructive actions

## Database Schema

### New Tables
```sql
-- Reports tracking
twaat_reports
  - id (UUID)
  - twaat_id (FK to twaats)
  - reporter_account_id (FK to twaater_accounts)
  - report_reason (enum: spam, harassment, inappropriate, misinformation, other)
  - report_details (text, optional)
  - status (enum: pending, reviewed, actioned, dismissed)
  - created_at, reviewed_at, reviewed_by

-- User blocks
twaater_blocks
  - blocker_account_id (FK to twaater_accounts)
  - blocked_account_id (FK to twaater_accounts)
  - created_at

-- Filter words
twaater_filter_words
  - id (UUID)
  - word (text, unique)
  - severity (enum: low, medium, high)
  - auto_action (enum: flag, hide, reject)
  - created_at, created_by
```

### Modified Tables
```sql
-- Added to twaats table
twaats
  + is_flagged (boolean)
  + flag_reason (text)
  + moderation_status (enum: approved, pending, rejected, hidden)
  + moderated_at (timestamp)
  + moderated_by (UUID FK to auth.users)
```

## Security & Permissions

### Row-Level Security (RLS) Policies

**Reports:**
- Anyone (authenticated) can create reports
- Users can view their own reports
- Admins can view and update all reports

**Blocks:**
- Users can create, view, and delete their own blocks
- No cross-user visibility

**Filter Words:**
- Everyone can view (for transparency)
- Only admins can create/update/delete

**Post Visibility:**
- Public posts are visible to everyone EXCEPT:
  - Posts from blocked accounts
  - Posts with moderation_status = 'hidden' or 'rejected'

## User Flow

### Reporting a Post
1. User clicks three-dot menu on a post
2. Selects "Report post"
3. Dialog opens with reason selection
4. Optional: Add additional details
5. Submit report
6. Report appears in admin moderation dashboard

### Blocking a User
1. User clicks three-dot menu on a post
2. Selects "Block @username"
3. Confirmation prompt
4. User is blocked, their posts disappear from feed

### Admin Moderation Workflow
1. Admin navigates to `/admin/twaater-moderation`
2. Reviews pending reports
3. For each report:
   - View full post content
   - See report reason and details
   - Choose action: Hide post or Dismiss report
4. Hidden posts become invisible to users
5. Report status updated to "actioned" or "dismissed"

## Implementation Details

### Client-Side Hooks
- `useTwaaterModeration`: Handles reporting, blocking, and moderation actions
- `useTwaats`: Updated to respect blocked users in queries
- `useTwaaterFeed`: Excludes blocked accounts from feed

### Components
- `TwaatReportDialog`: Modal for submitting reports
- `TwaatCard`: Updated with moderation menu
- `TwaaterModeration` (admin page): Full moderation dashboard

### Database Trigger
- `check_twaat_content()`: Runs before insert on twaats
- Checks post body against filter words
- Applies automatic actions (flag/hide/reject)

## Future Enhancements
- Automated sentiment analysis
- Machine learning-based spam detection
- User reputation system
- Appeal process for moderation decisions
- Community guidelines page
- Moderation logs and analytics
- Rate limiting for reports to prevent abuse
- Shadow banning capabilities
- Temporary mutes/restrictions

## Configuration

### Adding Filter Words
1. Navigate to Admin > Twaater Moderation
2. Click "Filter Words" tab
3. Enter word/phrase
4. Select severity (Low/Medium/High)
5. Select action (Flag/Hide/Reject)
6. Click "Add Filter Word"

### Reviewing Reports
1. Navigate to Admin > Twaater Moderation
2. Click "Reports" tab
3. Filter by status if needed
4. Review each report
5. Take action: Hide or Dismiss

## Best Practices

### For Users
- Report genuinely problematic content
- Provide context in report details
- Use blocking sparingly for persistent issues
- Don't abuse the reporting system

### For Admins
- Review reports promptly
- Be consistent in moderation decisions
- Document reasoning for actions
- Update filter words based on emerging patterns
- Monitor for false positives
- Communicate community guidelines clearly

## Testing Considerations
- Test reporting with various reasons
- Verify blocking hides posts correctly
- Check filter words trigger properly
- Ensure RLS policies prevent unauthorized access
- Test admin dashboard functionality
- Verify moderation actions update correctly
- Test edge cases (self-reports, multiple reports, etc.)
