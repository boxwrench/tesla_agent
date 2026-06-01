#!/usr/bin/env python3
"""Generate deterministic stub data for the membrane-fouling probe.

The shape mirrors a SWaT stage-3 slice:

  Timestamp : 1 min cadence
  DPIT-301  : differential pressure across the membrane/filter train
  FIT-301   : feed flow

The seeded condition is gradual fouling: flow stays roughly stable while
differential pressure rises over the week. That lets the probe test whether
an agent distinguishes a true pressure-drop trend from a flow-driven artifact.
"""
from __future__ import annotations

import argparse
import math
import os

import numpy as np
import pandas as pd

SEED = 43
DT_MIN = 1
DAYS = 7
N = DAYS * 24 * 60 // DT_MIN


def generate(seed: int = SEED, out: str | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    ts = pd.date_range("2026-02-01", periods=N, freq=f"{DT_MIN}min")
    days = np.arange(N) / (24 * 60 / DT_MIN)

    flow = 2.10 + 0.05 * np.sin(2 * math.pi * days) + rng.normal(0, 0.015, N)
    flow = np.clip(flow, 1.85, None)

    # True fouling signal: DP rises about 1.65 units/day with small noise.
    dp = 12.0 + 1.65 * days + 0.25 * np.sin(2 * math.pi * days / 2.5)
    dp += rng.normal(0, 0.12, N)

    df = pd.DataFrame({
        "Timestamp": ts,
        "DPIT-301": dp.astype(np.float32),
        "FIT-301": flow.astype(np.float32),
    })
    if out:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        df.to_parquet(out, index=False)
    return df


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.normpath(
        os.path.join(here, "..", "data", "stubs", "membrane_fouling_v1.parquet")
    )
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=default_out)
    p.add_argument("--seed", type=int, default=SEED)
    args = p.parse_args()

    df = generate(seed=args.seed, out=args.out)
    print(f"rows    : {len(df):,}")
    print(f"span    : {df['Timestamp'].min()} -> {df['Timestamp'].max()}")
    print(f"DPIT-301: min={df['DPIT-301'].min():.2f} max={df['DPIT-301'].max():.2f}")
    print(f"FIT-301 : min={df['FIT-301'].min():.2f} max={df['FIT-301'].max():.2f}")
    print(f"wrote   : {args.out}")


if __name__ == "__main__":
    main()
