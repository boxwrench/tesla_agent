# Per-probe data-path override (sourced by scripts/run_probe.sh).
# pH-control points --data real at a carved 12h SWaT slice (AIT-202 + P-203,
# spanning the brief pH transient), not the full attack CSV — so the agent and
# the truth-builder see identical bytes.
REAL_PATH="/data/real_slices/ph_control_real_v1.parquet"
