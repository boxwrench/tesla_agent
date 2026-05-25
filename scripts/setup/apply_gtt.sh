#!/usr/bin/env bash
# scripts/setup/apply_gtt.sh
# Configure host GTT and TTM settings to reserve unified RAM for the APU GPU.
# Must run as root.
# Usage: sudo bash scripts/setup/apply_gtt.sh [size_in_gb]

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run as root. Try:"
  echo "  sudo bash $0"
  exit 1
fi

# Detect system RAM
total_mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
total_mem_gb=$(( total_mem_kb / 1024 / 1024 ))

# Set target GTT size
if [ $# -ge 1 ]; then
  target_gb="$1"
  echo "Using user-specified GTT size: ${target_gb} GB"
else
  # Default to ~75% of total RAM
  target_gb=$(( total_mem_gb * 75 / 100 ))
  echo "Detected ${total_mem_gb} GB total RAM. Defaulting GTT allocation to 75% (${target_gb} GB)"
fi

if [ "${target_gb}" -le 4 ]; then
  echo "Error: Target GTT size of ${target_gb} GB is too small. Must be > 4 GB."
  exit 1
fi

if [ "${target_gb}" -ge "${total_mem_gb}" ]; then
  echo "Error: GTT size cannot equal or exceed total system RAM (${total_mem_gb} GB)."
  exit 1
fi

# Calculate parameters
# gttsize in MB
gttsize_mb=$(( target_gb * 1024 ))
# pages_limit = GTT size / 4KB page size
pages_limit=$(( target_gb * 1024 * 1024 * 1024 / 4096 ))
# page_pool_size = half of pages_limit
page_pool_size=$(( pages_limit / 2 ))

CONF_FILE="/etc/modprobe.d/amdgpu_llm_optimized.conf"
BACKUP_FILE="${CONF_FILE}.bak.$(date +%Y%m%d)"

echo "Calculated parameters for ${target_gb} GB GTT size:"
echo "  gttsize          = ${gttsize_mb} MB"
echo "  pages_limit      = ${pages_limit} pages"
echo "  page_pool_size   = ${page_pool_size} pages"
echo

if [ -f "${CONF_FILE}" ]; then
  echo "Backing up existing configuration to ${BACKUP_FILE}"
  cp "${CONF_FILE}" "${BACKUP_FILE}"
fi

echo "Writing configuration to ${CONF_FILE}..."
cat << EOF > "${CONF_FILE}"
# amdgpu memory settings optimized for local LLM inference
options amdgpu gttsize=${gttsize_mb} no_system_mem_limit=1
options ttm pages_limit=${pages_limit} page_pool_size=${page_pool_size}
EOF

echo "File content of ${CONF_FILE}:"
cat "${CONF_FILE}"
echo

# Determine initramfs tool
if command -v update-initramfs >/dev/null 2>&1; then
  echo "Rebuilding initramfs using update-initramfs..."
  update-initramfs -u
elif command -v dracut >/dev/null 2>&1; then
  echo "Rebuilding initramfs using dracut..."
  dracut --force
elif command -v mkinitcpio >/dev/null 2>&1; then
  echo "Rebuilding initramfs using mkinitcpio..."
  mkinitcpio -P
else
  echo "Warning: No standard initramfs tool found (update-initramfs, dracut, mkinitcpio)."
  echo "Please rebuild your initramfs manually for the kernel options to take effect."
fi

echo
echo "======================================================================"
echo "GTT Configuration applied successfully."
echo "A reboot is REQUIRED to apply the changes."
echo "======================================================================"
echo "After rebooting, run the check_host.sh script to verify:"
echo "  bash scripts/setup/check_host.sh"
echo "======================================================================"
