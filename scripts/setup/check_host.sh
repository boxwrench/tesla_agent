#!/usr/bin/env bash
# scripts/setup/check_host.sh
# Diagnostic script to verify host environment parity for Strix Halo gfx1151 local LLM serving.
# Usage: bash scripts/setup/check_host.sh [--verbose]

set -u

VERBOSE=false
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    -h|--help)
      echo "Usage: bash $0 [--verbose]"
      exit 0
      ;;
  esac
done

N_PASS=0
N_FAIL=0
N_WARN=0

# Resolve script directory to load config.env if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="$(cd "${SCRIPT_DIR}/.." && pwd)/config.env"

if [ -f "${CONFIG_PATH}" ]; then
  source "${CONFIG_PATH}"
fi

# Print report row
report() {
  local status="$1"
  local check_name="$2"
  local detail="$3"
  
  case "${status}" in
    PASS) N_PASS=$((N_PASS + 1)); echo -e "[\e[32mPASS\e[0m] ${check_name}: ${detail}" ;;
    FAIL) N_FAIL=$((N_FAIL + 1)); echo -e "[\e[31mFAIL\e[0m] ${check_name}: ${detail}" ;;
    WARN) N_WARN=$((N_WARN + 1)); echo -e "[\e[33mWARN\e[0m] ${check_name}: ${detail}" ;;
  esac
}

echo "======================================================================"
echo "Checking Strix Halo (gfx1151) Host Compatibility..."
echo "======================================================================"

# 1. Kernel Options Configuration Check
CONF_FILE="/etc/modprobe.d/amdgpu_llm_optimized.conf"
if [ -r "${CONF_FILE}" ]; then
  if grep -q "gttsize=" "${CONF_FILE}"; then
    gtt_val=$(grep -oE "gttsize=[0-9]+" "${CONF_FILE}" | head -n1)
    report PASS "Kernel Config (gttsize)" "Found ${gtt_val} in ${CONF_FILE}"
  else
    report FAIL "Kernel Config (gttsize)" "gttsize not set in ${CONF_FILE}"
  fi
  
  if grep -q "pages_limit=" "${CONF_FILE}"; then
    pl_val=$(grep -oE "pages_limit=[0-9]+" "${CONF_FILE}" | head -n1)
    report PASS "Kernel Config (pages_limit)" "Found ${pl_val} in ${CONF_FILE}"
  else
    report FAIL "Kernel Config (pages_limit)" "pages_limit not set in ${CONF_FILE}"
  fi
  
  if grep -q "no_system_mem_limit=1" "${CONF_FILE}"; then
    report PASS "Kernel Config (no_system_mem_limit)" "no_system_mem_limit=1 enabled in ${CONF_FILE}"
  else
    report FAIL "Kernel Config (no_system_mem_limit)" "no_system_mem_limit=1 is missing in ${CONF_FILE} (layers may spill)"
  fi
else
  report FAIL "Kernel Config" "Configuration file ${CONF_FILE} is missing or not readable. Run apply_gtt.sh first."
fi

# 2. Live Kernel Parameter Check
SYSFS_NSML="/sys/module/amdgpu/parameters/no_system_mem_limit"
if [ -r "${SYSFS_NSML}" ]; then
  val=$(cat "${SYSFS_NSML}")
  if [ "${val}" = "1" ] || [ "${val}" = "Y" ]; then
    report PASS "Active Kernel Parameter" "no_system_mem_limit is enabled (${val})"
  else
    report FAIL "Active Kernel Parameter" "no_system_mem_limit is disabled (${val}). Reboot required."
  fi
else
  # Fallback to dmesg
  if command -v dmesg >/dev/null 2>&1; then
    dmesg_check=$(dmesg 2>/dev/null | grep -i no_system_mem_limit | head -n1 || true)
    if [ -n "${dmesg_check}" ]; then
      report WARN "Active Kernel Parameter" "sysfs path unavailable; dmesg reports: ${dmesg_check}"
    else
      report WARN "Active Kernel Parameter" "Cannot verify no_system_mem_limit (sysfs missing, dmesg restricted)"
    fi
  else
    report WARN "Active Kernel Parameter" "Cannot verify no_system_mem_limit (sysfs missing)"
  fi
fi

# 3. GPU Visibility & ROCm Check
if command -v rocminfo >/dev/null 2>&1; then
  gpu_arch=$(rocminfo 2>/dev/null | grep -E 'Marketing|gfx1151' || true)
  if echo "${gpu_arch}" | grep -q 'gfx1151'; then
    marketing_name=$(echo "${gpu_arch}" | grep -i 'Marketing Name' | grep -iv 'Ryzen' | head -n1 | sed -E 's/.*Name:[[:space:]]*//' || true)
    report PASS "ROCm GPU Architecture" "gfx1151 visible to ROCm (${marketing_name:-Radeon APU})"
  else
    report FAIL "ROCm GPU Architecture" "rocminfo is available but gfx1151 is not listed as active."
  fi
else
  report WARN "ROCm Driver Check" "rocminfo command not found. ROCm driver may not be installed or in PATH."
fi

# 4. Environment Variables Check
HSA_VARS=(
  HSA_OVERRIDE_GFX_VERSION
  HSA_ENABLE_SDMA
  GPU_MAX_HEAP_SIZE
  GPU_MAX_ALLOC_PERCENT
  GPU_SINGLE_ALLOC_PERCENT
  GPU_FORCE_64BIT_PTR
)

missing_vars=0
for var in "${HSA_VARS[@]}"; do
  if [ -n "${!var:-}" ]; then
    if $VERBOSE; then
      echo "  - ${var} = ${!var}"
    fi
  else
    missing_vars=$((missing_vars + 1))
  fi
done

if [ ${missing_vars} -eq 0 ]; then
  report PASS "HSA Environment Variables" "All ${#HSA_VARS[@]} required HSA environment variables are active."
else
  report WARN "HSA Environment Variables" "${missing_vars}/${#HSA_VARS[@]} variables are missing. Sourcing set_hsa_env.sh recommended."
fi

# 5. Model Paths and Binary Prereqs
if [ -n "${TESLA_LLAMA_SERVER:-}" ]; then
  if [ -x "${TESLA_LLAMA_SERVER}" ]; then
    report PASS "Llama Server Binary" "Found llama-server at ${TESLA_LLAMA_SERVER}"
  else
    report WARN "Llama Server Binary" "llama-server at ${TESLA_LLAMA_SERVER} is not executable or does not exist."
  fi
else
  report WARN "Llama Server Binary" "TESLA_LLAMA_SERVER path not configured in config.env"
fi

if [ -n "${TESLA_GGUF_PATH:-}" ]; then
  if [ -f "${TESLA_GGUF_PATH}" ]; then
    report PASS "Model GGUF File" "Found model file at ${TESLA_GGUF_PATH}"
  else
    report WARN "Model GGUF File" "Model file not found at ${TESLA_GGUF_PATH}"
  fi
else
  report WARN "Model GGUF File" "TESLA_GGUF_PATH not configured in config.env"
fi

echo "======================================================================"
echo -e "Check complete: \e[32m${N_PASS} passing\e[0m, \e[31m${N_FAIL} failing\e[0m, \e[33m${N_WARN} warnings\e[0m."
echo "======================================================================"

if [ ${N_FAIL} -eq 0 ]; then
  echo "Host configuration is ready for local LLM serving."
  exit 0
else
  echo "Warning: Fix failing checks before attempting to serve models."
  exit 1
fi
