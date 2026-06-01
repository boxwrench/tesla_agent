#!/usr/bin/env python3
"""Carve a small, canonical real-data slice out of a full mirrored dataset.

Parallel to synth_stub.py, but for *real* plant data: it loads the full
(gitignored) source CSV through the project's normalizer (`load_tags`), keeps
only the named tags and a time window, and writes a compact parquet that both
the agent (via run_probe.sh `--data real`) and `build_truth.py` consume — so
the agent and the ground truth see the byte-identical slice.

The output lives under data/real_slices/ (gitignored, like data/raw/) — real
data stays out of git per the dataset citation agreement. The slice is
reproducible from this script + the source mirror; only truth.real.json (plain
numbers) is committed.

Use the venv interpreter (system python lacks pandas):
  ~/.venvs/vllm-rocm/bin/python scripts/make_real_slice.py \
    --data data/raw/SWaT_Dataset_Attack_v0.csv --tags DPIT-301 FIT-301 \
    --start 2015-12-29T00:00:00 --end 2015-12-29T06:00:00 \
    --out data/real_slices/membrane_real_v1.parquet
"""
from __future__ import annotations

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "probes", "pump-cycling")))

from load import load_tags  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True, help="full source dataset (CSV)")
    p.add_argument("--tags", nargs="+", required=True, help="canonical tags to keep")
    p.add_argument("--start", help="ISO timestamp lower bound (inclusive)")
    p.add_argument("--end", help="ISO timestamp upper bound (inclusive)")
    p.add_argument("--out", required=True, help="output parquet path")
    args = p.parse_args()

    df = load_tags(args.data, args.tags)
    if args.start:
        df = df[df["Timestamp"] >= args.start]
    if args.end:
        df = df[df["Timestamp"] <= args.end]
    df = df.reset_index(drop=True)
    if len(df) < 20:
        raise SystemExit(f"slice too small ({len(df)} rows) — check tags/window")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    df.to_parquet(args.out, index=False)
    span = f"{df['Timestamp'].iloc[0]} -> {df['Timestamp'].iloc[-1]}"
    print(f"[make_real_slice] wrote {args.out}: {len(df):,} rows, "
          f"tags={args.tags}, span {span}")


if __name__ == "__main__":
    main()
