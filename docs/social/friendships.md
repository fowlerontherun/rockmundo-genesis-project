# Friendship states and transitions

RockMundo stores one canonical friendship row for a profile pair in `friendships`. The pair is unique regardless of who initiated the request.

## States

- `pending` — requester sent a request and recipient has not responded.
- `accepted` — both players are friends; friends-only profile fields can be resolved server-side.
- `declined` — recipient declined; resend is controlled by the server cooldown.
- `cancelled` — requester cancelled an outgoing pending request.
- `removed` — an accepted friendship was removed without blocking either player.
- `expired` — a pending request was aged out by future expiry jobs.
- `blocked` — legacy safety state treated as restricted by connection-state APIs.

## Allowed transitions

| From | Action | To | Actor |
| --- | --- | --- | --- |
| none/terminal | Send request | `pending` | requester |
| `pending` | Accept | `accepted` | recipient |
| `pending` | Decline | `declined` | recipient |
| `pending` | Cancel | `cancelled` | requester |
| `accepted` | Remove friend | `removed` | either participant |

The server RPCs are the source of truth for authorization, privacy checks, duplicate prevention and lifecycle timestamps. Clients should call `get_connection_state` or `usePlayerConnection` instead of reconstructing relationship logic.
