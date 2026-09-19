import { readFile } from "node:fs/promises";
import { renderGateway } from "./gateway.mjs";

const claimFile = process.argv[2] || process.env.TOTP_RENDER_CLAIM_FILE;
if (!claimFile) throw new Error("Claim file path is required.");
const claim = JSON.parse(await readFile(claimFile, "utf8"));
if (!claim?.job?.id) process.exit(0);
await renderGateway("heartbeat", {
  job_id: claim.job.id,
  progress_percent: Number(process.env.TOTP_RENDER_SETUP_PROGRESS || 1),
});
console.log(`Lease refreshed for ${claim.job.id}`);
