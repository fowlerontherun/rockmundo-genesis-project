# Festival upgrade catalogue v2 deployment

Run `festival_upgrade_v2_predeploy.sql` **before** deploying the v2 migration. It reports every incompatible mutable row and exits non-zero without changing it. Export that output to the deployment ticket; review evidence cannot survive an exception raised in the same migration transaction.

Remediation is deliberately manual: an administrator must investigate each company and record an approved mapping in the deployment ticket before issuing explicit, reviewed `UPDATE` statements. This repository provides no procedure that guesses money or ownership.

For databases where v2 has not applied, run the pre-deployment diagnostic, remediate externally, deploy migrations, and run the post-deployment diagnostic. For databases where v2 already applied, do not rerun or edit the shared migration; apply the forward hardening migration and run the post-deployment diagnostic. Historical catalogue rows and edition snapshots must never be changed.

Weekly upkeep and all timetable rules remain unchanged. Annual upgrade charging is intentionally outside this corrective change.
