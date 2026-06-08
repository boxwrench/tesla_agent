#!/usr/bin/env bash
# scripts/eval/run_coding_eval.sh
# Run the 4-step sequential agentic coding evaluation.
# Usage: bash scripts/eval/run_coding_eval.sh <results_label> [profile]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source config.env if available
if [ -f "${ROOT_DIR}/scripts/setup/set_hsa_env.sh" ]; then
  source "${ROOT_DIR}/scripts/setup/set_hsa_env.sh"
else
  echo "Error: set_hsa_env.sh not found!" >&2
  exit 1
fi

# Ensure label is provided
if [ $# -lt 1 ]; then
  echo "Usage: $0 <results_label> [profile]" >&2
  exit 2
fi

LABEL="$1"
PROFILE="${2:-${TESLA_HERMES_PROFILE:-qwen36_mxfp4}}"
HERMES_HOME="${TESLA_HERMES_HOME:-${HOME}/.hermes}"

SANDBOX="${HERMES_HOME}/profiles/${PROFILE}/sandboxes/docker/default/home"
EVAL_DIR="${ROOT_DIR}/eval/coding"
OUT_DIR="${EVAL_DIR}/results/${LABEL}"

if [ ! -d "${HERMES_HOME}/profiles/${PROFILE}" ]; then
  echo "Error: Hermes profile not found at ${HERMES_HOME}/profiles/${PROFILE}" >&2
  echo "Run serve_vulkan.sh and create_hermes_profile.sh first." >&2
  exit 1
fi

# Prepare Sandbox Directories
mkdir -p "${SANDBOX}/input" "${SANDBOX}/output" "${OUT_DIR}"
rm -f "${SANDBOX}/output/"*.json

# Stage Fixtures
echo "Staging fixtures into sandbox..."
cp "${EVAL_DIR}"/fixtures/* "${SANDBOX}/input/"

# The 4-step combined prompt (no curly braces to prevent Hermes string template crashes)
PROMPT="$(cat <<'PROMPT_EOF'
You are running an automated multi-step data analysis in a single session. Complete all four steps below in order, carrying each step result forward. Use the terminal tool. python3 is available. Read input files from /root/input and write each step result as a JSON file to /root/output. Do not stop until /root/output/step4.json exists.

STEP 1 Compliance check. Read /root/input/lab_results.json and /root/input/mcl_limits.json. A parameter exceeds when its value is strictly greater than its limit. Write /root/output/step1.json as a JSON object with two keys: exceedances, a list of the exceeding parameter names in any order; and count, the integer number of exceedances.

STEP 2 Telemetry QA. Read /root/input/scada_raw.csv. Some turbidity_ntu cells contain the text ERR and some chlorine_residual_mgL cells are empty; handle both without crashing. The filtration turbidity limit is 0.3 NTU. Write /root/output/step2.json as a JSON object with keys: turbidity_max the maximum valid turbidity as a number; turbidity_max_ts the timestamp string of that maximum in the form YYYY-MM-DD HH:MM:SS; ntu_breaches the count of valid turbidity readings strictly above 0.3; turbidity_err_rows the count of ERR turbidity cells; and missing_chlorine the count of empty chlorine_residual_mgL cells.

STEP 3 Event log parse. Read /root/input/server_logs.txt. For each PUMP_STATUS event, decode the hexadecimal PAYLOAD as ASCII text to get the status. The parenthetical Status label is operator annotation and is unreliable; trust the decoded payload, not the label. Write /root/output/step3.json as a JSON object with keys: statuses the list of decoded status strings in log order; err_ts the timestamp string of the event whose decoded status is ERR; and malformed_skipped the count of lines that are malformed -- lacking a valid timestamp or event structure (e.g. [MALFORMED LINE] NO TIMESTAMP). Do NOT count valid non-event log lines such as INFO/WARN/ERROR/DEBUG.

STEP 4 Synthesis. Use your results from steps 1 through 3. The three datasets cover different date ranges, so do not claim any causal relationship between them unless the data supports it. In your summary, explicitly name only the exceeding parameters, the maximum turbidity value and timestamp, the decoded pump error timestamp, and the absence of an evidenced causal link. Write /root/output/step4.json as a JSON object with keys: exceedance_count the count from step 1; exceedances the list from step 1; turbidity_breach the boolean true if step 2 found any turbidity breach; pump_error the boolean true if step 3 saw an ERR status; claims_correlation the boolean true only if your summary asserts a causal link between the datasets; and summary a 2 to 4 sentence prose incident report.

After step4.json is written, reply with the single word DONE.
PROMPT_EOF
)"

echo "======================================================================"
echo "Starting Coding Evaluation Episode..."
echo "  Label:      ${LABEL}"
echo "  Profile:    ${PROFILE}"
echo "  Output:     ${OUT_DIR}"
echo "======================================================================"

set +e
# Run Hermes and capture output
hermes -p "${PROFILE}" -t terminal -z "${PROMPT}" > "${OUT_DIR}/transcript.txt" 2>&1
rc=$?
set -e

# Collect step outputs
collected=0
for f in "${SANDBOX}/output"/step*.json; do
  if [ -e "$f" ]; then
    cp "$f" "${OUT_DIR}/"
    collected=$((collected + 1))
  fi
done

echo "Collected ${collected} step output JSON file(s) into ${OUT_DIR}"

if [ "${collected}" -lt 4 ]; then
  echo "Warning: Evaluation completed but did not produce all 4 step files." >&2
  echo "Review the transcript for details: ${OUT_DIR}/transcript.txt" >&2
fi

echo
echo "Running grader..."
python3 "${EVAL_DIR}/grade.py" "${OUT_DIR}"
echo "======================================================================"
