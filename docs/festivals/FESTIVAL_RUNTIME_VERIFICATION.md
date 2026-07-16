# Festival Runtime Verification

Required local/CI commands for this corrective PR:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run build
supabase db reset
```

Festival-specific verification must include the forward migration `20291214080000_repair_and_expose_festival_features.sql`, settlement readiness/prepare compatibility, authorised settlement report projection, stage-slot consistency, and route smoke coverage for public, owner and admin festival pages.
