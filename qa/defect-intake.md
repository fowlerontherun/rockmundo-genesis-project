# RockMundo verified defect intake

Use this checklist only after reproducing a defect. A static route mismatch, an untested checklist item, or an absent report is not sufficient evidence of a gameplay bug.

## Before filing
- [ ] Search existing open and closed issues for the same symptom and affected feature.
- [ ] Reproduce on a safe environment using an approved test account.
- [ ] Capture the tested build SHA, environment, date/time and account role.
- [ ] Confirm the issue is not simply missing test data, a known permission rule, or a stale client.
- [ ] Check whether the failure is already covered by an existing issue; link and update it instead of creating a duplicate.

## Issue body template

**Summary:** A concise, observable symptom

**Priority:** P0 / P1 / P2 / P3 / P4 (see `qa/README.md`)

**Area / journey:** Link to `qa/priority-journeys.json` entry when applicable

**Environment / build SHA:**

**Role and safe test fixture:** Never include passwords, tokens, personal identifiers or production customer data

**Preconditions:**

**Reproduction steps:**
1.
2.
3.

**Expected behaviour:**

**Actual behaviour:**

**Evidence:** Sanitised screenshots, logs, traces, or test run URLs

**Impact:** Players affected, progression/payment risk, frequency, workaround

**Affected route / backend surface:**

**Related issues / deduplication search:**

**Suggested regression test:**

## Closure criteria

The issue may be closed only after a fix is merged, relevant automated tests pass, the reported reproduction is retested in the target environment, and evidence of the verification is linked. Deployment status must be stated separately from merge status.
