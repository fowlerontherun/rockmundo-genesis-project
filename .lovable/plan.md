

## Player Search Enhancement

### Overview
Expand the Player Search page to show richer profile details for each result and add inline **Friend Request** and **Private Message** buttons.

### What Changes

**1. Richer profile data in search results**

The query will be expanded to also fetch: `fame`, `fans`, `level`, `total_hours_played`, `current_city_id`, and the player's current city name (via a join to `cities`). Each result card will display:
- Fame score and Level badges (like PlayerProfileCard)
- Fan count
- Current city name
- Hours played
- Bio (already shown, but expanded from 1 line to 2)
- Band memberships (already shown)

**2. Friend Request button**

Each player card gets an "Add Friend" button. The page will:
- Use `useGameData` to get the current player's profile ID
- Use `useFriendships` to load existing friendships
- For each search result, determine the friendship state:
  - **Already friends** -- show "Friends" badge (disabled)
  - **Pending (sent by you)** -- show "Request Sent" (disabled)
  - **Pending (sent to you)** -- show "Accept" button
  - **No relationship** -- show "Add Friend" button that calls `sendRequest(targetProfileId)`
- Skip showing friend/message buttons on the player's own profile

**3. Private Message button**

Each player card gets a "Message" button that:
- Builds a DM channel key using `resolveRelationshipPairKey(myProfileId, targetProfileId)`
- Navigates to the existing Friend Detail panel or opens a dialog with the `DirectMessagePanel` component
- Since DMs currently live inside the relationships feature, clicking "Message" will navigate to `/social/friends` with the target profile pre-selected, or open an inline DM dialog

For simplicity and discoverability, clicking "Message" will open a small dialog containing the `DirectMessagePanel` component directly on the search page.

### Technical Details

**Files modified:**
- `src/pages/PlayerSearch.tsx` -- main changes:
  - Expand Supabase query to include `fame, fans, level, total_hours_played, current_city_id, cities!profiles_current_city_id_fkey(name)`
  - Import and use `useGameData` for current profile
  - Import and use `useFriendships` for friendship state lookups
  - Import `resolveRelationshipPairKey` and `DirectMessagePanel` for inline DM
  - Add `Dialog` for DM panel
  - Redesign each result card to show expanded stats and action buttons
- `src/components/VersionHeader.tsx` -- bump to v1.0.752
- `src/pages/VersionHistory.tsx` -- add changelog entry

**No new database tables or edge functions needed** -- everything uses existing infrastructure.

