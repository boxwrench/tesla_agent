#!/usr/bin/env bash
# scripts/serving/create_hermes_profile.sh
# Generate a self-contained Hermes agent profile configured to point to our local llama-server.
# Usage: bash scripts/serving/create_hermes_profile.sh

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

# Load variables with defaults
PORT="${TESLA_PORT:-8095}"
PROFILE_NAME="${TESLA_HERMES_PROFILE:-qwen36_mxfp4}"
HERMES_HOME="${TESLA_HERMES_HOME:-${HOME}/.hermes}"
MODEL_FILE="$(basename "${TESLA_GGUF_PATH}")"

TARGET_PROFILE="${HERMES_HOME}/profiles/${PROFILE_NAME}"
LAUNCHER_DIR="${HOME}/.local/bin"
LAUNCHER_PATH="${LAUNCHER_DIR}/${PROFILE_NAME}"

echo "======================================================================"
echo "Creating Hermes Agent Profile..."
echo "  Profile Name:   ${PROFILE_NAME}"
echo "  Target Path:    ${TARGET_PROFILE}"
echo "  Model Endpoint: http://127.0.0.1:${PORT}/v1"
echo "  Model Default:  ${MODEL_FILE}"
echo "======================================================================"

mkdir -p "${TARGET_PROFILE}"

# Write config.yaml
cat << EOF > "${TARGET_PROFILE}/config.yaml"
# Hermes Profile Configuration for ${PROFILE_NAME}
model:
  default: ${MODEL_FILE}
  provider: custom
  base_url: http://127.0.0.1:${PORT}/v1
  api_mode: chat_completions
  max_tokens: 8192
  # Must not exceed the server's --ctx-size (TESLA_CTX_SIZE in config.env).
  context_length: ${TESLA_CTX_SIZE:-32768}
providers: {}
# No cloud fallback: this stack is 100% local by design. Keeping these empty
# guarantees the agent never routes utility data to an external API.
fallback_providers: []
fallback_model: {}
toolsets:
- hermes-cli
agent:
  max_turns: 90
  gateway_timeout: 1800
  restart_drain_timeout: 180
  api_max_retries: 3
  tool_use_enforcement: auto
  gateway_timeout_warning: 900
  clarify_timeout: 600
  gateway_notify_interval: 180
  verbose: false
terminal:
  backend: docker
  modal_mode: auto
  cwd: .
  timeout: 180
  docker_image: nikolaik/python-nodejs:python3.11-nodejs20
  container_cpu: 16.0
  container_memory: 120000
  container_disk: 1800000
  container_persistent: true
  persistent_shell: true
  lifetime_seconds: 300
checkpoints:
  enabled: false
file_read_max_chars: 100000
tool_output:
  max_bytes: 50000
  max_lines: 2000
  max_line_length: 2000
compression:
  enabled: true
  threshold: 0.5
  target_ratio: 0.2
  protect_last_n: 20
  protect_first_n: 3
display:
  compact: false
  resume_display: full
  show_reasoning: false
  streaming: true
  inline_diffs: true
  file_mutation_verifier: true
  tool_progress: all
privacy:
  redact_pii: false
memory:
  memory_enabled: true
  user_profile_enabled: true
code_execution:
  mode: project
  timeout: 300
  max_tool_calls: 50
logging:
  level: INFO
EOF

# Write convenient launcher script
mkdir -p "${LAUNCHER_DIR}"
cat << EOF > "${LAUNCHER_PATH}"
#!/usr/bin/env bash
# Launcher for Hermes agent profile: ${PROFILE_NAME}
exec hermes -p ${PROFILE_NAME} "\$@"
EOF

chmod +x "${LAUNCHER_PATH}"

echo "Hermes profile config created: ${TARGET_PROFILE}/config.yaml"
echo "Launcher created:             ${LAUNCHER_PATH}"
echo "To run the agent, use:"
echo "  ${PROFILE_NAME} -t \"your task description\""
echo "======================================================================"
