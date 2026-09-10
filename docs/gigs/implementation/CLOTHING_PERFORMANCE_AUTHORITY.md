# Clothing performance authority

Equipped clothing performance bonuses are resolved server-side during `complete-gig`.

The modifier is applied after production, soundcheck and missing-member adjustments, but before `settle_gig_commerce` and all performance-dependent downstream rewards.

This means commerce, fame, fan conversion, chemistry, morale, reputation, member XP, inbox summaries and milestones all consume the same boosted `avgRating`.

The band modifier is the average of active, non-touring members' capped equipped clothing performance bonuses. The final gig rating remains capped at 25.

`gig_outcomes.xp_breakdown.clothing_performance` records the percentage, member count, rating before and after the modifier, resolver name and rating cap for auditability.