# City Scene Refinements

This follow-up tightens the city-specific Underground / Nightclub scene system after the initial city-scene foundation landed.

- Scene contacts remember the city where they were first discovered.
- City scene visit counts are tied to completed travel arrivals rather than Scene Story interactions.
- High reputation in a strong rival scene creates a mild local-reputation friction (one point less gain, never below one) rather than blocking content or changing story success chance.
- The city scene panel shows real arrival counts, rival-city reputation and when rivalry pressure is active.
- Client access to scene reference/reputation tables remains SELECT-only; mutation happens through guarded server functions/triggers.
