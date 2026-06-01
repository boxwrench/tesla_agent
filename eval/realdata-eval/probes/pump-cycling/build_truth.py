#!/usr/bin/env python3
"""build_truth.py — compute deterministic ground-truth metrics for the
pump-cycling probe from the input data, and write truth.json.

The agent does not see this script. Its existence (and identical math)
is what makes the probe scoring auditable.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load import load_tags  # noqa: E402  — normalization layer


def find_cycles(p: np.ndarray, ts: pd.Series) -> pd.DataFrame:
    """Return one row per pump-ON cycle: start_ts, stop_ts, run_s, off_before_s."""
    p = p.astype(np.int8)
    diff = np.diff(p, prepend=p[0])
    starts_idx = np.where(diff == 1)[0]
    stops_idx = np.where(diff == -1)[0]
    if len(stops_idx) < len(starts_idx):
        stops_idx = np.append(stops_idx, len(p) - 1)
    cycles = pd.DataFrame({
        "start_ts": ts.iloc[starts_idx].values,
        "stop_ts": ts.iloc[stops_idx[:len(starts_idx)]].values,
    })
    cycles["run_s"] = (cycles["stop_ts"] - cycles["start_ts"]).dt.total_seconds()
    cycles["off_before_s"] = cycles["start_ts"].diff().dt.total_seconds().fillna(0)
    return cycles


def detect_short_cycle_windows(cycles: pd.DataFrame,
                                window_min: int = 60,
                                threshold_starts_per_hour: int = 12):
    """1-hour rolling sum of pump starts; flag spans above the threshold."""
    if cycles.empty:
        return []
    starts = pd.Series(1, index=pd.DatetimeIndex(cycles["start_ts"]))
    per_min = starts.resample("1min").sum()
    rolling = per_min.rolling(window=window_min, min_periods=1).sum()
    above = rolling >= threshold_starts_per_hour
    if not above.any():
        return []
    runs = []
    in_run = False
    run_start = None
    for t, v in above.items():
        if v and not in_run:
            run_start, in_run = t, True
        elif not v and in_run:
            runs.append({
                "start_ts": run_start.isoformat(),
                "end_ts": t.isoformat(),
                "peak_starts_per_hour": int(rolling[run_start:t].max()),
            })
            in_run = False
    if in_run:
        runs.append({
            "start_ts": run_start.isoformat(),
            "end_ts": above.index[-1].isoformat(),
            "peak_starts_per_hour": int(rolling[run_start:].max()),
        })
    return runs


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    default_data = os.path.normpath(
        os.path.join(here, "..", "..", "data", "stubs", "pump_cycling_v1.parquet"))
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=default_data)
    p.add_argument("--out", default=os.path.join(here, "truth.json"))
    args = p.parse_args()

    df = load_tags(args.data, ["LIT-101", "P-101"])

    # Packing-slip check before trusting anything built on this data.
    import integrity
    rep = integrity.report(df, ["LIT-101", "P-101"])
    integrity.assert_ok(rep)  # raises loud on blocking flags
    print("[build_truth] integrity OK — "
          f"{rep['rows']:,} rows, {rep['span']['hours']}h, "
          f"P-101 encoding={rep['tags']['P-101']['encoding_detected']}, "
          f"LIT-101 {rep['tags']['LIT-101'].get('unit_hint','?')}")

    cycles = find_cycles(df["P-101"].values, df["Timestamp"])
    total_hours = (df["Timestamp"].iloc[-1] - df["Timestamp"].iloc[0]).total_seconds() / 3600.0

    # Operating band: level at the ON-transition vs the OFF-transition.
    # A FILL pump turns on low / off high; a DRAIN pump is the reverse.
    # The band is just the envelope, so take min/max of the two edges —
    # direction-agnostic — and record the pump's action separately.
    p = df["P-101"].astype(np.int8).values
    lit = df["LIT-101"].values
    diff = np.diff(p, prepend=p[0])
    lit_on = [float(lit[i - 1]) for i in np.where(diff == 1)[0] if i > 0]
    lit_off = [float(lit[i - 1]) for i in np.where(diff == -1)[0] if i > 0]
    on_level = float(np.median(lit_on)) if lit_on else None
    off_level = float(np.median(lit_off)) if lit_off else None
    if on_level is not None and off_level is not None:
        band_lo, band_hi = min(on_level, off_level), max(on_level, off_level)
        pump_action = "fill (on when low)" if on_level < off_level else "drain (on when high)"
    else:
        band_lo = band_hi = None
        pump_action = "unknown"

    short_cycle_windows = detect_short_cycle_windows(
        cycles, window_min=60, threshold_starts_per_hour=12)

    # Band tolerance must scale with the level unit: ±2 makes sense in
    # percent, but is absurdly tight in mm. Tie it to the band span so
    # it is unit-agnostic (≈5% of the operating band, floored at 2).
    lit_unit = rep["tags"]["LIT-101"].get("unit_hint", "percent")
    band_span = (band_hi - band_lo) if (band_lo is not None and band_hi is not None) else 0.0
    band_abs_tol = round(max(2.0, 0.05 * band_span), 2)

    truth = {
        "data_source": os.path.relpath(args.data, here),
        "span": {
            "start": df["Timestamp"].iloc[0].isoformat(),
            "end": df["Timestamp"].iloc[-1].isoformat(),
            "rows": int(len(df)),
            "hours": round(total_hours, 2),
        },
        "cycles": {
            "total": int(len(cycles)),
            "median_run_s": float(cycles["run_s"].median()) if not cycles.empty else None,
            "median_off_s": float(cycles["off_before_s"][1:].median()) if len(cycles) > 1 else None,
        },
        "starts_per_hour_overall": round(len(cycles) / total_hours, 3),
        "level_band": {
            "low_pct": round(band_lo, 2) if band_lo is not None else None,
            "high_pct": round(band_hi, 2) if band_hi is not None else None,
            "unit": lit_unit,
            "pump_action": pump_action,
        },
        "short_cycle_windows": short_cycle_windows,
        "tolerances": {
            "starts_per_hour_rel": 0.05,
            "band_pct_abs": band_abs_tol,
            "short_cycle_window_minutes": 30,
        },
    }
    with open(args.out, "w") as f:
        json.dump(truth, f, indent=2, default=str)
    print(json.dumps(truth, indent=2, default=str))


if __name__ == "__main__":
    main()
