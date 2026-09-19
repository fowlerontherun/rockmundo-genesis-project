import { appendFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderGateway } from "./gateway.mjs";

const claim = await renderGateway("claim");
const hasJob = Boolean(claim?.job?.id);
const claimFile = path.join(
  process.env.RUNNER_TEMP || tmpdir(),
  hasJob ? `totp-render-claim-${claim.job.id}.json` : "totp-render-claim-empty.json",
);
await writeFile(claimFile, JSON.stringify(claim), "utf8");

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `has_job=${hasJob ? "true" : "false"}\nclaim_file=${claimFile}\n`);
}
console.log(hasJob ? `Claimed TOTP render job ${claim.job.id}` : "No TOTP render job is waiting.");
