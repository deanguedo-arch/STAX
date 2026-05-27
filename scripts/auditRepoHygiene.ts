import { auditRepoHygiene, formatRepoHygieneAudit } from "../src/hardening/RepoHygieneAudit.js";

const result = auditRepoHygiene(process.cwd());
console.log(formatRepoHygieneAudit(result));

if (!result.valid) {
  process.exit(1);
}
