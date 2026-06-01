# Per-probe data-path override, sourced by run_probe.sh.
# Sets STUB_PATH / REAL_PATH (in-sandbox paths under /data) for this probe.
#
# stub: default convention (/data/stubs/membrane_fouling_v1.parquet) is correct,
#       so STUB_PATH is left as-is.
# real: a pre-sliced canonical window (DPIT-301/FIT-301, 2015-12-29 00:00-06:00),
#       NOT the full 128 MB SWaT CSV — so the agent and truth.real.json see the
#       identical slice. The slice is gitignored; regenerate with:
#         ~/.venvs/vllm-rocm/bin/python scripts/make_real_slice.py \
#           --data data/raw/SWaT_Dataset_Attack_v0.csv --tags DPIT-301 FIT-301 \
#           --start 2015-12-29T00:00:00 --end 2015-12-29T06:00:00 \
#           --out data/real_slices/membrane_real_v1.parquet
#       Grade real-data runs against truth.real.json (this window has no fouling).
REAL_PATH="/data/real_slices/membrane_real_v1.parquet"
