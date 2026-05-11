#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEMO_DIR="${STAX_FAKE_COMPLETE_DEMO_DIR:-${TMPDIR:-/tmp}/stax-fake-complete-demo}"

if [[ -z "${DEMO_DIR}" || "${DEMO_DIR}" == "/" || "${DEMO_DIR}" == "${HOME}" ]]; then
  echo "Refusing unsafe demo directory: ${DEMO_DIR}" >&2
  exit 1
fi

STAX_CMD=(npm --prefix "${ROOT_DIR}" run --silent stax --)

current_ack() {
  node -e "const fs=require('node:fs'); const raw=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(raw.requiredAcknowledgement);" "${DEMO_DIR}/.stax/turn-contract.json"
}

write_codex_report() {
  local acknowledgement="$1"
  local command_summary="$2"
  cat > "${DEMO_DIR}/.stax/codex-report.md" <<REPORT
STAX acknowledgement: ${acknowledgement}
Objective: Fix the passing-score threshold bug.
Files changed: src/score.js.
Tests added: test/score.test.js already covered the 60-point boundary.
Commands run: npm test.
Command output summary with exit codes: ${command_summary}
What is verified: The score threshold now treats 60 as passing.
What is weak/provisional: None claimed beyond collected evidence.
What is unverified: Nothing else claimed.
Risks: Fake-complete reporting if command evidence is missing.
One next action: Run STAX gate.
REPORT
}

echo "[demo] Rebuilding ${DEMO_DIR}"
rm -rf "${DEMO_DIR}"
mkdir -p "${DEMO_DIR}/src" "${DEMO_DIR}/test"

cat > "${DEMO_DIR}/package.json" <<'JSON'
{
  "name": "stax-fake-complete-demo",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node test/score.test.js"
  }
}
JSON

cat > "${DEMO_DIR}/src/score.js" <<'JS'
export function isPassingScore(score) {
  return score > 60;
}
JS

cat > "${DEMO_DIR}/test/score.test.js" <<'JS'
import assert from "node:assert/strict";
import { isPassingScore } from "../src/score.js";

assert.equal(isPassingScore(60), true);
console.log("Tests passed");
JS

git -C "${DEMO_DIR}" init -q
git -C "${DEMO_DIR}" config user.email "stax-demo@example.invalid"
git -C "${DEMO_DIR}" config user.name "STAX Demo"
git -C "${DEMO_DIR}" add package.json src test
git -C "${DEMO_DIR}" commit -q -m "Seed fake-complete demo"

echo "[demo] Attaching STAX sidecar"
"${STAX_CMD[@]}" attach --repo "${DEMO_DIR}" >/dev/null
node -e "const fs=require('node:fs'); const path=process.argv[1]; const config=JSON.parse(fs.readFileSync(path, 'utf8')); config.runtimeFreshnessMode='manual'; fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');" "${DEMO_DIR}/.stax/config.json"
printf "Fix the passing-score threshold bug and prove it with npm test.\n" > "${DEMO_DIR}/.stax/task.md"

cat > "${DEMO_DIR}/src/score.js" <<'JS'
export function isPassingScore(score) {
  return score >= 60;
}
JS

write_codex_report "$(current_ack)" "AI report says tests passed, but no STAX command evidence has been collected."

echo
echo "[demo] First gate: confident report, no command evidence"
set +e
FIRST_GATE_OUTPUT="$("${STAX_CMD[@]}" gate --repo "${DEMO_DIR}" 2>&1)"
FIRST_GATE_CODE=$?
set -e
printf "%s\n" "${FIRST_GATE_OUTPUT}" | sed -n '1,80p'
echo "[demo] first gate exit code: ${FIRST_GATE_CODE}"

if [[ "${FIRST_GATE_CODE}" -ne 1 ]] || ! grep -q "Status: Reject" <<<"${FIRST_GATE_OUTPUT}"; then
  echo "[demo] expected first gate to reject missing command evidence" >&2
  exit 1
fi

echo
echo "[demo] Collecting real command evidence"
"${STAX_CMD[@]}" collect --repo "${DEMO_DIR}" -- npm test >/dev/null

write_codex_report "$(current_ack)" "STAX collected npm test with exit code 0 in ${DEMO_DIR}."

echo
echo "[demo] Second gate: report updated with collected evidence"
set +e
FINAL_GATE_OUTPUT="$("${STAX_CMD[@]}" gate --repo "${DEMO_DIR}" 2>&1)"
FINAL_GATE_CODE=$?
set -e
printf "%s\n" "${FINAL_GATE_OUTPUT}" | sed -n '1,100p'
echo "[demo] final gate exit code: ${FINAL_GATE_CODE}"

if [[ "${FINAL_GATE_CODE}" -ne 0 ]] || ! grep -q "Status: Accept" <<<"${FINAL_GATE_OUTPUT}"; then
  echo "[demo] expected final gate to accept after command evidence" >&2
  exit 1
fi

echo
echo "[demo] Files to inspect:"
echo "  ${DEMO_DIR}/.stax/status.md"
echo "  ${DEMO_DIR}/.stax/next-codex-prompt.md"
