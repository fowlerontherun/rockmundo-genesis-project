import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/privileged-scheduler-edge-cutover.yml", "utf8");
const playbook = readFileSync("docs/operations/PRIVILEGED_SCHEDULER_EDGE_CUTOVER.md", "utf8");
const targetJobs = [
  "generate-gig-offers", "generate-pr-offers", "generate-radio-invitations",
  "complete-release-manufacturing", "process-tour-travel", "auto-complete-gigs",
];

describe("review-gated six-worker Edge rollout (#4255)", () => {
  it("cannot deploy from a PR, other project or unconfirmed workflow dispatch", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("inputs.project_ref == 'yztogmdixmchsmimtent'");
    expect(workflow).toContain("inputs.confirmation == 'DEPLOY_SIX_PROTECTED_SCHEDULERS'");
    expect(workflow).toContain("inputs.staging_receipt != ''");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("preflights database grants and class windows before deploying the six intended handlers", () => {
    expect(workflow).toContain("privileged_job_scheduler_harness.sql");
    expect(workflow).toContain("university_auto_scheduler_and_class_window_harness.sql");
    expect(workflow.indexOf("privileged_job_scheduler_harness.sql")).toBeLessThan(
      workflow.indexOf('supabase functions deploy "$slug"'),
    );
    const deployment = workflow.slice(workflow.indexOf("for slug in"), workflow.indexOf("done\n", workflow.indexOf("for slug in")));
    for (const job of targetJobs) expect(deployment).toContain(job);
    expect(workflow).toContain("--no-verify-jwt");
    expect(workflow).not.toContain("supabase functions deploy --all");
    expect(workflow).not.toContain("--prune");
  });

  it("requires explicit source parity, safe negative testing and a non-vulnerable rollback", () => {
    expect(playbook).toContain("deployed-vs-repository source diffs");
    expect(playbook).toContain("credential-free POST");
    expect(playbook).toContain("Do not");
    expect(playbook).toContain("reopens the vulnerability");
    expect(playbook).toContain("Keep #4255 open");
  });
});
