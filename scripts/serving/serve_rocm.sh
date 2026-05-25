#!/usr/bin/env bash
# scripts/serving/serve_rocm.sh
# Start llama-server using the ROCm backend for Strix Halo gfx1151.
# Usage: bash scripts/serving/serve_rocm.sh [extra_args]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source setup environment helper to load config.env and default HSA variables
if [ -f "${ROOT_DIR}/scripts/setup/set_hsa_env.sh" ]; then
  source "${ROOT_DIR}/scripts/setup/set_hsa_env.sh"
else
  echo "Error: set_hsa_env.sh not found!" >&2
  exit 1
fi

# Configuration paths from config.env
GGUF_PATH="${TESLA_GGUF_PATH:-}"
LLAMA_SERVER="${TESLA_LLAMA_SERVER:-}"
PORT="${TESLA_PORT:-8095}"
CTX_SIZE="${TESLA_CTX_SIZE:-32768}"

# ROCm-specific library paths
LLAMA_ROOT="$(dirname "${LLAMA_SERVER}")"
THEROCK_LIB="${HOME}/.cache/lemonade/bin/therock/gfx1151-7.13.0/lib"

if [ ! -f "${GGUF_PATH}" ]; then
  echo "Error: Model file not found at: ${GGUF_PATH}" >&2
  echo "Please check the TESLA_GGUF_PATH parameter in your config.env file." >&2
  exit 1
fi

if [ ! -x "${LLAMA_SERVER}" ]; then
  echo "Error: Llama server binary not found or not executable at: ${LLAMA_SERVER}" >&2
  echo "Please check the TESLA_LLAMA_SERVER parameter in your config.env file." >&2
  exit 1
fi

# Ensure library paths are set for ROCm runtime loader
export LD_LIBRARY_PATH="${LLAMA_ROOT}:${THEROCK_LIB}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"

echo "======================================================================"
echo "Starting ROCm llama-server..."
echo "  Model:       ${GGUF_PATH}"
echo "  Port:        ${PORT}"
echo "  Context:     ${CTX_SIZE}"
echo "  Server Bin:  ${LLAMA_SERVER}"
echo "======================================================================"

# Run server with recommended parameters for MoE tool-calling stability
exec "${LLAMA_SERVER}" \
  --host 127.0.0.1 \
  --port "${PORT}" \
  --model "${GGUF_PATH}" \
  --ctx-size "${CTX_SIZE}" \
  --gpu-layers all \
  --no-mmap \
  --flash-attn on \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --batch-size 2048 \
  --ubatch-size 2048 \
  --parallel 1 \
  --no-webui \
  "$@"
