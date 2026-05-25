#!/usr/bin/env bash
# scripts/eval/nonce_gate.sh
# Reusable nonce-gate script to verify autonomous tool-call discipline on Strix Halo.
#
# Each run must satisfy ALL THREE criteria:
#   1. Structured tool-call marker (verified by scanning the Hermes session JSON).
#   2. The response body echoes the exact randomly-generated nonce value.
#   3. The response body contains NO fenced bash/shell code blocks.
#
# Exit status: 0 if all runs pass, 1 otherwise.

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

# Configuration Defaults (overridable by environment or config.env)
PROFILE="${TESLA_HERMES_PROFILE:-qwen36_mxfp4}"
HERMES_HOME="${TESLA_HERMES_HOME:-${HOME}/.hermes}"
LOG_FILE="/tmp/qwen36-agent-llamacpp-server.log"
RUNS=3
VERBOSE=0

# Determine Docker sandbox bind path
# In Hermes' default Docker backend, the host path:
#   ~/.hermes/profiles/<profile>/sandboxes/docker/default/home/
# maps to the container's:
#   /root/
# inside the Docker sandbox.
NONCE_FILENAME="hermes_tool_nonce.txt"
CONTAINER_NONCE_PATH="/root/${NONCE_FILENAME}"
HOST_SEED_PATH="${HERMES_HOME}/profiles/${PROFILE}/sandboxes/docker/default/home/${NONCE_FILENAME}"

usage() {
  cat <<EOF
Usage: scripts/eval/nonce_gate.sh [options]

Options:
  --profile=NAME      Hermes profile name (default: ${PROFILE})
  --runs=N            Number of independent runs (default: ${RUNS})
  --verbose           Print full response body per run
  --nonce-file=PATH   Path seen by the model inside sandbox (default: ${CONTAINER_NONCE_PATH})
  --seed-file=PATH    Host seed path where the file is actually written (default: ${HOST_SEED_PATH})
  -h, --help          Show this help and exit
EOF
}

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile=*)     PROFILE="${1#*=}"; shift ;;
    --profile)       PROFILE="$2"; shift 2 ;;
    --runs=*)        RUNS="${1#*=}"; shift ;;
    --runs)          RUNS="$2"; shift 2 ;;
    --verbose)       VERBOSE=1; shift ;;
    --nonce-file=*)  CONTAINER_NONCE_PATH="${1#*=}"; shift ;;
    --nonce-file)    CONTAINER_NONCE_PATH="$2"; shift 2 ;;
    --seed-file=*)   HOST_SEED_PATH="${1#*=}"; shift ;;
    --seed-file)     HOST_SEED_PATH="$2"; shift 2 ;;
    -h|--help)       usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

SESSION_DIR="${HERMES_HOME}/profiles/${PROFILE}/sessions"
PROMPT="Read ${CONTAINER_NONCE_PATH} using the terminal tool and tell me the exact value. Do not print bash commands."

# Scoring Helpers
new_hermes_sessions_since() {
  local marker="$1"
  if [[ -d "${SESSION_DIR}" ]]; then
    find "${SESSION_DIR}" -maxdepth 1 -type f -name 'session_*.json' \
      -newer "${marker}" -print0 2>/dev/null \
      | xargs -0r cat 2>/dev/null || true
  fi
}

has_structured_tool_call() {
  local session_text="$1"
  local body="$2"
  if grep -Fq '"finish_reason": "tool_calls"' <<<"${session_text}" \
     && grep -Fq '"tool_calls": [' <<<"${session_text}"; then
    return 0
  fi
  # Fallback: check raw body for API response format
  if grep -Eq '"finish_reason"[[:space:]]*:[[:space:]]*"tool_calls"' <<<"${body}" \
     && grep -Eq '"tool_calls"[[:space:]]*:' <<<"${body}"; then
    return 0
  fi
  return 1
}

has_fenced_shell() {
  local body="$1"
  if grep -Eq '```[[:space:]]*(bash|sh|shell|zsh|console)\b' <<<"${body}"; then
    return 0
  fi
  # Bare fence containing shell command
  if grep -Fq '```' <<<"${body}" \
     && grep -Eq '(^|[[:space:]])(cat|less|head|tail|read)[[:space:]]' <<<"${body}"; then
    return 0
  fi
  return 1
}

echo "======================================================================"
echo "Starting Nonce Gate Verification..."
echo "  Profile:    ${PROFILE}"
echo "  Runs:       ${RUNS}"
echo "  Seed file:  ${HOST_SEED_PATH}"
echo "  Inside VM:  ${CONTAINER_NONCE_PATH}"
echo "======================================================================"

passes=0

for ((run = 1; run <= RUNS; run++)); do
  # Generate unique random token
  NONCE="$(date +%s)-${RANDOM}-${RANDOM}"
  
  # Seed the nonce file
  mkdir -p "$(dirname "${HOST_SEED_PATH}")"
  echo "${NONCE}" > "${HOST_SEED_PATH}"
  
  marker_file="$(mktemp)"
  touch "${marker_file}"
  
  echo
  echo "--- Run ${run}/${RUNS} (nonce: ${NONCE}) ---"
  
  set +e
  # Execute Hermes using the profile launcher
  body=$(hermes -p "${PROFILE}" -t terminal -z "${PROMPT}" 2>&1)
  rc=$?
  set -e
  
  session_text=$(new_hermes_sessions_since "${marker_file}")
  rm -f "${marker_file}"
  
  # Check criteria
  c1_ok=0
  if has_structured_tool_call "${session_text}" "${body}"; then
    c1_ok=1
  fi
  
  c2_ok=0
  if grep -Fq "${NONCE}" <<<"${body}"; then
    c2_ok=1
  fi
  
  c3_ok=0
  if ! has_fenced_shell "${body}"; then
    c3_ok=1
  fi
  
  if [ "${VERBOSE}" -eq 1 ]; then
    echo "--- Agent Response ---"
    printf '%s\n' "${body}"
    echo "----------------------"
  fi
  
  echo "  [$( [ $c1_ok -eq 1 ] && echo "PASS" || echo "FAIL" )] Structured tool call marker"
  echo "  [$( [ $c2_ok -eq 1 ] && echo "PASS" || echo "FAIL" )] Nonce echoed in response"
  echo "  [$( [ $c3_ok -eq 1 ] && echo "PASS" || echo "FAIL" )] No markdown shell block"
  
  if [ $c1_ok -eq 1 ] && [ $c2_ok -eq 1 ] && [ $c3_ok -eq 1 ]; then
    echo "  => Run ${run}: PASS"
    passes=$((passes + 1))
  else
    reasons=()
    [ "${rc}" -ne 0 ] && reasons+=("Hermes command exited with ${rc}")
    [ $c1_ok -eq 0 ] && reasons+=("No tool call detected in session logs")
    [ $c2_ok -eq 0 ] && reasons+=("Nonce not found in response (tool failed or returned wrong data)")
    [ $c3_ok -eq 0 ] && reasons+=("Fenced code blocks found (printed code rather than running it)")
    echo "  => Run ${run}: FAIL — $(IFS='; '; echo "${reasons[*]}")"
  fi
  
  # Clean up seed file
  rm -f "${HOST_SEED_PATH}"
done

echo
echo "======================================================================"
echo "Nonce Gate Verification Results: ${passes}/${RUNS} Passed"
echo "======================================================================"

if [ "${passes}" -eq "${RUNS}" ]; then
  exit 0
else
  exit 1
fi
