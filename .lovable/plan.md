
# Hide Admin Nav for Non-Admins + Admin User Management (v1.0.769)

## What Changes

1. **Hide the Admin navigation section** from both the sidebar and horizontal nav for users who are not admins. Currently every user can see the "Admin" heading and link.

2. **New Admin User Management page** (`/admin/user-roles`) accessible from the Admin Dashboard, allowing admins to:
   - View all users and their current roles (admin/moderator/user)
   - Promote users to admin or moderator
   - Demote admins/moderators back to user
   - Search users by username or email

---

## Technical Details

### 1. Conditionally hide Admin nav section

**Files:** `src/components/ui/navigation.tsx`, `src/components/ui/HorizontalNavigation.tsx`

- Import `useUserRole` hook in both navigation components
- Filter the `navSections` array to exclude the section with `titleKey: "nav.admin"` when `isAdmin()` returns false
- The `useUserRole` hook already exists and provides `isAdmin()` -- no new DB queries needed

### 2. New Admin User Management component

**New file:** `src/components/admin/AdminUserRoles.tsx`

- Fetches all rows from `user_roles` joined with `profiles` (for username/avatar)
- Displays a table of users with their current role
- Admin can change a user's role via a dropdown (admin/moderator/user)
- Updates the `user_roles` table on change
- Search/filter by username
- Protected by `AdminRoute` wrapper

### 3. New page + route

**New file:** `src/pages/admin/AdminUserRoles.tsx` -- thin wrapper around the component

**Modified file:** `src/App.tsx` -- add route `admin/user-roles`

### 4. Add tile to Admin Dashboard

**Modified file:** `src/pages/AdminDashboard.tsx` -- add a "User Roles" card tile in the admin grid linking to `/admin/user-roles`

### 5. Version bump

- `VersionHeader.tsx`: bump to `1.0.769`
- `VersionHistory.tsx`: add changelog entry

### Files changed (summary)
| File | Change |
|------|--------|
| `src/components/ui/navigation.tsx` | Import `useUserRole`, filter out admin section for non-admins |
| `src/components/ui/HorizontalNavigation.tsx` | Same filter logic |
| `src/components/admin/AdminUserRoles.tsx` | **New** -- user role management UI |
| `src/pages/admin/AdminUserRoles.tsx` | **New** -- page wrapper |
| `src/App.tsx` | Add lazy import + route for `admin/user-roles` |
| `src/pages/AdminDashboard.tsx` | Add "User Roles" tile card |
| `src/components/VersionHeader.tsx` | Version bump |
| `src/pages/VersionHistory.tsx` | Changelog entry |
