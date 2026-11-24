# Social & roleplay upgrade

## What exists today
- Friends, player browser, private messages, invitations, referrals and contracts under Social.
- Band chat, Twaater posts/messages, nightclubs with live "who's here" lists and choice-based scenes.
- Relationships page (very large, ~2,400 lines) with reputation axes, emotional states and rewards.
- Social activities (catalogue of hangouts) and community posts.

## Gaps found
- No shared place to talk "in character" with whoever is in the same city or venue.
- Messages are plain text only: no emotes/actions, no in-character vs out-of-character marking.
- Relationship changes come mostly from menus, not from actually talking or roleplaying.
- No way to set your character's mood, bio "hooks" or what kind of roleplay you're open to.
- Moderation tools (report, block, mute) are spread out and not visible inside chats.

## Phase 1 — Fix and tidy (first)
- Test friends, messages, invitations and band chat signed in; fix any failures.
- Show unread message counts consistently in the menu.
- Add block / mute / report buttons inside every chat.

## Phase 2 — Location chat ("The Room")
- Live chat for everyone in the same city, and a separate one per venue/nightclub while you're there.
- Shows who's present with their avatar, band and current mood.
- Messages expire after 24 real hours to keep it lively.

## Phase 3 — Roleplay tools
- `/me` actions (e.g. "*Big Fowler slams his pint down*") shown in italics.
- In-character / out-of-character toggle; OOC messages shown greyed out.
- Character mood/status line and a short "roleplay hooks" section on profiles
  (e.g. "looking for a drummer", "feuding with The Shockmasters").
- Roleplay preferences: open to romance, rivalry, collaboration, or off.

## Phase 4 — Interactions that matter
- Quick interactions from any chat or profile: buy a drink, compliment, insult, flirt, offer to jam, challenge to a battle.
- Each one nudges the relationship axes, respects cooldowns and the other player's preferences, and gives a small social XP reward (capped daily).
- Scenes: invite 2–6 players to a private roleplay scene at a venue, with a shared log that can be saved to both characters' history.

## Phase 5 — Visibility
- Activity feed entries for big moments (new friendships, rivalries, scenes).
- Optional Twaater post when a public scene ends.

## Technical details
- New tables: location chat messages, roleplay scenes + members + messages, interaction log; all scoped by character (profile), with access rules so you only read rooms you're in.
- Interactions and rewards go through server-side actions with cooldowns and daily caps; never written straight from the browser.
- Realtime subscriptions per room with cleanup; message length limits and rate limits.
- Version banner and history updated each phase.
