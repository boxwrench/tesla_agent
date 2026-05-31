#!/usr/bin/env bash
# scripts/serving/serve_vulkan.sh
# Start llama-server using the Vulkan (RADV) backend for Strix Halo gfx1151.
# Usage: bash scripts/serving/serve_vulkan.sh [extra_args]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source setup environment helper to load config.env
if [ -f "${ROOT_DIR}/scripts/setup/set_hsa_env.sh" ]; then
  source "${ROOT_DIR}/scripts/setup/set_hsa_env.sh"
else
  echo "Error: set_hsa_env.sh not found!" >&2
  exit 1
fi

# Configuration paths from config.env
GGUF_PATH="${TESLA_GGUF_PATH:-}"
PORT="${TESLA_PORT:-8095}"
CTX_SIZE="${TESLA_CTX_SIZE:-32768}"

# Vulkan specific configurations
VULKAN_SERVER="${TESLA_VULKAN_SERVER:-}"
VULKAN_LIB_PATH="${TESLA_VULKAN_LD_LIBRARY_PATH:-}"

if [ -z "${VULKAN_SERVER}" ]; then
  echo "Error: TESLA_VULKAN_SERVER path is empty in config.env." >&2
  echo "To use the Vulkan backend, build llama-server with Vulkan support and point to it." >&2
  exit 1
fi

if [ ! -f "${GGUF_PATH}" ]; then
  echo "Error: Model file not found at: ${GGUF_PATH}" >&2
  exit 1
fi

if [ ! -x "${VULKAN_SERVER}" ]; then
  echo "Error: Vulkan llama-server binary not found or not executable at: ${VULKAN_SERVER}" >&2
  exit 1
fi

# Configure Vulkan environment
# 1. Force Vulkan by hiding the ROCm device from HIP
export HIP_VISIBLE_DEVICES=-1

# 2. Set Vulkan ICD to RADV (Mesa Vulkan driver)
export AMD_VULKAN_ICD=RADV

# 3. Add custom Vulkan loader library paths if configured
if [ -n "${VULKAN_LIB_PATH}" ]; then
  export LD_LIBRARY_PATH="${VULKAN_LIB_PATH}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
fi

echo "======================================================================"
echo "Starting Vulkan llama-server..."
echo "  Model:       ${GGUF_PATH}"
echo "  Port:        ${PORT}"
echo "  Context:     ${CTX_SIZE}"
echo "  Server Bin:  ${VULKAN_SERVER}"
echo "  ICD:         ${AMD_VULKAN_ICD}"
echo "======================================================================"

# KV cache quantization — default q8_0 is the safe default for Qwen MoE and gpt-oss-120B.
# GEMMA 4 EXCEPTION: Do NOT use q8_0, q4_0, or turbo3 KV for Gemma 4 models.
# Gemma 4's global-attention layers tile at 512 tokens; Vulkan's WHT-rotated quantized KV kernels
# use power-of-2 block alignments (128/256), causing write-side memory corruption that
# produces immediate gibberish on Gemma 31B and 26B-A4B (reported: llama-cpp-turboquant
# issue #137). For Gemma 4, F16 KV is required; override via $@:
# add --cache-type-k f16 --cache-type-v f16 to the launch command.
exec "${VULKAN_SERVER}" \
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
