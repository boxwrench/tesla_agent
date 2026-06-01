#!/usr/bin/env python3
"""Generate deterministic stub data for the ph-control probe.

Shape mirrors a SWaT stage-2 chemical-dosing slice:

  Timestamp : 1 min cadence
  AIT-202   : process pH (the controlled variable)
  P-203     : HCl (acid) dosing pump, on/off (the actuator)

The plant holds pH near a setpoint by pulsing the acid pump. The seeded
condition is a CONTROL FAULT: partway through the week the acid pump sticks
ON (a classic stuck-actuator failure), over-doses, and pH crashes well below
the operating band and stays there for ~4 hours before recovering. That lets
the probe test whether an agent (a) establishes the normal operating band from
the data rather than a textbook one, (b) finds the sustained excursion, and
(c) connects it to the dosing actuator — versus over-calling normal jitter.
"""
from __future__ import annotations

import argparse
import math
import os

import numpy as np
import pandas as pd

SEED = 44
DT_MIN = 1
DAYS = 7
N = DAYS * 24 * 60 // DT_MIN

# Seeded fault: acid pump stuck ON -> overdose -> pH crash.
FAULT_START_DAY = 4.0
FAULT_HOURS = 4.0
SETPOINT = 7.55          # normal controlled pH
FAULT_PH = 5.60          # depressed pH during the overdose


def generate(seed: int = SEED, out: str | None = None) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    ts = pd.date_range("2026-03-01", periods=N, freq=f"{DT_MIN}min")
    days = np.arange(N) / (24 * 60 / DT_MIN)

    # Normal control: pH held near setpoint with mild diurnal wander + noise.
    ph = SETPOINT + 0.04 * np.sin(2 * math.pi * days) + rng.normal(0, 0.04, N)

    # Acid pump duty-cycles to hold pH: "on" pulses, slightly more often when
    # pH wanders high (needs more acid). Modeled as a base duty plus jitter.
    duty = 0.35 + 0.10 * np.sin(2 * math.pi * days)          # baseline duty
    pump = (rng.random(N) < duty).astype(np.int8)

    # --- seed the fault: stuck-ON overdose window -> sustained pH crash -------
    fstart = int(FAULT_START_DAY * 24 * 60 / DT_MIN)
    fend = fstart + int(FAULT_HOURS * 60 / DT_MIN)
    # smooth crash down and recovery (not an instantaneous step)
    seg = np.arange(fend - fstart)
    ramp = np.minimum(seg, (fend - fstart) - seg) / max(1, (fend - fstart) // 8)
    ramp = np.clip(ramp, 0, 1)
    ph[fstart:fend] = SETPOINT + (FAULT_PH - SETPOINT) * ramp + rng.normal(0, 0.03, fend - fstart)
    pump[fstart:fend] = 1                                    # stuck ON

    df = pd.DataFrame({
        "Timestamp": ts,
        "AIT-202": ph.astype(np.float32),
        # store in raw SWaT actuator encoding {1=off,2=on} so the probe's
        # load.py normalization (swat12 -> {0,1}) is exercised on the stub too.
        "P-203": (pump + 1).astype(np.int8),
    })
    if out:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        df.to_parquet(out, index=False)
    return df


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.normpath(
        os.path.join(here, "..", "data", "stubs", "ph_control_v1.parquet")
    )
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=default_out)
    p.add_argument("--seed", type=int, default=SEED)
    args = p.parse_args()

    df = generate(seed=args.seed, out=args.out)
    ph = df["AIT-202"]
    print(f"rows   : {len(df):,}")
    print(f"span   : {df['Timestamp'].min()} -> {df['Timestamp'].max()}")
    print(f"AIT-202: min={ph.min():.2f} med={ph.median():.2f} max={ph.max():.2f}")
    print(f"P-203  : raw values {sorted(df['P-203'].unique())}, on-fraction~{(df['P-203']==2).mean():.3f}")
    print(f"wrote  : {args.out}")


if __name__ == "__main__":
    main()
