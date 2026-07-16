# Festival owner management UI guide

Open `/festivals/:festivalId/manage` to select the first authorised edition, or deep-link to `/festivals/:festivalId/manage/editions/:editionId`.

Use the edition selector before operating. Changing editions invalidates edition-scoped query keys for stages, staff, permits, insurance, finance, outcomes and settlement.

Owner tabs now include real screens for stages/slots, staff, permits, insurance, finance, outcomes and settlement. Actions call server RPCs and may remain disabled when the lifecycle, permission projection, or migration state blocks the action.
