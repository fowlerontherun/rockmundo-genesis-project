# Crew wages: September 2026 economy rebalance

The previous crew progression release connected each hired worker's full salary to every gig they attended. That made large technical teams expensive relative to smaller venues' ticket sales.

The September wage rebalance **halves all current crew salaries and every hireable crew candidate's displayed wage**. New hires inherit the revised candidate salaries through the existing authoritative hiring RPC. The existing gig-preparation and completion calculations already read these contracted wages, so no separate deduction or second 50% multiplier is needed.

Open and in-progress gigs with saved crew assignments have their costs updated to the new contract amount. Declined staff still cost zero in the gig cost calculation. **Completed, cancelled, failed and financially settled gigs retain their original assignment and outcome records**, so their published profits and past payments do not change retroactively.

The data adjustment writes an internal version marker to `crew_wage_balance_history` so a second migration replay cannot cut wages again. Only the service role can read the marker. The same crew members keep their existing XP, skill, cohesion, gig history and show-quality contribution.

## Balance check

Before the cut, the live game had 400 crew catalog entries with a combined per-gig salary of $559,660, and 14 hired staff with a combined full-roster salary of $16,710. The 50% balance reduces those amounts to $279,830 and $8,355 respectively. The live values may subsequently change as staff are recruited and released.

This is a targeted payroll balance correction, not a guarantee that every show will turn a profit: bands still need ticket income, venue selection and production spend appropriate to their size.

The release SQL check is `supabase/tests/crew_wage_halving_harness.sql`. The dry-run also captures historic gig outcome balances and proves that reapplying the migration leaves salaries unchanged.
