# Subscription route ownership fix

The authenticated `/subscription` and `/subscription-status` routes are owned by the Shop module. This keeps VIP/subscription pages inside the correct FM navigation context and ensures the authenticated route ownership audit treats them as explicitly owned routes.

A focused regression test covers both paths.
