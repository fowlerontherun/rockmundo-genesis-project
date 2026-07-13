# Player discovery, matching and privacy

The player discovery layer is exposed at `/community/players` and `/social/players`. It searches public-safe profile data only and delegates filtering, pagination, blocked-user exclusion and match scoring to `search_player_discovery`.

## Match inputs

The baseline server-side score intentionally uses broad public signals:

- required instrument match: +25
- preferred genre match: +15
- same visible in-game city: +15
- looking for band: +8
- willing to travel: +4

The RPC returns a percentage, category and short human-readable reasons such as `Plays bass` or `In your city`. It does not return exact private skills, hidden city values, online timestamps or moderation/account fields.

## Privacy and anti-inference behaviour

- Private profiles are excluded by `can_view_public_profile_summary`.
- Blocked users are excluded before counts or result rows are produced.
- City filters and city reasons only use city data when the target profile's city visibility is public.
- Skill search is designed around public proficiency bands in `player_discovery_profiles.public_skill_bands`; hidden numeric skill values are not queried.
- Result totals are approximate and may be omitted for small result sets to reduce inference risk.
- Saved-search alert fields are stored for future compatibility, but this implementation does not send notifications.
