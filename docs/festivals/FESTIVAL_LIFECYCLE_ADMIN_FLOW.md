# Festival Lifecycle Admin Flow

Lifecycle administration is server-projected and server-authorised. The UI must not invent readiness rules; it renders the transition data returned by `admin_festival_edition_lifecycle_options`.

## Transition selection

Every projected transition is displayed with title, explanation, warnings and blockers. Unavailable transitions remain visible when blockers explain why the administrator cannot proceed.

## Confirmation and override

Transitions marked `confirmationRequired` open an application confirmation dialog. Destructive transitions require typed confirmation. Overrides are only available when `adminOverrideAllowed` is true and require an explicit toggle plus an administrator reason. Override is submitted with `p_override = true` only after confirmation.

## Idempotency

The frontend generates one operation key when an administrator starts a transition attempt. The key is reused for duplicate submission or network retry and replaced after success, cancellation or choosing a materially different transition.
