#!/usr/bin/env bash
# scripts/setup/set_hsa_env.sh
# Source this script to configure the required HSA and GPU environment variables.
# Usage: source scripts/setup/set_hsa_env.sh

# Resolve script directory to load config.env reliably
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="$(cd "${SCRIPT_DIR}/.." && pwd)/config.env"

if [ -f "${CONFIG_PATH}" ]; then
  echo "Loading configuration from ${CONFIG_PATH}..."
  # Source and export all configs
  set -a
  source "${CONFIG_PATH}"
  set +a
else
  echo "Warning: config.env not found at ${CONFIG_PATH}. Using default parameters."
  export HSA_OVERRIDE_GFX_VERSION=11.5.1
  export HSA_ENABLE_SDMA=0
  export GPU_MAX_HEAP_SIZE=100
  export GPU_MAX_ALLOC_PERCENT=100
  export GPU_SINGLE_ALLOC_PERCENT=100
  export GPU_FORCE_64BIT_PTR=1
  export HIP_VISIBLE_DEVICES=0
  export AMD_VULKAN_ICD=RADV
fi

echo "GPU Environment Configured:"
echo "  HSA_OVERRIDE_GFX_VERSION = ${HSA_OVERRIDE_GFX_VERSION}"
echo "  HSA_ENABLE_SDMA          = ${HSA_ENABLE_SDMA}"
echo "  HIP_VISIBLE_DEVICES      = ${HIP_VISIBLE_DEVICES}"
echo "  AMD_VULKAN_ICD           = ${AMD_VULKAN_ICD}"
