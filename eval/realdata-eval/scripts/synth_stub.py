#!/usr/bin/env python3
"""synth_stub.py — generate a synthetic SWaT-style pump-cycling time
series. Schema mirrors a slice of the real SWaT historian:

  Timestamp   : ISO8601, 5 s cadence
  LIT-101     : raw water tank level, percent (0–100), noisy
  P-101       : raw water pump state, 0 or 1

11 days total. Most of the run uses normal hysteresis control
(45 % on / 80 % off). A 4-hour seeded pathology window tightens the
band to 75/78 and produces short-cycling — that's what the probe's
rubric is built to detect.

Writes data/stubs/pump_cycling_v1.parquet (small, committed) so probes
have deterministic input without depending on data/raw/.
"""
from __future__ import annotations
import argparse
import math
import os
import numpy as np
import pandas as pd

SEED = 42
DT_S = 5
DURATION_S = 11 * 24 * 3600
N = DURATION_S // DT_S

# Tank model in % of nominal volume per 5 s tick.
FILL_RATE = 0.18           # ~2.2 %/min when pump on
DRAW_RATE_BASE = 0.10      # ~1.2 %/min baseline draw

# Normal hysteresis control band.
LO_NORMAL, HI_NORMAL = 45.0, 80.0

# Seeded pathology window: very tight band → genuine short-cycling.
# Band must be tight enough that on/off legs each take <~1 min so the
# 1-hour start rate clears the 12/hr detection threshold the probe uses.
PATH_START_HR, PATH_END_HR = 100, 104
LO_PATH, HI_PATH = 77.0, 78.0


def generate(seed: int = SEED, out: str | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    timestamps = pd.date_range("2026-01-01", periods=N, freq=f"{DT_S}s")

    hours = np.arange(N) * DT_S / 3600.0
    # Diurnal draw modulation ±30 %.
    draw = DRAW_RATE_BASE * (1.0 + 0.30 * np.sin(2 * math.pi * hours / 24.0))
    draw += rng.normal(0, 0.01, size=N)

    lit = np.zeros(N)
    p101 = np.zeros(N, dtype=np.int8)
    lit[0] = 70.0
    pump_on = 0

    for i in range(1, N):
        in_path = PATH_START_HR <= hours[i] < PATH_END_HR
        lo, hi = (LO_PATH, HI_PATH) if in_path else (LO_NORMAL, HI_NORMAL)

        if pump_on == 0 and lit[i - 1] <= lo:
            pump_on = 1
        elif pump_on == 1 and lit[i - 1] >= hi:
            pump_on = 0

        delta = (FILL_RATE if pump_on else 0.0) - draw[i]
        lit[i] = max(0.0, min(100.0, lit[i - 1] + delta))
        p101[i] = pump_on

    # Sensor noise on the transmitter, not the tank itself.
    lit_noisy = np.clip(lit + rng.normal(0, 0.4, size=N), 0, 100)

    df = pd.DataFrame({
        "Timestamp": timestamps,
        "LIT-101": lit_noisy.astype(np.float32),
        "P-101": p101,
    })

    if out:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        df.to_parquet(out, index=False)
    return df


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.normpath(os.path.join(here, "..", "data", "stubs", "pump_cycling_v1.parquet"))
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=default_out)
    p.add_argument("--seed", type=int, default=SEED)
    args = p.parse_args()

    df = generate(seed=args.seed, out=args.out)
    transitions = int(np.abs(np.diff(df["P-101"].astype(int))).sum())
    print(f"rows         : {len(df):,}")
    print(f"span         : {df['Timestamp'].min()} → {df['Timestamp'].max()}")
    print(f"LIT-101      : min={df['LIT-101'].min():.1f}  max={df['LIT-101'].max():.1f}")
    print(f"P-101 on-frac: {df['P-101'].mean():.3f}")
    print(f"transitions  : {transitions} (each ON+OFF cycle = 2 transitions)")
    print(f"wrote        : {args.out}")


if __name__ == "__main__":
    main()
